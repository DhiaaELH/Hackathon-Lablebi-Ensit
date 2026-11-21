"""Social: opt-in user search, public profiles, follow, block, private 1:1 conversations, study groups.
Privacy rules (all server-side):
- search returns only profiles with searchable=true, never emails, and never users in a block relation;
- a DM needs the recipient's message_setting to allow it (everyone | followers = recipient follows sender | nobody);
- blocks prevent contact both ways; conversations are readable only by participants.
"""
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
    Block,
    Conversation,
    ConversationParticipant,
    Follow,
    Message,
    Post,
    Profile,
    User,
)
from ..security import current_user, get_readable_course, rate_limit

router = APIRouter(prefix="/api", tags=["social"])


def _blocked(db: Session, a: uuid.UUID, b: uuid.UUID) -> bool:
    return bool(db.scalar(select(func.count()).select_from(Block).where(
        or_(and_(Block.blocker_id == a, Block.blocked_id == b), and_(Block.blocker_id == b, Block.blocked_id == a)))))


def _profile_by_username(db: Session, username: str) -> Profile:
    p = db.scalar(select(Profile).where(Profile.username == username.lower()))
    if not p:
        raise HTTPException(404, "User not found")
    return p


def _accepted_answers(db: Session, uid: uuid.UUID) -> int:
    return db.scalar(select(func.count()).select_from(Post).where(Post.author_id == uid, Post.accepted.is_(True))) or 0


def _public(db: Session, me: User, p: Profile) -> dict:
    following = bool(db.get(Follow, (me.id, p.user_id)))
    follows_me = bool(db.get(Follow, (p.user_id, me.id)))
    out = {"username": p.username, "display_name": p.display_name, "role": p.role, "bio": p.bio, "is_me": p.user_id == me.id,
           "following": following, "follows_you": follows_me, "blocked_by_me": bool(db.get(Block, (me.id, p.user_id))),
           "accepted_answers": _accepted_answers(db, p.user_id),
           "can_message": _can_message(db, me.id, p) is None and p.user_id != me.id}
    if p.show_follows:
        out["followers"] = db.scalar(select(func.count()).select_from(Follow).where(Follow.followee_id == p.user_id))
        out["following_count"] = db.scalar(select(func.count()).select_from(Follow).where(Follow.follower_id == p.user_id))
    acc = out["accepted_answers"]
    out["badge"] = "peer_tutor" if p.role == "senior" or acc >= 3 else None
    return out


def _can_message(db: Session, sender: uuid.UUID, recipient: Profile) -> str | None:
    """Returns None if allowed, else the reason."""
    if _blocked(db, sender, recipient.user_id):
        return "You can't message this user."
    if recipient.message_setting == "nobody":
        return "This user does not accept messages."
    if recipient.message_setting == "followers" and not db.get(Follow, (recipient.user_id, sender)):
        return "This user only accepts messages from people they follow."
    return None


@router.get("/users/search", dependencies=[Depends(rate_limit("user_search", 30, 60))])
def search_users(q: str = "", me=Depends(current_user), db: Session = Depends(get_db)):
    q = q.strip().lower()[:40]
    if len(q) < 2:
        return []
    like = f"%{q}%"
    blocked = select(Block.blocked_id).where(Block.blocker_id == me.id).union(select(Block.blocker_id).where(Block.blocked_id == me.id))
    rows = db.scalars(select(Profile).where(Profile.searchable.is_(True), Profile.user_id != me.id, Profile.user_id.not_in(blocked),
                                            or_(func.lower(Profile.username).like(like), func.lower(Profile.display_name).like(like)))
                      .order_by(Profile.display_name).limit(20)).all()
    return [_public(db, me, p) for p in rows]


@router.get("/users/{username}")
def profile(username: str, me=Depends(current_user), db: Session = Depends(get_db)):
    p = _profile_by_username(db, username)
    if p.user_id != me.id and (not p.searchable or _blocked(db, me.id, p.user_id)) and not db.get(Follow, (me.id, p.user_id)):
        raise HTTPException(404, "User not found")
    return _public(db, me, p)


@router.post("/users/{username}/follow", dependencies=[Depends(rate_limit("follow", 30, 60))])
def follow(username: str, me=Depends(current_user), db: Session = Depends(get_db)):
    p = _profile_by_username(db, username)
    if p.user_id == me.id or _blocked(db, me.id, p.user_id) or not p.searchable:
        raise HTTPException(400, "You can't follow this user")
    if not db.get(Follow, (me.id, p.user_id)):
        db.add(Follow(follower_id=me.id, followee_id=p.user_id))
        db.commit()
    return _public(db, me, p)


