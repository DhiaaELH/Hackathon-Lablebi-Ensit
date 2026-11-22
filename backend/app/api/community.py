"""Chapter-level community: threads, answers, votes, accepted answer, 'this chapter is hard', reports."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Chapter, ContentReport, Course, CourseMember, HardChapterVote, Post, Profile, Thread, Vote
from ..security import course_access, current_user, get_readable_course, rate_limit, role_of

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


STAFF = ("senior", "teacher", "admin")  # peer tutors and teachers help run the discussions


def _can_remove(db: Session, user, t: Thread, author_id) -> bool:
    """Authors remove their own content; admins anything; a teacher anything in a course they own or teach."""
    if author_id == user.id or role_of(user) == "admin":
        return True
    if role_of(user) != "teacher":
        return False
    course = db.get(Course, t.course_id)
    return bool(course) and course_access(db, user, course) in ("owner", "teacher")


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


@router.get("/community/feed")
def community_feed(course_id: uuid.UUID | None = None, user=Depends(current_user), db: Session = Depends(get_db)):
    """Latest discussions across the courses on the user's dashboard (owned or joined), most recently active first."""
    member_ids = select(CourseMember.course_id).where(CourseMember.user_id == user.id)
    mine = select(Course.id).where(or_(Course.owner_id == user.id, Course.id.in_(member_ids)))
    agg = (select(Post.thread_id, func.count().label("n"), func.bool_or(Post.accepted).label("solved"),
                  func.max(Post.created_at).label("last_at")).group_by(Post.thread_id).subquery())
    last = func.coalesce(agg.c.last_at, Thread.created_at)
    stmt = (select(Thread, Course.title, Chapter.title, agg.c.n, agg.c.solved, last)
            .join(Course, Course.id == Thread.course_id).join(Chapter, Chapter.id == Thread.chapter_id)
            .outerjoin(agg, agg.c.thread_id == Thread.id).where(Thread.course_id.in_(mine)))
    if course_id:
        stmt = stmt.where(Thread.course_id == course_id)
    rows = db.execute(stmt.order_by(last.desc()).limit(80)).all()
    return [{"id": str(t.id), "title": t.title, "body": t.body, "author": _author(db, t.author_id), "replies": int(n or 0),
             "solved": bool(solved), "pinned": t.pinned, "is_demo": t.is_demo, "at": t.created_at.isoformat(),
             "last_at": last_at.isoformat(), "course_id": str(t.course_id), "course_title": ctitle,
             "chapter_id": str(t.chapter_id), "chapter_title": chtitle}
            for t, ctitle, chtitle, n, solved, last_at in rows]


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
              "my_vote": mine.get(p.id, 0), "at": p.created_at.isoformat(),
              "can_delete": _can_remove(db, user, t, p.author_id)} for p in posts]
    items.sort(key=lambda x: (not x["accepted"], -x["score"], x["at"]))
    return {"id": str(t.id), "title": t.title, "body": t.body, "author": _author(db, t.author_id), "chapter_id": str(t.chapter_id),
            "can_accept": t.author_id == user.id or role_of(user) in STAFF, "posts": items, "is_demo": t.is_demo,
            "pinned": t.pinned, "can_pin": role_of(user) in STAFF, "can_delete": _can_remove(db, user, t, t.author_id)}


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
    # The asker decides; peer tutors and teachers may also settle a thread, but never by accepting their own answer.
    if t.author_id != user.id and (role_of(user) not in STAFF or p.author_id == user.id):
        raise HTTPException(403, "Only the question author, a peer tutor or a teacher can accept an answer (not your own)")
    for other in db.scalars(select(Post).where(Post.thread_id == t.id)):
        other.accepted = other.id == p.id
    db.commit()
    return {"ok": True}


@router.delete("/posts/{post_id}")
def delete_post(post_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    p, t = _post(db, user, post_id)
    if not _can_remove(db, user, t, p.author_id):
        raise HTTPException(403, "You cannot remove this answer")
    db.delete(p)
    db.commit()
    return {"ok": True}


def _thread(db: Session, user, thread_id: uuid.UUID) -> Thread:
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, t.course_id)
    return t


@router.delete("/threads/{thread_id}")
def delete_thread(thread_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    t = _thread(db, user, thread_id)
    if not _can_remove(db, user, t, t.author_id):
        raise HTTPException(403, "You cannot remove this discussion")
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.post("/threads/{thread_id}/pin")
def pin_thread(thread_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    t = _thread(db, user, thread_id)
    if role_of(user) not in STAFF:
        raise HTTPException(403, "Only peer tutors and teachers can pin a discussion")
    t.pinned = not t.pinned
    db.commit()
    return {"pinned": t.pinned}


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
