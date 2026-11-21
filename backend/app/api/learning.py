import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..agents import roles
from ..db import get_db
from ..models import (
    AgentArtifact,
    Course,
    Assessment,
    Attempt,
    Chapter,
    Concept,
    ProgressEvent,
    ProjectSuggestion,
    Question,
    Section,
    SourceChunk,
    StudentProjectStatus,
    WorkflowRun,
)
from ..security import current_user, get_readable_course, rate_limit
from ..services.learning import course_progress, diagnose_gaps, score_attempt
from ..services.pdf import revision_pdf
from ..workflows.jordan import build_topic_map

router = APIRouter(prefix="/api", tags=["learning"])


def _assessment(db: Session, user, assessment_id: uuid.UUID) -> Assessment:
    a = db.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, a.course_id)
    return a


@router.get("/courses/{course_id}/assessments")
def list_assessments(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    get_readable_course(db, user, course_id)
    out = []
    for a in db.scalars(select(Assessment).where(Assessment.course_id == course_id).order_by(Assessment.kind, Assessment.created_at)):
        best = db.scalars(select(Attempt).where(Attempt.assessment_id == a.id, Attempt.user_id == user.id).order_by(Attempt.score.desc())).first()
        kinds = db.scalars(select(Question.qtype).where(Question.assessment_id == a.id)).all()
        n, n_open = sum(1 for k in kinds if k != "open"), sum(1 for k in kinds if k == "open")
        out.append({"id": str(a.id), "kind": a.kind, "title": a.title, "chapter_id": str(a.chapter_id) if a.chapter_id else None,
                    "section_id": str(a.section_id) if a.section_id else None, "questions": n, "problems": n_open, "quality_status": a.quality_status,
                    "agent_role": a.agent_role, "best": {"score": best.score, "max": best.max_score} if best else None})
    return out


@router.get("/assessments/{assessment_id}")
def get_assessment(assessment_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    """Answer key and explanations are NOT included; they are returned only after submission."""
    a = _assessment(db, user, assessment_id)
    qs = db.scalars(select(Question).where(Question.assessment_id == a.id).order_by(Question.ordinal)).all()
    return {"id": str(a.id), "kind": a.kind, "title": a.title, "quality_status": a.quality_status, "findings": a.findings,
            "questions": [{"id": str(q.id), "qtype": q.qtype, "prompt": q.prompt, "choices": q.choices, "points": q.points, "citations": q.citations,
                           "hints": q.hints if q.qtype == "open" else [], "difficulty": q.difficulty,
                           "rubric_size": len(q.rubric or []), "my_last": _last_open(db, user.id, q.id) if q.qtype == "open" else None} for q in qs]}


def _last_open(db: Session, user_id, qid) -> dict | None:
    from ..models import OpenAnswer

    a = db.scalars(select(OpenAnswer).where(OpenAnswer.user_id == user_id, OpenAnswer.question_id == qid).order_by(OpenAnswer.created_at.desc())).first()
    return {"answer": a.answer, "score": a.score, "grading": a.grading, "at": a.created_at.isoformat()} if a else None


class OpenAnswerIn(BaseModel):
    answer: str = Field(min_length=1, max_length=8000)
    hints_used: int = Field(default=0, ge=0, le=10)
    language: Literal["fr", "en", "ar", "derja"] | None = None


def _open_question(db: Session, user, qid: uuid.UUID) -> tuple[Question, Assessment]:
    q = db.get(Question, qid)
    if not q or q.qtype != "open":
        raise HTTPException(404, "Exercise not found")
    a = db.get(Assessment, q.assessment_id)
    get_readable_course(db, user, a.course_id)
    return q, a


@router.post("/questions/{qid}/open-answer", dependencies=[Depends(rate_limit("open_answer", 12, 60))])
def submit_open(qid: uuid.UUID, body: OpenAnswerIn, user=Depends(current_user), db: Session = Depends(get_db)):
    from ..llm.provider import LLMError
    from ..models import ConceptProgress, OpenAnswer

    q, a = _open_question(db, user, qid)
    course = db.get(Course, a.course_id)
    try:
        grading, demo = roles.grade_open(db, course, {"prompt": q.prompt, "rubric": q.rubric, "solution": q.answer_text or ""}, body.answer,
                                         body.language or user.profile.locale, user.profile.derja_script)
    except LLMError as e:
        raise HTTPException(503, f"Grading is unavailable right now ({e}). Your answer was not lost; try again.")
    grading["demo"] = demo
    db.add(OpenAnswer(user_id=user.id, question_id=q.id, answer=body.answer, score=grading["score"], grading=grading, hints_used=body.hints_used))
    if q.concept_id:
        cp = db.get(ConceptProgress, (user.id, q.concept_id))
        if cp is None:
            db.add(ConceptProgress(user_id=user.id, concept_id=q.concept_id, correct=int(grading["score"] >= 60), total=1))
        else:
            cp.correct += int(grading["score"] >= 60)
            cp.total += 1
    db.add(ProgressEvent(user_id=user.id, course_id=a.course_id, kind="open_answer", ref_id=str(q.id),
                         data={"score": grading["score"], "hints_used": body.hints_used}))
    db.commit()
    return {**grading, "solution_available": True}


@router.get("/questions/{qid}/solution")
def open_solution(qid: uuid.UUID, give_up: bool = False, user=Depends(current_user), db: Session = Depends(get_db)):
    """Worked solution + rubric, only after the student answered (or explicitly gave up)."""
    from ..models import OpenAnswer

    q, a = _open_question(db, user, qid)
    answered = db.scalar(select(OpenAnswer.id).where(OpenAnswer.user_id == user.id, OpenAnswer.question_id == q.id))
    if not answered:
        if not give_up:
            raise HTTPException(400, "Try the exercise first (or choose to see the solution)")
        db.add(OpenAnswer(user_id=user.id, question_id=q.id, answer="", score=None, grading={"gave_up": True}))
        db.commit()
    return {"solution": q.answer_text, "rubric": q.rubric, "citations": q.citations}


class AttemptIn(BaseModel):
    answers: dict[str, int]


@router.post("/assessments/{assessment_id}/attempts", dependencies=[Depends(rate_limit("attempt", 30, 60))])
def submit_attempt(assessment_id: uuid.UUID, body: AttemptIn, user=Depends(current_user), db: Session = Depends(get_db)):
    a = _assessment(db, user, assessment_id)
    attempt = score_attempt(db, user.id, a, body.answers)
    qs = {str(q.id): q for q in db.scalars(select(Question).where(Question.assessment_id == a.id))}
    concepts = {c.id: c for c in db.scalars(select(Concept).where(Concept.course_id == a.course_id))}
    results = []
    for pq in attempt.per_question:
        q = qs[pq["question_id"]]
        results.append({**pq, "correct_index": q.correct_index, "explanation": q.explanation, "citations": q.citations,
                        "misconception": (q.distractor_notes[pq["chosen"]] if pq["chosen"] is not None and not pq["correct"] and pq["chosen"] < len(q.distractor_notes) else None),
                        "concept": concepts[q.concept_id].name if q.concept_id in concepts else None})
    from .growth import community_state

    for r in results:
        r["community"] = community_state(db, user, qs[r["question_id"]])
    gaps = diagnose_gaps(db, user.id, a.course_id, attempt)
    return {"attempt_id": str(attempt.id), "score": attempt.score, "max": attempt.max_score, "results": results, "gaps": gaps}


@router.post("/sections/{section_id}/complete")
def complete_section(section_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    s = db.get(Section, section_id)
    if not s:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, s.course_id)
    exists = db.scalar(select(ProgressEvent.id).where(ProgressEvent.user_id == user.id, ProgressEvent.kind == "section_complete", ProgressEvent.ref_id == str(s.id)))
    if not exists:
        db.add(ProgressEvent(user_id=user.id, course_id=s.course_id, kind="section_complete", ref_id=str(s.id)))
        db.commit()
    return {"ok": True}


@router.get("/courses/{course_id}/progress")
def progress(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    get_readable_course(db, user, course_id)
    return course_progress(db, user.id, course_id)


@router.get("/courses/{course_id}/revision")
def revision(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_readable_course(db, user, course_id)
    rev = db.scalar(select(AgentArtifact).where(AgentArtifact.course_id == course.id, AgentArtifact.kind == "revision").order_by(AgentArtifact.created_at.desc()))
    tmap = db.scalar(select(AgentArtifact).where(AgentArtifact.course_id == course.id, AgentArtifact.kind == "topic_map").order_by(AgentArtifact.created_at.desc()))
    return {"revision": rev.payload if rev else None, "quality_status": rev.quality_status if rev else None, "findings": rev.findings if rev else [],
            "topic_map": tmap.payload if tmap else build_topic_map(db, course)}


@router.get("/courses/{course_id}/revision.pdf")
def revision_pdf_route(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_readable_course(db, user, course_id)
    rev = db.scalar(select(AgentArtifact).where(AgentArtifact.course_id == course.id, AgentArtifact.kind == "revision").order_by(AgentArtifact.created_at.desc()))
    if not rev:
        raise HTTPException(404, "Revision material is not ready yet")
    pages = {c.ref: (f"p.{c.page}" if c.page else c.ref) for c in db.scalars(select(SourceChunk).where(SourceChunk.course_id == course.id))}
    wf = db.scalar(select(WorkflowRun).where(WorkflowRun.course_id == course.id).order_by(WorkflowRun.created_at.desc()))
    data = revision_pdf(course.title, rev.payload, bool(wf and wf.demo_mode), pages)
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="revision-sheet.pdf"'})


# ---------------------------------------------------------------- projects (unlocked by chapter completion)
@router.get("/courses/{course_id}/projects")
def list_projects(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_readable_course(db, user, course_id)
    prog = course_progress(db, user.id, course.id)
    completed = {c["chapter_id"] for c in prog["chapters"] if c["complete"]}
    out = []
    for ch in db.scalars(select(Chapter).where(Chapter.course_id == course.id).order_by(Chapter.ordinal)):
        items = db.scalars(select(ProjectSuggestion).where(ProjectSuggestion.chapter_id == ch.id)).all()
        statuses = {s.project_id: s for s in db.scalars(select(StudentProjectStatus).where(StudentProjectStatus.user_id == user.id))}
        out.append({"chapter_id": str(ch.id), "chapter": ch.title, "unlocked": str(ch.id) in completed,
                    "projects": [{"id": str(p.id), **p.payload, "quality_status": p.quality_status,
                                  "status": statuses[p.id].status if p.id in statuses else None,
                                  "progress": statuses[p.id].progress if p.id in statuses else 0} for p in items]})
    return {"criteria": prog["criteria"], "chapters": out}


@router.post("/chapters/{chapter_id}/projects/generate", dependencies=[Depends(rate_limit("projects", 6, 600))])
def generate_projects(chapter_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    ch = db.get(Chapter, chapter_id)
    if not ch:
        raise HTTPException(404, "Not found")
    course = get_readable_course(db, user, ch.course_id)
    prog = course_progress(db, user.id, course.id)
    if not any(c["chapter_id"] == str(ch.id) and c["complete"] for c in prog["chapters"]):
        raise HTTPException(400, "Complete the chapter first: " + prog["criteria"])
    existing = db.scalars(select(ProjectSuggestion).where(ProjectSuggestion.chapter_id == ch.id)).all()
    if existing:
        return {"created": 0}
    keys = [c.key for c in db.scalars(select(Concept).join(Section, Section.id == Concept.section_id).where(Section.chapter_id == ch.id))]
    result = roles.projects(db, course, ch.title, keys, course.outline_digest or "", user.profile.locale, user.profile.derja_script)
    for p in result.payload["projects"]:
        db.add(ProjectSuggestion(course_id=course.id, chapter_id=ch.id, payload=p, quality_status="unverified"))
    db.commit()
    return {"created": len(result.payload["projects"]), "demo": result.demo}


class ProjectStatusIn(BaseModel):
    status: Literal["saved", "started", "completed", "dismissed"]
    progress: int = 0


@router.put("/projects/{project_id}/status")
def set_project_status(project_id: uuid.UUID, body: ProjectStatusIn, user=Depends(current_user), db: Session = Depends(get_db)):
    p = db.get(ProjectSuggestion, project_id)
    if not p:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, p.course_id)
    prog = 100 if body.status == "completed" else max(0, min(100, body.progress))
    db.merge(StudentProjectStatus(user_id=user.id, project_id=p.id, status=body.status, progress=prog, updated_at=datetime.now(timezone.utc)))
    db.add(ProgressEvent(user_id=user.id, course_id=p.course_id, kind="project", ref_id=str(p.id), data={"status": body.status}))
    db.commit()
    return {"ok": True}
