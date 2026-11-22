"""Gamified challenges: teachers, peer tutors and admins publish tasks/projects in a course; students submit their
work, an AI grader scores it, and passing earns XP. XP feeds levels and a global leaderboard.

Anti-farming: authors cannot submit to their own challenge, MAX_ATTEMPTS per challenge, rate-limited submissions,
and a challenge's XP counts once per student (best passing attempt)."""
import math
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..agents import roles
from ..db import get_db
from ..models import Challenge, ChallengeSubmission, Chapter, Course, Profile
from ..security import course_access, current_user, get_readable_course, rate_limit, readable_course_ids, role_of

router = APIRouter(prefix="/api", tags=["challenges"])

PUBLISHERS = ("senior", "teacher", "admin")
XP_CHOICES = (10, 25, 50, 100, 200)
MAX_ATTEMPTS = 3
PASS_SCORE = 60


def level_for(xp: int) -> dict:
    """Level n starts at 50*n*(n-1) XP: 0, 100, 300, 600, 1000, 1500..."""
    n = int((1 + math.sqrt(1 + 8 * max(0, xp) / 100)) / 2)
    start, nxt = 50 * n * (n - 1), 50 * (n + 1) * n
    return {"level": n, "xp": xp, "level_start": start, "next_level_at": nxt}


def _can_publish_in(db: Session, user, course: Course) -> bool:
    r = role_of(user)
    if r == "admin":
        return True
    access = course_access(db, user, course)
    if r == "teacher":
        return access in ("owner", "teacher")
    if r == "senior":
        return access is not None
    return False


def _can_manage(db: Session, user, ch: Challenge) -> bool:
    if ch.author_id == user.id or role_of(user) == "admin":
        return True
    course = db.get(Course, ch.course_id)
    return role_of(user) == "teacher" and bool(course) and course_access(db, user, course) in ("owner", "teacher")


def _name(db: Session, uid) -> dict:
    p = db.get(Profile, uid)
    return {"display_name": p.display_name if p else "?", "role": p.role if p else "student"}


def _best_xp_per_challenge():
    """(user_id, challenge_id, best xp) over live challenges."""
    return (select(ChallengeSubmission.user_id, ChallengeSubmission.challenge_id, func.max(ChallengeSubmission.xp_awarded).label("xp"))
            .join(Challenge, Challenge.id == ChallengeSubmission.challenge_id).where(Challenge.archived.is_(False))
            .group_by(ChallengeSubmission.user_id, ChallengeSubmission.challenge_id).subquery())


def _total_xp(db: Session, user_id) -> tuple[int, int]:
    best = _best_xp_per_challenge()
    row = db.execute(select(func.coalesce(func.sum(best.c.xp), 0), func.count().filter(best.c.xp > 0)).where(best.c.user_id == user_id)).one()
    return int(row[0]), int(row[1])


def _out(db: Session, user, ch: Challenge, course_titles: dict, chapter_titles: dict) -> dict:
    subs = db.scalars(select(ChallengeSubmission).where(ChallengeSubmission.challenge_id == ch.id, ChallengeSubmission.user_id == user.id)
                      .order_by(ChallengeSubmission.created_at.desc())).all()
    best = max(subs, key=lambda s: (s.xp_awarded, s.score), default=None)
    manage = _can_manage(db, user, ch)
    return {"id": str(ch.id), "course_id": str(ch.course_id), "course_title": course_titles.get(ch.course_id, ""),
            "chapter_id": str(ch.chapter_id) if ch.chapter_id else None, "chapter_title": chapter_titles.get(ch.chapter_id),
            "kind": ch.kind, "title": ch.title, "instructions": ch.instructions, "criteria": ch.criteria, "xp": ch.xp,
            "due_at": ch.due_at.isoformat() if ch.due_at else None, "created_at": ch.created_at.isoformat(),
            "author": _name(db, ch.author_id), "mine": ch.author_id == user.id, "can_manage": manage,
            "attempts": len(subs), "attempts_left": 0 if ch.author_id == user.id else max(0, MAX_ATTEMPTS - len(subs)),
            "best_score": best.score if best else None, "passed": bool(best and best.passed), "xp_earned": best.xp_awarded if best else 0,
            "my_submissions": [{"id": str(s.id), "score": s.score, "passed": s.passed, "xp_awarded": s.xp_awarded, "answer": s.answer,
                                "link": s.link, "grading": s.grading, "at": s.created_at.isoformat()} for s in subs],
            "submissions_count": db.scalar(select(func.count()).select_from(ChallengeSubmission).where(ChallengeSubmission.challenge_id == ch.id))
            if manage else None}


