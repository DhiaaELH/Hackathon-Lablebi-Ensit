"""Anonymous class insights with cohort protection (N >= 5 distinct students for every number shown)."""
import uuid
from datetime import date

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import (
    Assessment,
    Attempt,
    Chapter,
    ConfusionSignal,
    HardChapterVote,
    InsightSubscription,
    Notification,
    ProgressEvent,
    Question,
    Section,
    TeacherResponse,
)
from ..security import signal_token

REASONS = ["vocabulary", "missing_prerequisite", "too_fast", "need_example", "exercise_too_hard"]


def min_cohort() -> int:
    return max(5, get_settings().insight_min_cohort)  # never below 5, whatever the config says


def record_signal(db: Session, user_id: uuid.UUID, section: Section, reasons: list[str], notify: bool) -> bool:
    """Returns False if this student already signalled this section (one signal per student per target)."""
    reasons = sorted({r for r in reasons if r in REASONS})
    sig = ConfusionSignal(course_id=section.course_id, chapter_id=section.chapter_id, section_id=section.id, reasons=reasons,
                          dedupe_token=signal_token(user_id, section.id), cohort_token=signal_token(user_id, section.course_id), day=date.today())
    try:
        with db.begin_nested():
            db.add(sig)
    except IntegrityError:
        created = False
    else:
        created = True
    if notify:
        db.merge(InsightSubscription(user_id=user_id, section_id=section.id))
    db.commit()
    return created


def teacher_dashboard(db: Session, course_id: uuid.UUID) -> dict:
    n = min_cohort()
    chapters = db.scalars(select(Chapter).where(Chapter.course_id == course_id).order_by(Chapter.ordinal)).all()
    sections = db.scalars(select(Section).where(Section.course_id == course_id).order_by(Section.ordinal)).all()
    counts = {r.section_id: r.students for r in db.execute(text("SELECT * FROM insight_section_counts(:c, :n)"), {"c": course_id, "n": n})}
    reasons: dict = {}
    for r in db.execute(text("SELECT * FROM insight_reason_counts(:c, :n)"), {"c": course_id, "n": n}):
        reasons.setdefault(r.section_id, {})[r.reason] = r.students
    trend = [{"week": r.week.isoformat(), "students": r.students, "signals": r.signals}
             for r in db.execute(text("SELECT * FROM insight_weekly_trend(:c, :n)"), {"c": course_id, "n": n})]

    # Hard-chapter votes (signed-in, one per student) are also only shown above the threshold.
    hard = dict(db.execute(select(HardChapterVote.chapter_id, func.count()).join(Chapter, Chapter.id == HardChapterVote.chapter_id)
                           .where(Chapter.course_id == course_id).group_by(HardChapterVote.chapter_id)).all())
    hints = dict(db.execute(select(ProgressEvent.ref_id, func.count(func.distinct(ProgressEvent.user_id)))
                            .where(ProgressEvent.course_id == course_id, ProgressEvent.kind == "hint").group_by(ProgressEvent.ref_id)).all())

    heatmap = []
    for ch in chapters:
        for s in [s for s in sections if s.chapter_id == ch.id]:
            c = counts.get(s.id)
            heatmap.append({"chapter": ch.title, "section_id": str(s.id), "section": s.title,
                            "students": c, "suppressed": c is None,
                            "reasons": reasons.get(s.id, {}),
                            "top_reason": max(reasons[s.id], key=reasons[s.id].get) if reasons.get(s.id) else None,
                            "hint_students": hints.get(str(s.id)) if (hints.get(str(s.id)) or 0) >= n else None})
    # Most-missed questions: failure rate over distinct students' latest attempts, only with >= n students.
    failed = []
    rows = db.execute(select(Question, Assessment.title).join(Assessment, Assessment.id == Question.assessment_id).where(Assessment.course_id == course_id)).all()
    attempts = db.execute(select(Attempt.user_id, Attempt.per_question, Attempt.created_at).join(Assessment, Assessment.id == Attempt.assessment_id)
                          .where(Assessment.course_id == course_id).order_by(Attempt.created_at)).all()
    latest: dict = {}
    for uid, per_q, _ in attempts:
        for pq in per_q:
            if pq["chosen"] is not None:
                latest[(uid, pq["question_id"])] = pq["correct"]
    for q, title in rows:
        results = [v for (u, qid), v in latest.items() if qid == str(q.id)]
        if len(results) >= n:
            failed.append({"question_id": str(q.id), "assessment": title, "prompt": q.prompt, "students": len(results),
                           "failure_rate": round(1 - sum(results) / len(results), 2)})
    failed.sort(key=lambda x: -x["failure_rate"])
    responses = db.scalars(select(TeacherResponse).where(TeacherResponse.course_id == course_id).order_by(TeacherResponse.created_at.desc())).all()
    return {
        "min_cohort": n,
        "heatmap": heatmap,
        "hard_chapters": [{"chapter_id": str(ch.id), "chapter": ch.title, "votes": hard.get(ch.id) if (hard.get(ch.id) or 0) >= n else None} for ch in chapters],
        "most_failed_questions": failed[:8],
        "trend": trend,
        "responses": [{"id": str(r.id), "section_id": str(r.section_id) if r.section_id else None, "kind": r.kind, "body": r.body,
                       "created_at": r.created_at.isoformat()} for r in responses],
        "privacy_note": f"Numbers appear only when at least {n} different students contributed. Signals carry no account id or name.",
    }


def post_teacher_response(db: Session, teacher_id: uuid.UUID, course_id: uuid.UUID, section: Section | None, kind: str, body: str) -> TeacherResponse:
    r = TeacherResponse(course_id=course_id, section_id=section.id if section else None, teacher_id=teacher_id, kind=kind, body=body)
    db.add(r)
    if section:
        # Notify opted-in students. The subscription table is separate from signals and never exposed to teachers.
        subs = db.scalars(select(InsightSubscription.user_id).where(InsightSubscription.section_id == section.id)).all()
        for uid in subs:
            db.add(Notification(user_id=uid, kind="teacher_response", title=f"Your teacher posted a {kind.replace('_', ' ')}: {section.title}",
                                body=body[:500], link=f"/courses/{course_id}?section={section.id}"))
    db.commit()
    return r
