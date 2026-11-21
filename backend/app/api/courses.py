import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..agents.roles import is_demo
from ..config import get_settings
from ..db import get_db
from ..ingestion.extract import UnsupportedFile, detect_kind, extract
from ..models import (
    AgentArtifact,
    AgentTask,
    Chapter,
    Concept,
    ConceptPrerequisite,
    Course,
    CourseMember,
    HardChapterVote,
    Resource,
    Section,
    SourceChunk,
    WorkflowEvent,
    WorkflowRun,
)
from ..retrieval.chunking import Page
from ..security import course_access, current_user, get_owned_course, get_readable_course, rate_limit
from ..services.ingest import add_chunks
from ..workflows.jordan import retry_failed, run_workflow, start_workflow

router = APIRouter(prefix="/api", tags=["courses"])


class CourseIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    language: Literal["fr", "en", "ar", "derja"] = "fr"


class TextIn(BaseModel):
    title: str = Field(default="Texte collé", max_length=200)
    text: str = Field(min_length=50, max_length=400_000)
    rights_confirmed: bool


class VisibilityIn(BaseModel):
    visibility: Literal["private", "published"]
    confirm: bool = False


def course_card(db: Session, c: Course, user) -> dict:
    return {"id": str(c.id), "title": c.title, "description": c.description, "language": c.language, "visibility": c.visibility,
            "status": c.status, "is_demo": c.is_demo, "access": course_access(db, user, c),
            "chapter_count": db.scalar(select(func.count()).select_from(Chapter).where(Chapter.course_id == c.id)),
            "created_at": c.created_at.isoformat()}


@router.get("/courses")
def list_courses(user=Depends(current_user), db: Session = Depends(get_db)):
    member_ids = select(CourseMember.course_id).where(CourseMember.user_id == user.id)
    rows = db.scalars(select(Course).where(or_(Course.owner_id == user.id, Course.id.in_(member_ids))).order_by(Course.created_at.desc())).all()
    return [course_card(db, c, user) for c in rows]


@router.get("/library")
def library(q: str = "", user=Depends(current_user), db: Session = Depends(get_db)):
    """Only explicitly published courses. Search is over titles/descriptions, never private material."""
    stmt = select(Course).where(Course.visibility == "published")
    if q.strip():
        like = f"%{q.strip()[:80]}%"
        stmt = stmt.where(or_(Course.title.ilike(like), Course.description.ilike(like)))
    return [course_card(db, c, user) for c in db.scalars(stmt.order_by(Course.published_at.desc()).limit(50))]