@router.get("/challenges")
def list_challenges(course_id: uuid.UUID | None = None, user=Depends(current_user), db: Session = Depends(get_db)):
    """Live challenges in the courses on my dashboard (owned or joined)."""
    ids = readable_course_ids(db, user)
    if course_id:
        ids = [i for i in ids if i == course_id]
    rows = db.scalars(select(Challenge).where(Challenge.course_id.in_(ids or [uuid.uuid4()]), Challenge.archived.is_(False))
                      .order_by(Challenge.created_at.desc())).all()
    courses = {c.id: c.title.replace("[DÉMO] ", "") for c in db.scalars(select(Course).where(Course.id.in_({r.course_id for r in rows} or {uuid.uuid4()})))}
    chapters = {c.id: c.title for c in db.scalars(select(Chapter).where(Chapter.id.in_({r.chapter_id for r in rows if r.chapter_id} or {uuid.uuid4()})))}
    xp, passed = _total_xp(db, user.id)
    return {"me": {**level_for(xp), "passed": passed}, "can_publish": role_of(user) in PUBLISHERS,
            "pass_score": PASS_SCORE, "max_attempts": MAX_ATTEMPTS,
            "challenges": [_out(db, user, c, courses, chapters) for c in rows]}


@router.get("/challenges/publishable-courses")
def publishable_courses(user=Depends(current_user), db: Session = Depends(get_db)):
    if role_of(user) not in PUBLISHERS:
        return []
    ids = set(readable_course_ids(db, user))
    if role_of(user) == "admin":
        ids |= set(db.scalars(select(Course.id).where(Course.visibility == "published")))
    out = []
    for c in db.scalars(select(Course).where(Course.id.in_(ids or {uuid.uuid4()})).order_by(Course.created_at.desc())):
        if _can_publish_in(db, user, c):
            chs = db.scalars(select(Chapter).where(Chapter.course_id == c.id).order_by(Chapter.ordinal)).all()
            out.append({"id": str(c.id), "title": c.title.replace("[DÉMO] ", ""), "chapters": [{"id": str(h.id), "title": h.title} for h in chs]})
    return out


class ChallengeIn(BaseModel):
    course_id: uuid.UUID
    chapter_id: uuid.UUID | None = None
    kind: Literal["task", "project"] = "task"
    title: str = Field(min_length=3, max_length=200)
    instructions: str = Field(min_length=10, max_length=8000)
    criteria: list[str] = Field(min_length=1, max_length=8)
    xp: int = 50
    due_at: datetime | None = None


@router.post("/challenges", dependencies=[Depends(rate_limit("challenge_new", 20, 3600))])
def create_challenge(body: ChallengeIn, user=Depends(current_user), db: Session = Depends(get_db)):
    if role_of(user) not in PUBLISHERS:
        raise HTTPException(403, "Only teachers, peer tutors and admins can publish challenges")
    course = get_readable_course(db, user, body.course_id)
    if not _can_publish_in(db, user, course):
        raise HTTPException(403, "You cannot publish challenges in this course")
    if body.chapter_id:
        ch = db.get(Chapter, body.chapter_id)
        if not ch or ch.course_id != course.id:
            raise HTTPException(400, "This chapter is not part of the course")
    if body.xp not in XP_CHOICES:
        raise HTTPException(400, f"XP must be one of {XP_CHOICES}")
    criteria = [c.strip()[:300] for c in body.criteria if c.strip()]
    if not criteria:
        raise HTTPException(400, "Add at least one success criterion")
    c = Challenge(course_id=course.id, chapter_id=body.chapter_id, author_id=user.id, kind=body.kind, title=body.title.strip(),
                  instructions=body.instructions.strip(), criteria=criteria, xp=body.xp, due_at=body.due_at)
    db.add(c)
    db.commit()
    return {"id": str(c.id)}


@router.delete("/challenges/{challenge_id}")
def archive_challenge(challenge_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    ch = db.get(Challenge, challenge_id)
    if not ch or ch.archived:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, ch.course_id)
    if not _can_manage(db, user, ch):
        raise HTTPException(403, "Not allowed")
    ch.archived = True  # soft delete: its XP leaves the leaderboard, submissions stay for the record
    db.commit()
    return {"ok": True}


class SubmissionIn(BaseModel):
    answer: str = Field(min_length=30, max_length=10_000)
    link: str | None = Field(default=None, max_length=500)
    language: str | None = None


