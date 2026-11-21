"""Chapter-level community: threads, answers, votes, accepted answer, 'this chapter is hard', reports."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Chapter, ContentReport, HardChapterVote, Post, Profile, Thread, Vote
from ..security import current_user, get_readable_course, rate_limit, role_of

router = APIRouter(prefix="/api", tags=["community"])


def _chapter(db: Session, user, chapter_id: uuid.UUID) -> Chapter:
    ch = db.get(Chapter, chapter_id)
    if not ch:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, ch.course_id)
    return ch


def _author(db: Session, uid) -> dict:
    p = db.get(Profile, uid)
    return {"display_name": p.display_name if p else "?", "role": p.role if p else "student"}


class ThreadIn(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    body: str = Field(min_length=3, max_length=10_000)


class PostIn(BaseModel):
    body: str = Field(min_length=1, max_length=10_000)


class VoteIn(BaseModel):
    value: Literal[-1, 0, 1]


class ReportIn(BaseModel):
    target_type: Literal["thread", "post", "resource", "exam", "exam_correction", "question_correction", "user", "message"]
    target_id: str = Field(min_length=1, max_length=64)
    reason: str = Field(min_length=3, max_length=1000)


@router.get("/chapters/{chapter_id}/threads")
def list_threads(chapter_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    ch = _chapter(db, user, chapter_id)
    threads = db.scalars(select(Thread).where(Thread.chapter_id == ch.id).order_by(Thread.pinned.desc(), Thread.created_at.desc())).all()
    out = []
    for t in threads:
        n = db.scalar(select(func.count()).select_from(Post).where(Post.thread_id == t.id))
        solved = db.scalar(select(func.count()).select_from(Post).where(Post.thread_id == t.id, Post.accepted.is_(True)))
        out.append({"id": str(t.id), "title": t.title, "body": t.body, "author": _author(db, t.author_id), "replies": n, "solved": bool(solved),
                    "pinned": t.pinned, "is_demo": t.is_demo, "at": t.created_at.isoformat()})
    return out


@router.post("/chapters/{chapter_id}/threads", dependencies=[Depends(rate_limit("thread", 10, 600))])
def create_thread(chapter_id: uuid.UUID, body: ThreadIn, user=Depends(current_user), db: Session = Depends(get_db)):
    ch = _chapter(db, user, chapter_id)
    t = Thread(course_id=ch.course_id, chapter_id=ch.id, author_id=user.id, title=body.title.strip(), body=body.body.strip())
    db.add(t)
    db.commit()
    return {"id": str(t.id)}


@router.get("/threads/{thread_id}")
def get_thread(thread_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, t.course_id)
    posts = db.scalars(select(Post).where(Post.thread_id == t.id).order_by(Post.created_at)).all()
    scores = dict(db.execute(select(Vote.post_id, func.coalesce(func.sum(Vote.value), 0)).where(Vote.post_id.in_([p.id for p in posts])).group_by(Vote.post_id)).all())
    mine = dict(db.execute(select(Vote.post_id, Vote.value).where(Vote.user_id == user.id, Vote.post_id.in_([p.id for p in posts]))).all())
    items = [{"id": str(p.id), "body": p.body, "author": _author(db, p.author_id), "accepted": p.accepted, "score": int(scores.get(p.id, 0)),
              "my_vote": mine.get(p.id, 0), "at": p.created_at.isoformat()} for p in posts]
    items.sort(key=lambda x: (not x["accepted"], -x["score"], x["at"]))
    return {"id": str(t.id), "title": t.title, "body": t.body, "author": _author(db, t.author_id), "chapter_id": str(t.chapter_id),
            "can_accept": t.author_id == user.id or role_of(user) in ("teacher", "admin"), "posts": items, "is_demo": t.is_demo}


@router.post("/threads/{thread_id}/posts", dependencies=[Depends(rate_limit("post", 20, 600))])
def reply(thread_id: uuid.UUID, body: PostIn, user=Depends(current_user), db: Session = Depends(get_db)):
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, t.course_id)
    p = Post(thread_id=t.id, author_id=user.id, body=body.body.strip())
    db.add(p)
    db.commit()
    return {"id": str(p.id)}


def _post(db: Session, user, post_id: uuid.UUID) -> tuple[Post, Thread]:
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(404, "Not found")
    t = db.get(Thread, p.thread_id)
    get_readable_course(db, user, t.course_id)
    return p, t


@router.post("/posts/{post_id}/vote", dependencies=[Depends(rate_limit("vote", 60, 600))])
def vote(post_id: uuid.UUID, body: VoteIn, user=Depends(current_user), db: Session = Depends(get_db)):
    p, _ = _post(db, user, post_id)
    if p.author_id == user.id:
        raise HTTPException(400, "You cannot vote on your own answer")
    existing = db.get(Vote, (user.id, p.id))
    if body.value == 0:
        if existing:
            db.delete(existing)
    elif existing:
        existing.value = body.value
    else:
        db.add(Vote(user_id=user.id, post_id=p.id, value=body.value))
    db.commit()
    return {"ok": True}


@router.post("/posts/{post_id}/accept")
def accept(post_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    p, t = _post(db, user, post_id)
    if t.author_id != user.id and role_of(user) not in ("teacher", "admin"):
        raise HTTPException(403, "Only the question author or a teacher can accept an answer")
    for other in db.scalars(select(Post).where(Post.thread_id == t.id)):
        other.accepted = other.id == p.id
    db.commit()
    return {"ok": True}


@router.post("/chapters/{chapter_id}/hard")
def toggle_hard(chapter_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    ch = _chapter(db, user, chapter_id)
    existing = db.get(HardChapterVote, (user.id, ch.id))
    if existing:
        db.delete(existing)
    else:
        db.add(HardChapterVote(user_id=user.id, chapter_id=ch.id))
    db.commit()
    count = db.scalar(select(func.count()).select_from(HardChapterVote).where(HardChapterVote.chapter_id == ch.id))
    return {"voted": not existing, "count": count}


@router.post("/reports", dependencies=[Depends(rate_limit("report", 10, 600))])
def report(body: ReportIn, user=Depends(current_user), db: Session = Depends(get_db)):
    db.add(ContentReport(reporter_id=user.id, target_type=body.target_type, target_id=str(body.target_id), reason=body.reason))
    db.commit()
    return {"ok": True}