@router.post("/courses/{course_id}/enroll")
def enroll(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_readable_course(db, user, course_id)
    if not db.get(CourseMember, (course.id, user.id)) and course.owner_id != user.id:
        db.add(CourseMember(course_id=course.id, user_id=user.id, member_role="student"))
        db.commit()
    return {"ok": True}


@router.post("/courses")
def create_course(body: CourseIn, user=Depends(current_user), db: Session = Depends(get_db)):
    c = Course(owner_id=user.id, title=body.title.strip(), description=body.description, language=body.language)
    db.add(c)
    db.commit()
    return course_card(db, c, user)


def _resource_out(r: Resource, chunks: int | None = None) -> dict:
    return {"id": str(r.id), "filename": r.filename, "kind": r.kind, "size_bytes": r.size_bytes, "page_count": r.page_count,
            "status": r.extraction_status, "notes": r.extraction_notes, "chunks": chunks}


@router.post("/courses/{course_id}/resources/text", dependencies=[Depends(rate_limit("upload", 20, 600))])
def add_text(course_id: uuid.UUID, body: TextIn, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_owned_course(db, user, course_id)
    if not body.rights_confirmed:
        raise HTTPException(400, "Please confirm you have the right to use this material")
    pages = [Page(i + 1 if "\f" in body.text else None, p) for i, p in enumerate(body.text.split("\f"))]
    r = Resource(course_id=course.id, owner_id=user.id, kind="text", filename=body.title, mime="text/plain", size_bytes=len(body.text.encode()),
                 rights_confirmed=True, page_count=len(pages) if "\f" in body.text else None, extraction_status="ok")
    db.add(r)
    db.flush()
    n = add_chunks(db, course, r, pages)
    db.commit()
    return _resource_out(r, n)


@router.post("/courses/{course_id}/resources/upload", dependencies=[Depends(rate_limit("upload", 20, 600))])
async def upload(course_id: uuid.UUID, file: UploadFile = File(...), rights_confirmed: bool = Form(...),
                 user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_owned_course(db, user, course_id)
    s = get_settings()
    if not rights_confirmed:
        raise HTTPException(400, "Please confirm you have the right to use this material")
    data = await file.read(s.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > s.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File too large (max {s.max_upload_mb} MB)")
    name = (file.filename or "upload").replace("/", "_").replace("\\", "_")[:200]
    try:
        kind = detect_kind(name, file.content_type, data[:8192])
    except UnsupportedFile as e:
        raise HTTPException(415, str(e))
    s.storage_dir.mkdir(parents=True, exist_ok=True)
    rid = uuid.uuid4()
    path = s.storage_dir / f"{rid}.bin"  # private path, original name never used on disk
    path.write_bytes(data)
    ex = extract(kind, data)
    ex = _maybe_ocr(kind, data, file.content_type or "", ex)
    r = Resource(id=rid, course_id=course.id, owner_id=user.id, kind=kind, filename=name, mime=file.content_type or "", size_bytes=len(data),
                 storage_path=str(path), rights_confirmed=True, page_count=len(ex.pages) or None, extraction_status=ex.status, extraction_notes=ex.notes)
    db.add(r)
    db.flush()
    n = add_chunks(db, course, r, ex.pages) if ex.pages else 0
    db.commit()
    return _resource_out(r, n)


def _maybe_ocr(kind: str, data: bytes, mime: str, ex):
    """Scanned PDF pages / photos of notes: transcribe with Gemini when available, otherwise keep the honest note."""
    if kind not in ("pdf", "image") or ex.status == "ok":
        return ex
    from ..services.gemini_media import MediaUnavailable, ocr

    mime = "application/pdf" if kind == "pdf" else (mime if mime.startswith("image/") else "image/png")
    try:
        pages = ocr(data, mime)
    except MediaUnavailable as e:
        ex.notes.append(str(e))
        return ex
    have = {p.number for p in ex.pages}
    added = [p for p in pages if p.number not in have]
    if added:
        ex.pages = sorted(ex.pages + added, key=lambda p: p.number or 0)
        ex.status = "partial"
        ex.notes = [n for n in ex.notes if "OCR" not in n and "scanned" not in n] + [f"{len(added)} page(s) transcribed by OCR (Gemini) - check them for errors."]
    return ex


class YoutubeIn(BaseModel):
    url: str = Field(min_length=10, max_length=300)
    rights_confirmed: bool


@router.post("/courses/{course_id}/resources/youtube", dependencies=[Depends(rate_limit("upload", 20, 600))])
def add_youtube(course_id: uuid.UUID, body: YoutubeIn, user=Depends(current_user), db: Session = Depends(get_db)):
    import re

    from ..services.gemini_media import MediaUnavailable, youtube_transcript

    course = get_owned_course(db, user, course_id)
    if not body.rights_confirmed:
        raise HTTPException(400, "Please confirm you have the right to use this material")
    if not re.match(r"^https://(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[\w-]{6,}", body.url):
        raise HTTPException(400, "Paste a YouTube video link (https://www.youtube.com/watch?v=...)")
    try:
        pages = youtube_transcript(body.url)
    except MediaUnavailable as e:
        raise HTTPException(422, str(e))
    r = Resource(course_id=course.id, owner_id=user.id, kind="video", filename=body.url, mime="video/youtube", size_bytes=0,
                 rights_confirmed=True, extraction_status="partial", extraction_notes=["Content transcribed from the video by Gemini; timestamps refer to the video."])
    db.add(r)
    db.flush()
    n = add_chunks(db, course, r, pages)
    db.commit()
    return _resource_out(r, n)


@router.post("/courses/{course_id}/workflow", dependencies=[Depends(rate_limit("workflow", 6, 600))])
def start(course_id: uuid.UUID, background: BackgroundTasks, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_readable_course(db, user, course_id)
    if course_access(db, user, course) not in ("owner", "teacher"):
        raise HTTPException(403, "Only the course owner or its teacher can (re)generate it")
    if not db.scalar(select(func.count()).select_from(SourceChunk).where(SourceChunk.course_id == course.id)):
        raise HTTPException(400, "Add some course material first")
    running = db.scalar(select(WorkflowRun).where(WorkflowRun.course_id == course.id, WorkflowRun.status.in_(["queued", "running"])))
    if running:
        return {"workflow_id": str(running.id)}
    wf = start_workflow(db, course, user.id, course.language, is_demo())
    background.add_task(run_workflow, wf.id, user.profile.derja_script)
    return {"workflow_id": str(wf.id)}


@router.post("/workflows/{wf_id}/retry", dependencies=[Depends(rate_limit("workflow", 6, 600))])
def retry_workflow(wf_id: uuid.UUID, background: BackgroundTasks, user=Depends(current_user), db: Session = Depends(get_db)):
    """Re-run only the agents that failed or need review (structure is kept)."""
    wf = db.get(WorkflowRun, wf_id)
    if not wf:
        raise HTTPException(404, "Not found")
    course = get_readable_course(db, user, wf.course_id)
    if course_access(db, user, course) not in ("owner", "teacher"):
        raise HTTPException(403, "Only the course owner or its teacher can retry")
    if wf.status in ("queued", "running"):
        raise HTTPException(409, "The workflow is still running")
    failed = db.scalars(select(AgentTask).where(AgentTask.workflow_id == wf.id, AgentTask.status.in_(["failed", "needs_review"]),
                                                AgentTask.agent_role != "clara")).all()
    if not failed:
        raise HTTPException(400, "Nothing to retry")
    wf.status = "running"
    db.commit()
    background.add_task(retry_failed, wf.id, user.profile.derja_script)
    return {"workflow_id": str(wf.id), "retrying": [t.agent_role for t in failed]}


@router.get("/workflows/{wf_id}")
def workflow_status(wf_id: uuid.UUID, after: int = 0, user=Depends(current_user), db: Session = Depends(get_db)):
    wf = db.get(WorkflowRun, wf_id)
    if not wf:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, wf.course_id)
    tasks = db.scalars(select(AgentTask).where(AgentTask.workflow_id == wf.id).order_by(AgentTask.created_at)).all()
    events = db.scalars(select(WorkflowEvent).where(WorkflowEvent.workflow_id == wf.id, WorkflowEvent.id > after).order_by(WorkflowEvent.id)).all()
    return {"id": str(wf.id), "course_id": str(wf.course_id), "status": wf.status, "demo_mode": wf.demo_mode,
            "tasks": [{"id": str(t.id), "agent_role": t.agent_role, "status": t.status, "retry_count": t.retry_count, "error": t.error} for t in tasks],
            "events": [{"id": e.id, "agent_role": e.agent_role, "type": e.type, "message": e.message, "at": e.created_at.isoformat()} for e in events]}


@router.get("/courses/{course_id}")
def course_detail(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_readable_course(db, user, course_id)
    chapters = db.scalars(select(Chapter).where(Chapter.course_id == course.id).order_by(Chapter.ordinal)).all()
    sections = db.scalars(select(Section).where(Section.course_id == course.id).order_by(Section.ordinal)).all()
    concepts = db.scalars(select(Concept).where(Concept.course_id == course.id)).all()
    cids = {c.id for c in concepts}
    prereq = [(str(a), str(b)) for a, b in db.execute(select(ConceptPrerequisite.concept_id, ConceptPrerequisite.prerequisite_id)).all() if a in cids]
    refs = {c.ref: {"ref": c.ref, "page": c.page, "section": c.section_hint, "excerpt": c.text[:280]}
            for c in db.scalars(select(SourceChunk).where(SourceChunk.course_id == course.id))}
    hard_counts = dict(db.execute(select(HardChapterVote.chapter_id, func.count()).where(HardChapterVote.chapter_id.in_([c.id for c in chapters]))
                                  .group_by(HardChapterVote.chapter_id)).all())
    my_hard = set(db.scalars(select(HardChapterVote.chapter_id).where(HardChapterVote.user_id == user.id)))
    latest_wf = db.scalar(select(WorkflowRun).where(WorkflowRun.course_id == course.id).order_by(WorkflowRun.created_at.desc()))
    notes = db.scalar(select(AgentArtifact).where(AgentArtifact.course_id == course.id, AgentArtifact.kind == "analysis_notes"))
    resources = db.scalars(select(Resource).where(Resource.course_id == course.id)).all() if course.owner_id == user.id else []
    return {
        **course_card(db, course, user),
        "workflow": {"id": str(latest_wf.id), "status": latest_wf.status, "demo_mode": latest_wf.demo_mode} if latest_wf else None,
        "analysis_notes": notes.payload if notes else None,
        "resources": [_resource_out(r) for r in resources],
        "chapters": [{
            "id": str(ch.id), "title": ch.title, "summary": ch.summary, "citations": ch.citations,
            "hard_votes": hard_counts.get(ch.id, 0), "i_voted_hard": ch.id in my_hard,
            "sections": [{"id": str(s.id), "title": s.title, "content": s.content, "objectives": s.objectives, "key_terms": s.key_terms,
                          "formulas": s.formulas, "hard_points": s.hard_points, "citations": s.citations}
                         for s in sections if s.chapter_id == ch.id],
        } for ch in chapters],
        "concepts": [{"id": str(c.id), "key": c.key, "name": c.name, "description": c.description, "section_id": str(c.section_id) if c.section_id else None,
                      "citations": c.citations} for c in concepts],
        "prerequisites": [{"concept_id": a, "prerequisite_id": b} for a, b in prereq],
        "refs": refs,
    }


@router.patch("/courses/{course_id}/visibility")
def set_visibility(course_id: uuid.UUID, body: VisibilityIn, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_owned_course(db, user, course_id)
    if body.visibility == "published":
        if not body.confirm:
            raise HTTPException(400, "Publishing requires explicit confirmation")
        course.published_at = datetime.now(timezone.utc)
    course.visibility = body.visibility
    db.commit()
    return course_card(db, course, user)


@router.get("/courses/{course_id}/publish-preview")
def publish_preview(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    """Exactly what becomes visible if the owner publishes."""
    course = get_owned_course(db, user, course_id)
    n_chunks = db.scalar(select(func.count()).select_from(SourceChunk).where(SourceChunk.course_id == course.id))
    return {"visible": ["Course title and description", "Generated structure, exercises, quizzes and revision material",
                        f"Source text excerpts used as citations and for the tutor ({n_chunks} passages)", "Discussion threads"],
            "never_visible": ["Original uploaded files", "Your progress, attempts and tutor conversations", "Your identity on anonymous signals"]}


@router.delete("/courses/{course_id}")
def delete_course(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    from pathlib import Path

    course = get_owned_course(db, user, course_id)
    for r in db.scalars(select(Resource).where(Resource.course_id == course.id)):
        if r.storage_path:
            Path(r.storage_path).unlink(missing_ok=True)
    db.delete(course)
    db.commit()
    return {"ok": True}