@router.post("/challenges/{challenge_id}/submit", dependencies=[Depends(rate_limit("challenge_submit", 10, 600))])
def submit(challenge_id: uuid.UUID, body: SubmissionIn, user=Depends(current_user), db: Session = Depends(get_db)):
    from ..llm.provider import LLMError

    ch = db.get(Challenge, challenge_id)
    if not ch or ch.archived:
        raise HTTPException(404, "Not found")
    course = get_readable_course(db, user, ch.course_id)
    if ch.course_id not in set(readable_course_ids(db, user)):
        raise HTTPException(403, "Join the course first")
    if ch.author_id == user.id:
        raise HTTPException(400, "You cannot submit to your own challenge")
    if ch.due_at and ch.due_at < datetime.now(timezone.utc):
        raise HTTPException(400, "This challenge is closed")
    prev = db.scalars(select(ChallengeSubmission).where(ChallengeSubmission.challenge_id == ch.id, ChallengeSubmission.user_id == user.id)).all()
    if len(prev) >= MAX_ATTEMPTS:
        raise HTTPException(400, f"No attempts left ({MAX_ATTEMPTS} max)")
    link = (body.link or "").strip() or None
    if link and not link.startswith(("http://", "https://")):
        raise HTTPException(400, "The link must start with http:// or https://")
    try:
        grading, demo = roles.grade_challenge(db, course, {"kind": ch.kind, "title": ch.title, "instructions": ch.instructions, "criteria": ch.criteria},
                                              body.answer.strip(), link, body.language or user.profile.locale, user.profile.derja_script)
    except LLMError as e:
        raise HTTPException(503, f"Grading is unavailable right now ({e}). Your work was not counted as an attempt; try again.")
    grading["demo"] = demo
    passed = grading["score"] >= PASS_SCORE
    xp = round(ch.xp * grading["score"] / 100) if passed else 0
    best_before = max((p.xp_awarded for p in prev), default=0)
    db.add(ChallengeSubmission(challenge_id=ch.id, user_id=user.id, answer=body.answer.strip(), link=link, score=grading["score"],
                               passed=passed, xp_awarded=xp, grading=grading))
    db.commit()
    total, _ = _total_xp(db, user.id)
    return {**grading, "passed": passed, "xp_awarded": xp, "xp_gained": max(0, xp - best_before),
            "attempts_left": MAX_ATTEMPTS - len(prev) - 1, "me": level_for(total)}


@router.get("/challenges/{challenge_id}/submissions")
def submissions(challenge_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    """For the challenge's author, course teachers and admins: every submission with its AI grade."""
    ch = db.get(Challenge, challenge_id)
    if not ch:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, ch.course_id)
    if not _can_manage(db, user, ch):
        raise HTTPException(403, "Not allowed")
    rows = db.scalars(select(ChallengeSubmission).where(ChallengeSubmission.challenge_id == ch.id).order_by(ChallengeSubmission.created_at.desc())).all()
    return [{"id": str(s.id), "student": _name(db, s.user_id), "score": s.score, "passed": s.passed, "xp_awarded": s.xp_awarded,
             "answer": s.answer, "link": s.link, "feedback": s.grading.get("feedback", ""), "at": s.created_at.isoformat()} for s in rows]


@router.get("/leaderboard")
def leaderboard(limit: int = 50, user=Depends(current_user), db: Session = Depends(get_db)):
    """Global XP ranking. Names are shown only for profiles that opted into being findable; others appear anonymised."""
    best = _best_xp_per_challenge()
    totals = (select(best.c.user_id, func.sum(best.c.xp).label("xp"), func.count().filter(best.c.xp > 0).label("passed"))
              .group_by(best.c.user_id).having(func.sum(best.c.xp) > 0).subquery())
    rows = db.execute(select(totals.c.user_id, totals.c.xp, totals.c.passed, Profile)
                      .join(Profile, Profile.user_id == totals.c.user_id).order_by(totals.c.xp.desc(), Profile.display_name)).all()
    out, me = [], None
    for i, (uid, xp, passed, p) in enumerate(rows, start=1):
        mine = uid == user.id
        visible = mine or p.searchable
        item = {"rank": i, "me": mine, "display_name": p.display_name if visible else None, "username": p.username if visible else None,
                "role": p.role, "xp": int(xp), "passed": int(passed), "level": level_for(int(xp))["level"]}
        if mine:
            me = item
        if i <= max(1, min(limit, 200)):
            out.append(item)
    if me is None:
        xp, passed = _total_xp(db, user.id)
        me = {"rank": None, "me": True, "display_name": user.profile.display_name, "username": user.profile.username, "role": user.profile.role,
              "xp": xp, "passed": passed, "level": level_for(xp)["level"]}
    return {"top": out, "me": me, "players": len(rows)}
