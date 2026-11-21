"""Minimal moderation console for the admin/moderator role."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ContentReport, ExamCorrection, ExamPaper, Message, Post, Profile, QuestionCorrection, SharedResource, Thread
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
