"""Minimal moderation console for the admin/moderator role."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Attempt, ContentReport, Course, Resource, User, ExamCorrection, ExamPaper, Message, Post, Profile, QuestionCorrection, SharedResource, Thread
from ..security import require_roles

router = APIRouter(prefix="/api/admin", tags=["moderation"])
admin_only = require_roles("admin")


def _preview(db: Session, ttype: str, tid: str) -> str | None:
    try:
        uid = uuid.UUID(tid)
    except ValueError:
        return None
    model = {"thread": Thread, "post": Post, "resource": SharedResource, "exam": ExamPaper, "exam_correction": ExamCorrection,
             "question_correction": QuestionCorrection, "message": Message}.get(ttype)
    if model is None:
        if ttype == "user":
            p = db.get(Profile, uid)
            return p.display_name if p else None
        return None
    obj = db.get(model, uid)
    if not obj:
        return None
    return (getattr(obj, "title", None) or getattr(obj, "body", None) or "")[:300]


@router.get("/reports")
def reports(status: str = "open", user=Depends(admin_only), db: Session = Depends(get_db)):
    rows = db.scalars(select(ContentReport).where(ContentReport.status == status).order_by(ContentReport.created_at.desc()).limit(100)).all()
    return [{"id": str(r.id), "target_type": r.target_type, "target_id": r.target_id, "reason": r.reason, "status": r.status,
             "preview": _preview(db, r.target_type, r.target_id), "at": r.created_at.isoformat()} for r in rows]


class ResolveIn(BaseModel):
    action: Literal["dismiss", "remove"]


@router.post("/reports/{report_id}")
def resolve(report_id: uuid.UUID, body: ResolveIn, user=Depends(admin_only), db: Session = Depends(get_db)):
    r = db.get(ContentReport, report_id)
    if not r:
        raise HTTPException(404, "Not found")
    if body.action == "remove":
        tid = uuid.UUID(r.target_id)
        if r.target_type in ("thread", "post", "message"):
            obj = db.get({"thread": Thread, "post": Post, "message": Message}[r.target_type], tid)
            if obj:
                db.delete(obj)
        elif r.target_type in ("resource", "exam", "exam_correction", "question_correction"):
            obj = db.get({"resource": SharedResource, "exam": ExamPaper, "exam_correction": ExamCorrection,
                          "question_correction": QuestionCorrection}[r.target_type], tid)
            if obj:
                obj.status = "removed"
        else:
            raise HTTPException(400, "This type can only be dismissed")
    for other in db.scalars(select(ContentReport).where(ContentReport.target_id == r.target_id, ContentReport.status == "open")):
        other.status = "removed" if body.action == "remove" else "dismissed"
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- accounts & platform (admin only)
class RoleIn(BaseModel):
    role: Literal["student", "senior", "teacher", "admin"]


def _user_out(db: Session, u: User, p: Profile) -> dict:
    return {"username": p.username, "display_name": p.display_name, "email": u.email, "role": p.role, "is_demo": p.is_demo,
            "courses": db.scalar(select(func.count()).select_from(Course).where(Course.owner_id == u.id)), "created_at": u.created_at.isoformat()}


@router.get("/users")
def list_users(q: str = "", role: str = "", user=Depends(admin_only), db: Session = Depends(get_db)):
    stmt = select(User, Profile).join(Profile, Profile.user_id == User.id)
    if q.strip():
        like = f"%{q.strip()[:80]}%"
        stmt = stmt.where(or_(Profile.username.ilike(like), Profile.display_name.ilike(like), User.email.ilike(like)))
    if role in ("student", "senior", "teacher", "admin"):
        stmt = stmt.where(Profile.role == role)
    return [_user_out(db, u, p) for u, p in db.execute(stmt.order_by(User.created_at.desc()).limit(200)).all()]


def _target(db: Session, username: str) -> tuple[User, Profile]:
    p = db.scalar(select(Profile).where(Profile.username == username))
    if not p:
        raise HTTPException(404, "Not found")
    return db.get(User, p.user_id), p


def _keep_one_admin(db: Session, p: Profile) -> None:
    if p.role == "admin" and db.scalar(select(func.count()).select_from(Profile).where(Profile.role == "admin")) <= 1:
        raise HTTPException(400, "This is the last admin account")


@router.patch("/users/{username}")
def set_role(username: str, body: RoleIn, user=Depends(admin_only), db: Session = Depends(get_db)):
    u, p = _target(db, username)
    if body.role != p.role:
        if body.role != "admin":
            _keep_one_admin(db, p)
        p.role = body.role
        db.commit()
    return _user_out(db, u, p)


@router.delete("/users/{username}")
def delete_user(username: str, user=Depends(admin_only), db: Session = Depends(get_db)):
    from pathlib import Path

    u, p = _target(db, username)
    if u.id == user.id:
        raise HTTPException(400, "Delete your own account from Settings")
    _keep_one_admin(db, p)
    for r in db.scalars(select(Resource).where(Resource.owner_id == u.id)):
        if r.storage_path:
            Path(r.storage_path).unlink(missing_ok=True)
    db.delete(u)
    db.commit()
    return {"ok": True}


@router.get("/stats")
def stats(user=Depends(admin_only), db: Session = Depends(get_db)):
    by_role = dict(db.execute(select(Profile.role, func.count()).group_by(Profile.role)).all())

    def count(stmt) -> int:
        return db.scalar(stmt) or 0

    return {"users": {r: by_role.get(r, 0) for r in ("student", "senior", "teacher", "admin")},
            "courses": count(select(func.count()).select_from(Course)),
            "published": count(select(func.count()).select_from(Course).where(Course.visibility == "published")),
            "attempts": count(select(func.count()).select_from(Attempt)),
            "open_reports": count(select(func.count()).select_from(ContentReport).where(ContentReport.status == "open"))}
