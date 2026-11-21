"""Verified-by-students, spaced repetition (SM-2), explainable recommendations, senior-student queue."""
import hashlib
import math
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
    AgentArtifact,
    Assessment,
    Attempt,
    Chapter,
    Concept,
    ConceptProgress,
    CorrectionVote,
    Course,
    CourseMember,
    FlashcardReview,
    ProgressEvent,
    Profile,
    Question,
    QuestionCorrection,
    QuestionEndorsement,
    Recommendation,
    RecommendationFeedback,
    Section,
    StudentPreferences,
    TeacherResponse,
)
from ..security import current_user, get_readable_course, rate_limit, readable_course_ids, role_of
from ..services.insights import min_cohort

router = APIRouter(prefix="/api", tags=["growth"])
VERIFY_THRESHOLD = 3


# ---------------------------------------------------------------- verified by students
def _question(db: Session, user, qid: uuid.UUID) -> tuple[Question, Assessment]:
    q = db.get(Question, qid)
    if not q:
        raise HTTPException(404, "Not found")
    a = db.get(Assessment, q.assessment_id)
    get_readable_course(db, user, a.course_id)
    return q, a


def community_state(db: Session, user, q: Question) -> dict:
    endorsements = db.scalar(select(func.count()).select_from(QuestionEndorsement).where(QuestionEndorsement.question_id == q.id))
    cors = db.scalars(select(QuestionCorrection).where(QuestionCorrection.question_id == q.id, QuestionCorrection.status != "removed")
                      .order_by(QuestionCorrection.created_at)).all()
    items = []
    for c in cors:
        votes = db.scalar(select(func.count()).select_from(CorrectionVote).where(CorrectionVote.correction_id == c.id))
        author = db.get(Profile, c.author_id)
        items.append({"id": str(c.id), "body": c.body, "status": c.status, "votes": votes, "author": author.display_name if author else "—",
                      "i_voted": bool(db.get(CorrectionVote, (user.id, c.id))), "at": c.created_at.isoformat()})
    accepted = [c for c in items if c["status"] == "accepted"]
    return {"endorsements": endorsements, "i_endorsed": bool(db.get(QuestionEndorsement, (user.id, q.id))),
            "verified_by_students": endorsements >= VERIFY_THRESHOLD and not accepted,
            "corrected_by_students": bool(accepted), "corrections": items,
            "note": f"'Verified by students' means at least {VERIFY_THRESHOLD} students endorsed it. It is not expert verification."}


def _attempted(db: Session, user_id, assessment_id) -> bool:
    return bool(db.scalar(select(func.count()).select_from(Attempt).where(Attempt.user_id == user_id, Attempt.assessment_id == assessment_id)))


