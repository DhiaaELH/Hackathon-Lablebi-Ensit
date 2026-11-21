from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import (
    Attempt,
    ConceptProgress,
    Course,
    ProgressEvent,
    Profile,
    StudentPreferences,
    TutorConversation,
    TutorMessage,
    User,
)
from ..security import (
    COOKIE_NAME,
    burn_password_check,
    create_session_token,
    current_user,
    hash_password,
    rate_limit,
    unique_username,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
Lang = Literal["fr", "en", "ar", "derja"]


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)
    locale: Lang = "fr"
    role: Literal["student", "teacher"] = "student"
    teacher_code: str | None = None


class LoginIn(BaseModel):
    email: str = Field(max_length=320)  # not validated as deliverable: demo accounts use the reserved .local TLD
    password: str = Field(max_length=128)


class PrefsIn(BaseModel):
    locale: Lang | None = None
    derja_script: Literal["arabic", "latin"] | None = None
    display_name: str | None = Field(default=None, max_length=80)
    searchable: bool | None = None
    message_setting: Literal["everyone", "followers", "nobody"] | None = None
    bio: str | None = Field(default=None, max_length=300)
    show_follows: bool | None = None
    faculty: str | None = Field(default=None, max_length=120)
    interests: list[str] | None = None
    current_subjects: list[str] | None = None


def me_payload(db: Session, user: User) -> dict:
    p = user.profile
    prefs = db.get(StudentPreferences, user.id)
    return {"id": str(user.id), "email": user.email, "role": p.role, "username": p.username, "display_name": p.display_name,
            "locale": p.locale, "derja_script": p.derja_script, "searchable": p.searchable, "message_setting": p.message_setting,
            "faculty": prefs.faculty if prefs else None, "interests": prefs.interests if prefs else [],
            "current_subjects": prefs.current_subjects if prefs else [], "is_demo": p.is_demo, "bio": p.bio, "show_follows": p.show_follows}


def _set_cookie(resp: Response, user: User) -> None:
    s = get_settings()
    resp.set_cookie(COOKIE_NAME, create_session_token(user.id), httponly=True, samesite="lax", secure=s.cookie_secure,
                    max_age=s.session_hours * 3600, path="/")


@router.post("/register", dependencies=[Depends(rate_limit("register", 5, 600))])
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)):
    email = body.email.lower()
    if body.role == "teacher" and body.teacher_code != get_settings().teacher_invite_code:
        raise HTTPException(403, "A valid teacher invitation code is required")
    if db.scalar(select(User.id).where(User.email == email)):
        # Generic message: avoid confirming which emails have accounts.
        raise HTTPException(400, "Could not create the account with these details")
    user = User(email=email, password_hash=hash_password(body.password))
    db.add(user)
    db.flush()
    db.add(Profile(user_id=user.id, role=body.role, username=unique_username(db, email.split("@")[0]), display_name=body.display_name.strip(), locale=body.locale))
    db.add(StudentPreferences(user_id=user.id, interests=[], current_subjects=[]))
    db.commit()
    db.refresh(user)
    _set_cookie(response, user)
    return me_payload(db, user)


@router.post("/login", dependencies=[Depends(rate_limit("login", 10, 300))])
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user:
        burn_password_check()
        raise HTTPException(401, "Incorrect email or password")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    _set_cookie(response, user)
    return me_payload(db, user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return me_payload(db, user)


@router.patch("/me")
def update_me(body: PrefsIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = user.profile
    for f in ("locale", "derja_script", "searchable", "message_setting", "bio", "show_follows"):
        v = getattr(body, f)
        if v is not None:
            setattr(p, f, v)
    if body.display_name:
        p.display_name = body.display_name.strip()
    prefs = db.get(StudentPreferences, user.id) or StudentPreferences(user_id=user.id)
    for f in ("faculty", "interests", "current_subjects"):
        v = getattr(body, f)
        if v is not None:
            setattr(prefs, f, [x[:80] for x in v][:20] if isinstance(v, list) else v)
    db.merge(prefs)
    db.commit()
    return me_payload(db, user)


@router.get("/me/export")
def export_me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Personal data export (JSON). Confusion signals are anonymous and cannot be linked back, so they are
    not included."""
    convs = db.scalars(select(TutorConversation.id).where(TutorConversation.user_id == user.id)).all()
    return {
        "profile": me_payload(db, user),
        "courses": [{"id": str(c.id), "title": c.title, "visibility": c.visibility} for c in db.scalars(select(Course).where(Course.owner_id == user.id))],
        "attempts": [{"assessment_id": str(a.assessment_id), "score": a.score, "max": a.max_score, "at": a.created_at.isoformat()}
                     for a in db.scalars(select(Attempt).where(Attempt.user_id == user.id))],
        "progress_events": [{"kind": e.kind, "ref": e.ref_id, "at": e.created_at.isoformat()} for e in db.scalars(select(ProgressEvent).where(ProgressEvent.user_id == user.id))],
        "concept_progress": [{"concept_id": str(c.concept_id), "correct": c.correct, "total": c.total} for c in db.scalars(select(ConceptProgress).where(ConceptProgress.user_id == user.id))],
        "tutor_messages": [{"role": m.role, "content": m.content, "at": m.created_at.isoformat()}
                           for m in db.scalars(select(TutorMessage).where(TutorMessage.conversation_id.in_(convs)))] if convs else [],
    }


@router.delete("/me")
def delete_me(response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Deletes the account and everything owned by it (courses, files' metadata, progress, messages).
    Anonymous signals remain because they cannot be linked to the account."""
    from pathlib import Path

    from ..models import Resource

    for r in db.scalars(select(Resource).where(Resource.owner_id == user.id)):
        if r.storage_path:
            Path(r.storage_path).unlink(missing_ok=True)
    db.delete(user)
    db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}
