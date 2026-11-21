"""Authentication, authorization and abuse controls. All checks run server-side."""
import hashlib
import hmac
import threading
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import Course, CourseMember, Profile, User

COOKIE_NAME = "lf_session"
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "lessonforge"


# ---------------------------------------------------------------- passwords & tokens
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


_DUMMY_HASH = hash_password("timing-equalizer")


def burn_password_check() -> None:
    """Equalise timing for unknown emails so login does not leak account existence."""
    verify_password("x", _DUMMY_HASH)


def create_session_token(user_id: uuid.UUID) -> str:
    s = get_settings()
    payload = {"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(hours=s.session_hours)}
    return jwt.encode(payload, s.secret_key, algorithm="HS256")


def decode_session_token(token: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def signal_token(user_id: uuid.UUID, scope_id: uuid.UUID) -> str:
    """Keyed pseudonymous token. Only server code holding SIGNAL_HMAC_KEY can recompute it."""
    key = get_settings().signal_hmac_key.encode()
    return hmac.new(key, f"{user_id}|{scope_id}".encode(), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------- current user
def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.lower().startswith("bearer ") else None
    user_id = decode_session_token(token) if token else None
    user = db.get(User, user_id) if user_id else None
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return user


def role_of(user: User) -> str:
    return user.profile.role if user.profile else "student"


def require_roles(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if role_of(user) not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed for your role")
        return user

    return dep


# ---------------------------------------------------------------- course access
def course_access(db: Session, user: User, course: Course) -> str | None:
    """Returns 'owner' | 'teacher' | 'member' | 'public' | None."""
    if course.owner_id == user.id:
        return "owner"
    m = db.get(CourseMember, (course.id, user.id))
    if m:
        return "teacher" if m.member_role == "teacher" else "member"
    if course.visibility == "published":
        return "public"
    return None


def get_readable_course(db: Session, user: User, course_id: uuid.UUID) -> Course:
    course = db.get(Course, course_id)
    # 404 (not 403) for private courses so their existence is not revealed.
    if not course or not course_access(db, user, course):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    return course


def get_owned_course(db: Session, user: User, course_id: uuid.UUID) -> Course:
    course = get_readable_course(db, user, course_id)
    if course.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the course owner can do this")
    return course


def get_teachable_course(db: Session, user: User, course_id: uuid.UUID) -> Course:
    course = get_readable_course(db, user, course_id)
    access = course_access(db, user, course)
    if role_of(user) not in ("teacher", "admin") or access not in ("owner", "teacher"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Teacher access required for this course")
    return course


def readable_course_ids(db: Session, user: User) -> list[uuid.UUID]:
    owned = select(Course.id).where(Course.owner_id == user.id)
    member = select(CourseMember.course_id).where(CourseMember.user_id == user.id)
    return list(db.scalars(owned.union(member)))


def unique_username(db: Session, base: str) -> str:
    base = "".join(c for c in base.lower() if c.isalnum() or c in "_.")[:30] or "student"
    name, i = base, 1
    while db.scalar(select(Profile.user_id).where(Profile.username == name)):
        i += 1
        name = f"{base}{i}"
    return name


# ---------------------------------------------------------------- rate limiting (in-process)
class RateLimiter:
    """Sliding-window limiter. In-memory is fine for a single-process demo; swap for Redis when scaling."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self.enabled = True

    def check(self, key: str, limit: int, window_s: int) -> None:
        if not self.enabled:
            return
        now_t = time.monotonic()
        with self._lock:
            hits = [t for t in self._hits[key] if now_t - t < window_s]
            if len(hits) >= limit:
                raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests, slow down")
            hits.append(now_t)
            self._hits[key] = hits


limiter = RateLimiter()


def rate_limit(bucket: str, limit: int, window_s: int = 60):
    def dep(request: Request) -> None:
        who = request.cookies.get(COOKIE_NAME, "")[-16:] or (request.client.host if request.client else "anon")
        limiter.check(f"{bucket}:{who}", limit, window_s)

    return dep
