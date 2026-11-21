"""Community knowledge: multilingual glossary, shared student resources, Resource Finder, exam archive."""
import uuid
from collections import Counter
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
    Chapter,
    ExamCorrection,
    ExamCorrectionVote,
    ExamPaper,
    GlossaryTerm,
    Profile,
    ResourceRating,
    SharedResource,
)
from ..security import current_user, get_readable_course, rate_limit, role_of
from ..services.gemini_media import MediaUnavailable, find_resources

router = APIRouter(prefix="/api", tags=["knowledge"])
REVIEWERS = ("senior", "teacher", "admin")


def _name(db: Session, uid) -> str:
    p = db.get(Profile, uid) if uid else None
    return p.display_name if p else "—"


# ---------------------------------------------------------------- glossary
class TermIn(BaseModel):
    term_fr: str = Field(min_length=1, max_length=200)
    term_ar: str | None = Field(default=None, max_length=200)
    term_derja: str | None = Field(default=None, max_length=200)
    term_en: str | None = Field(default=None, max_length=200)
    explanation: str = Field(min_length=3, max_length=2000)
    example: str | None = Field(default=None, max_length=1000)


def _term(db: Session, t: GlossaryTerm) -> dict:
    return {"id": str(t.id), "term_fr": t.term_fr, "term_ar": t.term_ar, "term_derja": t.term_derja, "term_en": t.term_en,
            "explanation": t.explanation, "example": t.example, "review_state": t.review_state, "contributor": _name(db, t.contributor_id)}


@router.get("/courses/{course_id}/glossary")
def glossary(course_id: uuid.UUID, q: str = "", user=Depends(current_user), db: Session = Depends(get_db)):
    get_readable_course(db, user, course_id)
    stmt = select(GlossaryTerm).where(GlossaryTerm.course_id == course_id)
    if q.strip():
        like = f"%{q.strip()[:60]}%"
        stmt = stmt.where(GlossaryTerm.term_fr.ilike(like) | GlossaryTerm.term_ar.ilike(like) | GlossaryTerm.term_derja.ilike(like) | GlossaryTerm.term_en.ilike(like))
    return [_term(db, t) for t in db.scalars(stmt.order_by(GlossaryTerm.term_fr))]


@router.post("/courses/{course_id}/glossary", dependencies=[Depends(rate_limit("glossary", 20, 600))])
def add_term(course_id: uuid.UUID, body: TermIn, user=Depends(current_user), db: Session = Depends(get_db)):
    get_readable_course(db, user, course_id)
    t = GlossaryTerm(course_id=course_id, contributor_id=user.id, review_state="reviewed" if role_of(user) in REVIEWERS else "pending", **body.model_dump())
    db.add(t)
    db.commit()
    return _term(db, t)


@router.post("/glossary/{term_id}/review")
def review_term(term_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    t = db.get(GlossaryTerm, term_id)
    if not t:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, t.course_id)
    if role_of(user) not in REVIEWERS:
        raise HTTPException(403, "Only peer tutors and teachers can review terms")
    t.review_state = "reviewed"
    db.commit()
    return _term(db, t)


# ---------------------------------------------------------------- shared resources
class SharedIn(BaseModel):
    kind: Literal["note", "summary", "solved_exercise", "video_url"]
    title: str = Field(min_length=3, max_length=300)
    body: str | None = Field(default=None, max_length=20_000)
    url: HttpUrl | None = None
    rights_confirmed: bool


def _shared(db: Session, r: SharedResource, user) -> dict:
    ratings = db.execute(select(ResourceRating.helpful, func.count()).where(ResourceRating.resource_id == r.id).group_by(ResourceRating.helpful)).all()
    counts = {bool(h): n for h, n in ratings}
    mine = db.get(ResourceRating, (user.id, r.id))
    return {"id": str(r.id), "kind": r.kind, "title": r.title, "body": r.body, "url": r.url, "author": _name(db, r.author_id),
            "helpful": counts.get(True, 0), "not_helpful": counts.get(False, 0), "my_rating": None if not mine else mine.helpful,
            "mine": r.author_id == user.id, "at": r.created_at.isoformat()}


@router.get("/chapters/{chapter_id}/shared")
def list_shared(chapter_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    ch = db.get(Chapter, chapter_id)
    if not ch:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, ch.course_id)
    rows = db.scalars(select(SharedResource).where(SharedResource.chapter_id == ch.id, SharedResource.status == "active").order_by(SharedResource.created_at.desc())).all()
    out = [_shared(db, r, user) for r in rows]
    return sorted(out, key=lambda r: -(r["helpful"] - r["not_helpful"]))


