import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Notification, Section, TeacherResponse
from ..security import current_user, get_readable_course, get_teachable_course, rate_limit
from ..services.insights import REASONS, post_teacher_response, record_signal, teacher_dashboard

router = APIRouter(prefix="/api", tags=["insights"])


class SignalIn(BaseModel):
    reasons: list[Literal["vocabulary", "missing_prerequisite", "too_fast", "need_example", "exercise_too_hard"]] = []
    notify: bool = False


@router.post("/sections/{section_id}/confusion", dependencies=[Depends(rate_limit("signal", 20, 600))])
def signal(section_id: uuid.UUID, body: SignalIn, user=Depends(current_user), db: Session = Depends(get_db)):
    s = db.get(Section, section_id)
    if not s:
        raise HTTPException(404, "Not found")
    get_readable_course(db, user, s.course_id)
    created = record_signal(db, user.id, s, body.reasons, body.notify)
    return {"recorded": created, "already_signalled": not created,
            "anonymity": "Your teacher only sees totals once at least 5 different students signal the same part. "
                         "Your name and account are never attached to the signal. Only the day is stored, not the time."}


@router.get("/insights/reasons")
def reasons():
    return REASONS


@router.get("/courses/{course_id}/insights")
def dashboard(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    get_teachable_course(db, user, course_id)
    return teacher_dashboard(db, course_id)


class ResponseIn(BaseModel):
    section_id: uuid.UUID | None = None
    kind: Literal["clarification", "extra_exercise", "next_session", "pinned_answer"]
    body: str = Field(min_length=3, max_length=5000)


@router.post("/courses/{course_id}/teacher-responses")
def respond(course_id: uuid.UUID, body: ResponseIn, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_teachable_course(db, user, course_id)
    section = db.get(Section, body.section_id) if body.section_id else None
    if body.section_id and (not section or section.course_id != course.id):
        raise HTTPException(404, "Section not found")
    r = post_teacher_response(db, user.id, course.id, section, body.kind, body.body)
    return {"id": str(r.id)}


@router.get("/courses/{course_id}/teacher-responses")
def responses(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    get_readable_course(db, user, course_id)
    rows = db.scalars(select(TeacherResponse).where(TeacherResponse.course_id == course_id).order_by(TeacherResponse.created_at.desc())).all()
    return [{"id": str(r.id), "section_id": str(r.section_id) if r.section_id else None, "kind": r.kind, "body": r.body, "at": r.created_at.isoformat()} for r in rows]


@router.get("/notifications")
def notifications(user=Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50)).all()
    return [{"id": str(n.id), "kind": n.kind, "title": n.title, "body": n.body, "link": n.link, "read": n.read_at is not None,
             "at": n.created_at.isoformat()} for n in rows]


@router.post("/notifications/{notification_id}/read")
def mark_read(notification_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    from datetime import datetime, timezone

    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Not found")
    n.read_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