@router.delete("/users/{username}/follow")
def unfollow(username: str, me=Depends(current_user), db: Session = Depends(get_db)):
    p = _profile_by_username(db, username)
    f = db.get(Follow, (me.id, p.user_id))
    if f:
        db.delete(f)
        db.commit()
    return _public(db, me, p)


@router.post("/users/{username}/block")
def block(username: str, me=Depends(current_user), db: Session = Depends(get_db)):
    p = _profile_by_username(db, username)
    if p.user_id == me.id:
        raise HTTPException(400, "You can't block yourself")
    if not db.get(Block, (me.id, p.user_id)):
        db.add(Block(blocker_id=me.id, blocked_id=p.user_id))
    for f in (db.get(Follow, (me.id, p.user_id)), db.get(Follow, (p.user_id, me.id))):
        if f:
            db.delete(f)
    db.commit()
    return {"ok": True}


@router.delete("/users/{username}/block")
def unblock(username: str, me=Depends(current_user), db: Session = Depends(get_db)):
    p = _profile_by_username(db, username)
    b = db.get(Block, (me.id, p.user_id))
    if b:
        db.delete(b)
        db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- conversations
def _participant(db: Session, me: User, conv_id: uuid.UUID) -> Conversation:
    conv = db.get(Conversation, conv_id)
    if not conv or not db.get(ConversationParticipant, (conv_id, me.id)):
        raise HTTPException(404, "Conversation not found")
    return conv


def _conv_out(db: Session, me: User, c: Conversation) -> dict:
    parts = db.execute(select(Profile).join(ConversationParticipant, ConversationParticipant.user_id == Profile.user_id)
                       .where(ConversationParticipant.conversation_id == c.id)).scalars().all()
    last = db.scalar(select(Message).where(Message.conversation_id == c.id).order_by(Message.created_at.desc()))
    mine = db.get(ConversationParticipant, (c.id, me.id))
    unread = db.scalar(select(func.count()).select_from(Message).where(
        Message.conversation_id == c.id, Message.sender_id != me.id,
        Message.created_at > (mine.last_read_at if mine and mine.last_read_at else datetime(1970, 1, 1, tzinfo=timezone.utc))))
    others = [p for p in parts if p.user_id != me.id]
    return {"id": str(c.id), "is_group": c.is_group,
            "title": c.title if c.is_group else (others[0].display_name if others else "—"),
            "members": [{"username": p.username, "display_name": p.display_name, "role": p.role} for p in parts],
            "course_id": str(c.course_id) if c.course_id else None, "exam_date": c.exam_date.isoformat() if c.exam_date else None,
            "last": {"body": last.body[:120], "at": last.created_at.isoformat()} if last else None, "unread": unread}


@router.get("/conversations")
def list_conversations(me=Depends(current_user), db: Session = Depends(get_db)):
    ids = select(ConversationParticipant.conversation_id).where(ConversationParticipant.user_id == me.id)
    convs = db.scalars(select(Conversation).where(Conversation.id.in_(ids))).all()
    out = [_conv_out(db, me, c) for c in convs]
    return sorted(out, key=lambda c: (c["last"] or {}).get("at", ""), reverse=True)


class StartIn(BaseModel):
    username: str = Field(min_length=1, max_length=40)


@router.post("/conversations", dependencies=[Depends(rate_limit("dm_start", 10, 600))])
def start_conversation(body: StartIn, me=Depends(current_user), db: Session = Depends(get_db)):
    p = _profile_by_username(db, body.username)
    if p.user_id == me.id:
        raise HTTPException(400, "You can't message yourself")
    reason = _can_message(db, me.id, p)
    if reason:
        raise HTTPException(403, reason)
    mine = select(ConversationParticipant.conversation_id).where(ConversationParticipant.user_id == me.id)
    theirs = select(ConversationParticipant.conversation_id).where(ConversationParticipant.user_id == p.user_id)
    existing = db.scalar(select(Conversation).where(Conversation.is_group.is_(False), Conversation.id.in_(mine), Conversation.id.in_(theirs)))
    if existing:
        return _conv_out(db, me, existing)
    c = Conversation(is_group=False, created_by=me.id)
    db.add(c)
    db.flush()
    db.add_all([ConversationParticipant(conversation_id=c.id, user_id=me.id), ConversationParticipant(conversation_id=c.id, user_id=p.user_id)])
    db.commit()
    return _conv_out(db, me, c)