@router.post("/chapters/{chapter_id}/shared", dependencies=[Depends(rate_limit("share", 10, 600))])
def share(chapter_id: uuid.UUID, body: SharedIn, user=Depends(current_user), db: Session = Depends(get_db)):
    ch = db.get(Chapter, chapter_id)
    if not ch:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, ch.course_id)
    if not body.rights_confirmed:
        raise HTTPException(400, "Confirm this is your own work or that you may share it (no textbook scans)")
    if body.kind == "video_url" and not body.url:
        raise HTTPException(400, "A video link needs a URL")
    if body.kind != "video_url" and not (body.body and body.body.strip()):
        raise HTTPException(400, "Write the content you want to share")
    r = SharedResource(course_id=ch.course_id, chapter_id=ch.id, author_id=user.id, kind=body.kind, title=body.title.strip(),
                       body=(body.body or "").strip() or None, url=str(body.url) if body.url else None, rights_confirmed=True)
    db.add(r)
    db.commit()
    return _shared(db, r, user)


@router.delete("/shared/{resource_id}")
def delete_shared(resource_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(SharedResource, resource_id)
    if not r or r.status != "active":
        raise HTTPException(404, "Not found")
    if r.author_id != user.id and role_of(user) != "admin":
        raise HTTPException(403, "Only the author can remove this")
    db.delete(r)
    db.commit()
    return {"ok": True}


class RateIn(BaseModel):
    helpful: bool | None


@router.post("/shared/{resource_id}/rate", dependencies=[Depends(rate_limit("rate", 60, 600))])
def rate(resource_id: uuid.UUID, body: RateIn, user=Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(SharedResource, resource_id)
    if not r or r.status != "active":
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, r.course_id)
    if r.author_id == user.id:
        raise HTTPException(400, "You can't rate your own resource")
    existing = db.get(ResourceRating, (user.id, r.id))
    if body.helpful is None:
        if existing:
            db.delete(existing)
    elif existing:
        existing.helpful = body.helpful
    else:
        db.add(ResourceRating(user_id=user.id, resource_id=r.id, helpful=body.helpful))
    db.commit()
    return _shared(db, r, user)


# ---------------------------------------------------------------- Resource Finder (real search only)
class FindIn(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    language: Literal["fr", "en", "ar", "derja"] = "fr"


@router.post("/courses/{course_id}/resource-finder", dependencies=[Depends(rate_limit("finder", 5, 300))])
def resource_finder(course_id: uuid.UUID, body: FindIn, user=Depends(current_user), db: Session = Depends(get_db)):
    get_readable_course(db, user, course_id)
    try:
        items = find_resources(body.topic, body.language)
    except MediaUnavailable as e:
        return {"available": False, "reason": str(e), "results": []}
    return {"available": True, "results": items,
            "reason": None if items else "No verified resource found for this topic."}


# ---------------------------------------------------------------- exam archive
class ExamIn(BaseModel):
    faculty: str = Field(min_length=2, max_length=160)
    subject: str = Field(min_length=2, max_length=160)
    year: int = Field(ge=1990, le=2100)
    session: Literal["principale", "contrôle", "DS"] = "principale"
    title: str = Field(min_length=3, max_length=300)
    content: str = Field(min_length=10, max_length=30_000)
    chapter_ids: list[uuid.UUID] = []
    rights_confirmed: bool


class CorrectionIn(BaseModel):
    body: str = Field(min_length=10, max_length=20_000)


class VoteIn(BaseModel):
    value: Literal[-1, 0, 1]


def _exam(db: Session, e: ExamPaper, user, full: bool = False) -> dict:
    out = {"id": str(e.id), "faculty": e.faculty, "subject": e.subject, "year": e.year, "session": e.session, "title": e.title,
           "chapter_ids": e.chapter_tags, "uploader": _name(db, e.uploader_id), "is_demo": e.is_demo,
           "corrections": db.scalar(select(func.count()).select_from(ExamCorrection).where(ExamCorrection.exam_id == e.id, ExamCorrection.status == "active"))}
    if full:
        out["content"] = e.content
        cors = db.scalars(select(ExamCorrection).where(ExamCorrection.exam_id == e.id, ExamCorrection.status == "active")).all()
        items = []
        for c in cors:
            score = db.scalar(select(func.coalesce(func.sum(ExamCorrectionVote.value), 0)).where(ExamCorrectionVote.correction_id == c.id))
            mine = db.get(ExamCorrectionVote, (user.id, c.id))
            items.append({"id": str(c.id), "body": c.body, "author": _name(db, c.author_id), "score": int(score), "my_vote": mine.value if mine else 0,
                          "mine": c.author_id == user.id, "at": c.created_at.isoformat()})
        out["correction_list"] = sorted(items, key=lambda x: -x["score"])
    return out


@router.get("/courses/{course_id}/exams")
def list_exams(course_id: uuid.UUID, year: int | None = None, q: str = "", user=Depends(current_user), db: Session = Depends(get_db)):
    get_readable_course(db, user, course_id)
    stmt = select(ExamPaper).where(ExamPaper.course_id == course_id, ExamPaper.status == "active")
    if year:
        stmt = stmt.where(ExamPaper.year == year)
    if q.strip():
        like = f"%{q.strip()[:60]}%"
        stmt = stmt.where(ExamPaper.title.ilike(like) | ExamPaper.subject.ilike(like) | ExamPaper.faculty.ilike(like))
    exams = db.scalars(stmt.order_by(ExamPaper.year.desc())).all()
    # plain-count chapter frequency over ALL papers of the course (not just the filtered ones)
    all_tags = Counter(t for e in db.scalars(select(ExamPaper).where(ExamPaper.course_id == course_id, ExamPaper.status == "active")) for t in e.chapter_tags)
    chapters = db.scalars(select(Chapter).where(Chapter.course_id == course_id).order_by(Chapter.ordinal)).all()
    return {"exams": [_exam(db, e, user) for e in exams],
            "chapter_frequency": [{"chapter_id": str(c.id), "chapter": c.title, "papers": all_tags.get(str(c.id), 0)} for c in chapters]}


@router.post("/courses/{course_id}/exams", dependencies=[Depends(rate_limit("exam", 5, 600))])
def add_exam(course_id: uuid.UUID, body: ExamIn, user=Depends(current_user), db: Session = Depends(get_db)):
    get_readable_course(db, user, course_id)
    if not body.rights_confirmed:
        raise HTTPException(400, "Confirm you are allowed to share this paper")
    valid = {str(c) for c in db.scalars(select(Chapter.id).where(Chapter.course_id == course_id))}
    e = ExamPaper(course_id=course_id, faculty=body.faculty, subject=body.subject, year=body.year, session=body.session, title=body.title,
                  content=body.content, uploader_id=user.id, rights_confirmed=True, chapter_tags=[str(c) for c in body.chapter_ids if str(c) in valid])
    db.add(e)
    db.commit()
    return _exam(db, e, user, full=True)


def _get_exam(db: Session, user, exam_id: uuid.UUID) -> ExamPaper:
    e = db.get(ExamPaper, exam_id)
    if not e or e.status != "active":
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, e.course_id)
    return e


@router.get("/exams/{exam_id}")
def get_exam(exam_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    return _exam(db, _get_exam(db, user, exam_id), user, full=True)


@router.post("/exams/{exam_id}/corrections", dependencies=[Depends(rate_limit("correction", 10, 600))])
def add_correction(exam_id: uuid.UUID, body: CorrectionIn, user=Depends(current_user), db: Session = Depends(get_db)):
    e = _get_exam(db, user, exam_id)
    db.add(ExamCorrection(exam_id=e.id, author_id=user.id, body=body.body.strip()))
    db.commit()
    return _exam(db, e, user, full=True)


@router.post("/exam-corrections/{correction_id}/vote", dependencies=[Depends(rate_limit("vote", 60, 600))])
def vote_correction(correction_id: uuid.UUID, body: VoteIn, user=Depends(current_user), db: Session = Depends(get_db)):
    c = db.get(ExamCorrection, correction_id)
    if not c:
        raise HTTPException(404, "Not found")
    e = _get_exam(db, user, c.exam_id)
    if c.author_id == user.id:
        raise HTTPException(400, "You can't vote on your own correction")
    v = db.get(ExamCorrectionVote, (user.id, c.id))
    if body.value == 0:
        if v:
            db.delete(v)
    elif v:
        v.value = body.value
    else:
        db.add(ExamCorrectionVote(user_id=user.id, correction_id=c.id, value=body.value))
    db.commit()
    return _exam(db, e, user, full=True)
