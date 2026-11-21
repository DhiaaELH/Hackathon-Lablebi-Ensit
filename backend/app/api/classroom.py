"""Classroom management for teachers: the roster of a course they own or teach, and class announcements."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Course, CourseMember, Notification, Profile, User
from ..security import current_user, get_teachable_course, rate_limit

router = APIRouter(prefix="/api", tags=["classroom"])


class MemberIn(BaseModel):
    identifier: str = Field(min_length=2, max_length=320)  # username or e-mail
    member_role: Literal["student", "teacher"] = "student"


class AnnounceIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(default="", max_length=2000)


def _roster(db: Session, course: Course) -> list[dict]:
    rows = db.execute(select(CourseMember, Profile).join(Profile, Profile.user_id == CourseMember.user_id)
                      .where(CourseMember.course_id == course.id).order_by(Profile.display_name)).all()
    return [{"username": p.username, "display_name": p.display_name, "role": p.role, "member_role": m.member_role} for m, p in rows]


def _find_profile(db: Session, identifier: str) -> Profile | None:
    ident = identifier.strip().lstrip("@").lower()
    if "@" in ident:
        u = db.scalar(select(User).where(func.lower(User.email) == ident))
        return u.profile if u else None
    return db.scalar(select(Profile).where(func.lower(Profile.username) == ident))


@router.get("/courses/{course_id}/members")
def list_members(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_teachable_course(db, user, course_id)
    return _roster(db, course)


@router.post("/courses/{course_id}/members", dependencies=[Depends(rate_limit("roster", 60, 600))])
def add_member(course_id: uuid.UUID, body: MemberIn, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_teachable_course(db, user, course_id)
    p = _find_profile(db, body.identifier)
    if not p:
        raise HTTPException(404, "No account matches this username or e-mail")
    if p.user_id == course.owner_id:
        raise HTTPException(400, "The course owner is already part of the class")
    if body.member_role == "teacher":
        if course.owner_id != user.id:
            raise HTTPException(403, "Only the course owner can add a co-teacher")
        if p.role not in ("teacher", "admin"):
            raise HTTPException(400, "Only teacher accounts can be added as co-teachers")
    m = db.get(CourseMember, (course.id, p.user_id))
    if m:
        m.member_role = body.member_role
    else:
        db.add(CourseMember(course_id=course.id, user_id=p.user_id, member_role=body.member_role))
        db.add(Notification(user_id=p.user_id, kind="class_added", title=f"{user.profile.display_name} → {course.title}",
                            body="You were added to this class.", link=f"/courses/{course.id}"))
    db.commit()
    return _roster(db, course)


@router.delete("/courses/{course_id}/members/{username}")
def remove_member(course_id: uuid.UUID, username: str, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_teachable_course(db, user, course_id)
    p = db.scalar(select(Profile).where(Profile.username == username))
    m = db.get(CourseMember, (course.id, p.user_id)) if p else None
    if not m:
        raise HTTPException(404, "Not a member of this class")
    if m.member_role == "teacher" and course.owner_id != user.id and p.user_id != user.id:
        raise HTTPException(403, "Only the course owner can remove a co-teacher")
    db.delete(m)
    db.commit()
    return _roster(db, course)


@router.post("/courses/{course_id}/announcements", dependencies=[Depends(rate_limit("announce", 10, 600))])
def announce(course_id: uuid.UUID, body: AnnounceIn, user=Depends(current_user), db: Session = Depends(get_db)):
    """Send a notification to every member of the class."""
    course = get_teachable_course(db, user, course_id)
    ids = [i for i in db.scalars(select(CourseMember.user_id).where(CourseMember.course_id == course.id)) if i != user.id]
    for uid in ids:
        db.add(Notification(user_id=uid, kind="announcement", title=f"{course.title}: {body.title.strip()}"[:300], body=body.body.strip(),
                            link=f"/courses/{course.id}"))
    db.commit()
    return {"sent": len(ids)}