@router.get("/conversations/{conv_id}/messages")
def list_messages(conv_id: uuid.UUID, before: datetime | None = None, limit: int = 30, me=Depends(current_user), db: Session = Depends(get_db)):
    c = _participant(db, me, conv_id)
    q = select(Message).where(Message.conversation_id == c.id)
    if before:
        q = q.where(Message.created_at < before)
    rows = db.scalars(q.order_by(Message.created_at.desc()).limit(max(1, min(limit, 100)))).all()
    names = {p.user_id: p for p in db.scalars(select(Profile).where(Profile.user_id.in_({m.sender_id for m in rows})))}
    part = db.get(ConversationParticipant, (c.id, me.id))
    part.last_read_at = datetime.now(timezone.utc)
    db.commit()
    return {"conversation": _conv_out(db, me, c), "has_more": len(rows) == limit,
            "messages": [{"id": str(m.id), "body": m.body, "mine": m.sender_id == me.id, "at": m.created_at.isoformat(),
                          "sender": names[m.sender_id].display_name if m.sender_id in names else "?"} for m in reversed(rows)]}


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


@router.post("/conversations/{conv_id}/messages", dependencies=[Depends(rate_limit("dm_send", 30, 60))])
def send_message(conv_id: uuid.UUID, body: MessageIn, me=Depends(current_user), db: Session = Depends(get_db)):
    c = _participant(db, me, conv_id)
    if not c.is_group:
        other = db.scalar(select(ConversationParticipant.user_id).where(ConversationParticipant.conversation_id == c.id, ConversationParticipant.user_id != me.id))
        if other and _blocked(db, me.id, other):
            raise HTTPException(403, "You can't message this user.")
    m = Message(conversation_id=c.id, sender_id=me.id, body=body.body.strip())
    db.add(m)
    db.commit()
    return {"id": str(m.id)}


# ---------------------------------------------------------------- study groups
class GroupIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    exam_date: date | None = None


@router.get("/courses/{course_id}/groups")
def list_groups(course_id: uuid.UUID, me=Depends(current_user), db: Session = Depends(get_db)):
    get_readable_course(db, user=me, course_id=course_id)
    groups = db.scalars(select(Conversation).where(Conversation.is_group.is_(True), Conversation.course_id == course_id)).all()
    out = []
    for g in groups:
        members = db.scalar(select(func.count()).select_from(ConversationParticipant).where(ConversationParticipant.conversation_id == g.id))
        out.append({"id": str(g.id), "title": g.title, "members": members, "exam_date": g.exam_date.isoformat() if g.exam_date else None,
                    "joined": bool(db.get(ConversationParticipant, (g.id, me.id)))})
    return out


@router.post("/courses/{course_id}/groups", dependencies=[Depends(rate_limit("group", 5, 600))])
def create_group(course_id: uuid.UUID, body: GroupIn, me=Depends(current_user), db: Session = Depends(get_db)):
    get_readable_course(db, user=me, course_id=course_id)
    g = Conversation(is_group=True, title=body.title.strip(), course_id=course_id, exam_date=body.exam_date, created_by=me.id)
    db.add(g)
    db.flush()
    db.add(ConversationParticipant(conversation_id=g.id, user_id=me.id))
    db.commit()
    return {"id": str(g.id)}


@router.post("/groups/{group_id}/join")
def join_group(group_id: uuid.UUID, me=Depends(current_user), db: Session = Depends(get_db)):
    g = db.get(Conversation, group_id)
    if not g or not g.is_group:
        raise HTTPException(404, "Group not found")
    get_readable_course(db, user=me, course_id=g.course_id)
    if not db.get(ConversationParticipant, (g.id, me.id)):
        db.add(ConversationParticipant(conversation_id=g.id, user_id=me.id))
        db.commit()
    return {"id": str(g.id)}


@router.post("/groups/{group_id}/leave")
def leave_group(group_id: uuid.UUID, me=Depends(current_user), db: Session = Depends(get_db)):
    p = db.get(ConversationParticipant, (group_id, me.id))
    if p:
        db.delete(p)
        db.commit()
    return {"ok": True}