@router.get("/questions/{qid}/community")
def question_community(qid: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    q, _ = _question(db, user, qid)
    return community_state(db, user, q)


@router.post("/questions/{qid}/endorse")
def endorse(qid: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    q, a = _question(db, user, qid)
    if not _attempted(db, user.id, a.id):
        raise HTTPException(400, "Answer the question before endorsing it")
    e = db.get(QuestionEndorsement, (user.id, q.id))
    if e:
        db.delete(e)
    else:
        db.add(QuestionEndorsement(user_id=user.id, question_id=q.id))
    db.commit()
    return community_state(db, user, q)


class CorrectionIn(BaseModel):
    body: str = Field(min_length=10, max_length=4000)


@router.post("/questions/{qid}/corrections", dependencies=[Depends(rate_limit("qcorr", 10, 600))])
def propose_correction(qid: uuid.UUID, body: CorrectionIn, user=Depends(current_user), db: Session = Depends(get_db)):
    q, a = _question(db, user, qid)
    if not _attempted(db, user.id, a.id):
        raise HTTPException(400, "Answer the question before proposing a correction")
    db.add(QuestionCorrection(question_id=q.id, author_id=user.id, body=body.body.strip()))
    db.commit()
    return community_state(db, user, q)


@router.post("/question-corrections/{cid}/vote")
def vote_question_correction(cid: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    c = db.get(QuestionCorrection, cid)
    if not c or c.status == "removed":
        raise HTTPException(404, "Not found")
    q, _ = _question(db, user, c.question_id)
    if c.author_id == user.id:
        raise HTTPException(400, "You can't vote on your own correction")
    v = db.get(CorrectionVote, (user.id, c.id))
    if v:
        db.delete(v)
    else:
        db.add(CorrectionVote(user_id=user.id, correction_id=c.id))
    db.flush()
    votes = db.scalar(select(func.count()).select_from(CorrectionVote).where(CorrectionVote.correction_id == c.id))
    trusted = role_of(user) in ("teacher", "admin")
    if c.status == "open" and (votes >= VERIFY_THRESHOLD or trusted):
        c.status = "accepted"
    db.commit()
    return community_state(db, user, q)


# ---------------------------------------------------------------- spaced repetition (SM-2)
def card_key(front: str) -> str:
    return hashlib.sha1(front.strip().lower().encode()).hexdigest()[:16]


def sm2(ease: float, interval: int, reps: int, quality: int) -> tuple[float, int, int]:
    """Classic SM-2. quality 0..5; < 3 resets the repetition count."""
    if quality < 3:
        reps, interval = 0, 1
    else:
        reps += 1
        interval = 1 if reps == 1 else 6 if reps == 2 else max(1, round(interval * ease))
    ease = max(1.3, ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    return ease, interval, reps


@router.get("/courses/{course_id}/flashcards/due")
def due_cards(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_readable_course(db, user, course_id)
    rev = db.scalar(select(AgentArtifact).where(AgentArtifact.course_id == course.id, AgentArtifact.kind == "revision").order_by(AgentArtifact.created_at.desc()))
    cards = (rev.payload.get("flashcards", []) if rev else [])
    state = {r.card_key: r for r in db.scalars(select(FlashcardReview).where(FlashcardReview.user_id == user.id, FlashcardReview.course_id == course.id))}
    today = date.today()
    due, upcoming = [], []
    for c in cards:
        k = card_key(c["front"])
        st = state.get(k)
        item = {**c, "key": k, "reps": st.reps if st else 0, "due": (st.due if st else today).isoformat(), "new": st is None}
        (due if (not st or st.due <= today) else upcoming).append(item)
    return {"due": due[:30], "upcoming": len(upcoming), "total": len(cards),
            "next_due": min((u["due"] for u in upcoming), default=None)}


class ReviewIn(BaseModel):
    key: str = Field(min_length=4, max_length=64)
    quality: int = Field(ge=0, le=5)


@router.post("/courses/{course_id}/flashcards/review")
def review_card(course_id: uuid.UUID, body: ReviewIn, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_readable_course(db, user, course_id)
    st = db.get(FlashcardReview, (user.id, course.id, body.key)) or FlashcardReview(user_id=user.id, course_id=course.id, card_key=body.key,
                                                                                     ease=2.5, interval_days=0, reps=0, due=date.today())
    st.ease, st.interval_days, st.reps = sm2(st.ease, st.interval_days, st.reps, body.quality)
    st.due = date.today() + timedelta(days=st.interval_days)
    st.updated_at = datetime.now(timezone.utc)
    db.merge(st)
    db.commit()
    return {"key": body.key, "due": st.due.isoformat(), "interval_days": st.interval_days}


# ---------------------------------------------------------------- recommendations (transparent content-based v1)
_WORD = re.compile(r"[\w؀-ۿ]{3,}")


def _tokens(*texts: str | None) -> set[str]:
    return {w.lower() for t in texts if t for w in _WORD.findall(t)}


def _upsert(db: Session, user_id, ttype: str, tid: str, reason: str, score: float) -> Recommendation:
    r = db.scalar(select(Recommendation).where(Recommendation.user_id == user_id, Recommendation.target_type == ttype, Recommendation.target_id == tid))
    if r:
        r.reason, r.score = reason, score
    else:
        r = Recommendation(user_id=user_id, target_type=ttype, target_id=tid, reason=reason, score=score)
        db.add(r)
    db.flush()
    return r


def compute_recommendations(db: Session, user) -> list[dict]:
    prefs = db.get(StudentPreferences, user.id)
    settings = (prefs.recommendation_settings if prefs else None) or {}
    interests = _tokens(*((prefs.interests or []) + (prefs.current_subjects or []))) if prefs else set()
    mine = set(readable_course_ids(db, user))
    items: list[tuple[str, str, str, float, dict]] = []

    if settings.get("review", True):
        rows = db.execute(select(Concept, ConceptProgress).join(ConceptProgress, ConceptProgress.concept_id == Concept.id)
                          .where(ConceptProgress.user_id == user.id, ConceptProgress.total > 0)).all()
        for c, cp in rows:
            ratio = cp.correct / cp.total
            if ratio < 0.6:
                items.append(("concept", str(c.id), f"You answered {cp.correct}/{cp.total} correctly on '{c.name}'. A short review should help.",
                              2.0 + (0.6 - ratio) * 3, {"course_id": str(c.course_id), "section_id": str(c.section_id) if c.section_id else None, "title": c.name}))

    if settings.get("next_steps", True):
        done = set(db.scalars(select(ProgressEvent.ref_id).where(ProgressEvent.user_id == user.id, ProgressEvent.kind == "section_complete")))
        for cid in mine:
            secs = db.execute(select(Section, Chapter.ordinal).join(Chapter, Chapter.id == Section.chapter_id).where(Section.course_id == cid)
                              .order_by(Chapter.ordinal, Section.ordinal)).all()
            started = any(str(s.id) in done for s, _ in secs)
            nxt = next((s for s, _ in secs if str(s.id) not in done), None)
            if started and nxt:
                items.append(("section", str(nxt.id), f"Next in a course you started: '{nxt.title}'.", 1.5,
                              {"course_id": str(cid), "section_id": str(nxt.id), "title": nxt.title}))

    if settings.get("library", True):
        members = dict(db.execute(select(CourseMember.course_id, func.count()).group_by(CourseMember.course_id)).all())
        for c in db.scalars(select(Course).where(Course.visibility == "published")):
            if c.id in mine:
                continue
            overlap = interests & _tokens(c.title, c.description)
            pop = members.get(c.id, 0)
            score = 1.2 * len(overlap) + 0.3 * math.log1p(pop)
            if score <= 0:
                continue
            reason = (f"Matches your interests: {', '.join(sorted(overlap)[:3])}." if overlap else f"Popular in the library ({pop} students).")
            items.append(("course", str(c.id), reason, score, {"course_id": str(c.id), "title": c.title}))

    dismissed = set(db.scalars(select(Recommendation.id).join(RecommendationFeedback, RecommendationFeedback.recommendation_id == Recommendation.id)
                               .where(RecommendationFeedback.user_id == user.id, RecommendationFeedback.action == "dismissed")))
    saved = set(db.scalars(select(Recommendation.id).join(RecommendationFeedback, RecommendationFeedback.recommendation_id == Recommendation.id)
                           .where(RecommendationFeedback.user_id == user.id, RecommendationFeedback.action == "saved")))
    out = []
    for ttype, tid, reason, score, extra in sorted(items, key=lambda x: -x[3])[:12]:
        r = _upsert(db, user.id, ttype, tid, reason, score)
        if r.id in dismissed:
            continue
        out.append({"id": str(r.id), "type": ttype, "reason": reason, "score": round(score, 2), "saved": r.id in saved, **extra})
    db.commit()
    return out


@router.get("/recommendations")
def recommendations(user=Depends(current_user), db: Session = Depends(get_db)):
    prefs = db.get(StudentPreferences, user.id)
    return {"items": compute_recommendations(db, user), "settings": {"review": True, "next_steps": True, "library": True, **((prefs.recommendation_settings if prefs else None) or {})},
            "how": "Ranked by plain rules: your quiz results, your next unfinished section, and word overlap between your interests and published courses. No trained model."}


class FeedbackIn(BaseModel):
    action: Literal["saved", "dismissed", "none"]


@router.post("/recommendations/{rid}/feedback")
def recommendation_feedback(rid: uuid.UUID, body: FeedbackIn, user=Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(Recommendation, rid)
    if not r or r.user_id != user.id:
        raise HTTPException(404, "Not found")
    fb = db.get(RecommendationFeedback, (user.id, r.id))
    if body.action == "none":
        if fb:
            db.delete(fb)
    elif fb:
        fb.action = body.action
    else:
        db.add(RecommendationFeedback(user_id=user.id, recommendation_id=r.id, action=body.action))
    db.commit()
    return {"ok": True}


class TuneIn(BaseModel):
    review: bool = True
    next_steps: bool = True
    library: bool = True


@router.put("/recommendations/settings")
def tune(body: TuneIn, user=Depends(current_user), db: Session = Depends(get_db)):
    prefs = db.get(StudentPreferences, user.id) or StudentPreferences(user_id=user.id, interests=[], current_subjects=[])
    prefs.recommendation_settings = body.model_dump()
    db.merge(prefs)
    db.commit()
    return body.model_dump()


# ---------------------------------------------------------------- senior-student queue (de-identified)
@router.get("/senior/queue")
def senior_queue(hours: int = 24, user=Depends(current_user), db: Session = Depends(get_db)):
    """Sections with >= N distinct confused students and no teacher response for `hours`. Aggregates only."""
    if role_of(user) not in ("senior", "teacher", "admin"):
        raise HTTPException(403, "Peer tutors only")
    n = min_cohort()
    cutoff = date.today() - timedelta(days=max(1, hours // 24))
    course_ids = set(readable_course_ids(db, user)) | set(db.scalars(select(Course.id).where(Course.visibility == "published")))
    out = []
    for cid in course_ids:
        counts = {r.section_id: r.students for r in db.execute(text("SELECT * FROM insight_section_counts(:c, :n)"), {"c": cid, "n": n})}
        if not counts:
            continue
        reasons: dict = {}
        for r in db.execute(text("SELECT * FROM insight_reason_counts(:c, :n)"), {"c": cid, "n": n}):
            reasons.setdefault(r.section_id, {})[r.reason] = r.students
        oldest = dict(db.execute(text("SELECT section_id, min(day) FROM confusion_signals WHERE course_id = :c GROUP BY section_id"), {"c": cid}).all())
        answered = set(db.scalars(select(TeacherResponse.section_id).where(TeacherResponse.course_id == cid)))
        course = db.get(Course, cid)
        for sid, students in counts.items():
            if sid in answered or oldest.get(sid, date.today()) > cutoff:
                continue
            s = db.get(Section, sid)
            ch = db.get(Chapter, s.chapter_id)
            rs = reasons.get(sid, {})
            out.append({"course_id": str(cid), "course": course.title, "chapter_id": str(ch.id), "chapter": ch.title, "section_id": str(sid),
                        "section": s.title, "students": students, "top_reason": max(rs, key=rs.get) if rs else None})
    return {"items": sorted(out, key=lambda x: -x["students"]), "min_cohort": n, "hours": hours}


