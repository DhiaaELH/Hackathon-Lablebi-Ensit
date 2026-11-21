"""Plain-code learning logic: scoring, concept progress, prerequisite-gap diagnosis, completion."""
import uuid
from collections import deque
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import (
    Assessment,
    Attempt,
    Chapter,
    Concept,
    ConceptPrerequisite,
    ConceptProgress,
    ProgressEvent,
    Question,
    Section,
)

PASS_RATIO = 0.6


def score_attempt(db: Session, user_id: uuid.UUID, assessment: Assessment, answers: dict[str, int]) -> Attempt:
    questions = db.scalars(select(Question).where(Question.assessment_id == assessment.id).order_by(Question.ordinal)).all()
    per_q, score, max_score = [], 0.0, 0.0
    tally: dict[uuid.UUID, list[int]] = {}
    for q in questions:
        chosen = answers.get(str(q.id))
        correct = chosen is not None and chosen == q.correct_index
        max_score += q.points
        score += q.points if correct else 0
        per_q.append({"question_id": str(q.id), "chosen": chosen, "correct": correct, "concept_id": str(q.concept_id) if q.concept_id else None})
        if q.concept_id and chosen is not None:
            t = tally.setdefault(q.concept_id, [0, 0])
            t[0] += int(correct)
            t[1] += 1
    for concept_id, (c, n) in tally.items():
        cp = db.get(ConceptProgress, (user_id, concept_id))
        if cp is None:
            db.add(ConceptProgress(user_id=user_id, concept_id=concept_id, correct=c, total=n))
        else:
            cp.correct += c
            cp.total += n
            cp.updated_at = datetime.now(timezone.utc)
    attempt = Attempt(user_id=user_id, assessment_id=assessment.id, answers=answers, per_question=per_q, score=score, max_score=max_score)
    db.add(attempt)
    db.add(ProgressEvent(user_id=user_id, course_id=assessment.course_id, kind="attempt", ref_id=str(assessment.id),
                         data={"score": score, "max": max_score, "kind": assessment.kind}))
    db.commit()
    return attempt


def diagnose_gaps(db: Session, user_id: uuid.UUID, course_id: uuid.UUID, attempt: Attempt) -> list[dict]:
    """Walk the prerequisite graph backwards from missed concepts (BFS, depth <= 2). A prerequisite is a
    likely gap if the student's own record on it is weak, or it is untested while its dependant was missed.
    Evidence is returned in plain terms; no label is attached to the student."""
    missed: dict[uuid.UUID, int] = {}
    for pq in attempt.per_question:
        if not pq["correct"] and pq["concept_id"]:
            cid = uuid.UUID(pq["concept_id"])
            missed[cid] = missed.get(cid, 0) + 1
    if not missed:
        return []
    concepts = {c.id: c for c in db.scalars(select(Concept).where(Concept.course_id == course_id))}
    prereqs: dict[uuid.UUID, list[uuid.UUID]] = {}
    for cid, pid in db.execute(select(ConceptPrerequisite.concept_id, ConceptPrerequisite.prerequisite_id)).all():
        if cid in concepts:
            prereqs.setdefault(cid, []).append(pid)
    gaps: dict[uuid.UUID, dict] = {}
    for start, n_missed in missed.items():
        queue = deque([(p, 1) for p in prereqs.get(start, [])])
        seen = set()
        while queue:
            pid, depth = queue.popleft()
            if pid in seen or pid not in concepts:
                continue
            seen.add(pid)
            cp = db.get(ConceptProgress, (user_id, pid))
            weak = cp is not None and cp.total > 0 and cp.correct / cp.total < PASS_RATIO
            untested = cp is None or cp.total == 0
            if weak or (untested and depth == 1):
                g = gaps.setdefault(pid, {"concept_id": str(pid), "concept": concepts[pid].name, "because_of": [], "evidence": [], "confidence": "low"})
                g["because_of"].append(concepts[start].name)
                if weak:
                    g["evidence"].append(f"{cp.correct}/{cp.total} correct so far on '{concepts[pid].name}'")
                    g["confidence"] = "medium" if cp.total < 3 else "high"
                else:
                    g["evidence"].append(f"Not practised yet, and {n_missed} question(s) on '{concepts[start].name}' depend on it")
            if depth < 2:
                queue.extend((pp, depth + 1) for pp in prereqs.get(pid, []))
    return list(gaps.values())


def course_progress(db: Session, user_id: uuid.UUID, course_id: uuid.UUID) -> dict:
    chapters = db.scalars(select(Chapter).where(Chapter.course_id == course_id).order_by(Chapter.ordinal)).all()
    sections = db.scalars(select(Section).where(Section.course_id == course_id)).all()
    done_sections = set(db.scalars(select(ProgressEvent.ref_id).where(
        ProgressEvent.user_id == user_id, ProgressEvent.course_id == course_id, ProgressEvent.kind == "section_complete")))
    attempts = db.execute(select(Attempt, Assessment).join(Assessment, Assessment.id == Attempt.assessment_id).where(
        Attempt.user_id == user_id, Assessment.course_id == course_id).order_by(Attempt.created_at)).all()
    best_quiz: dict[str, float] = {}
    history = []
    for att, a in attempts:
        ratio = att.score / att.max_score if att.max_score else 0
        history.append({"assessment_id": str(a.id), "title": a.title, "kind": a.kind, "score": att.score, "max": att.max_score, "at": att.created_at.isoformat()})
        if a.kind == "chapter_quiz" and a.chapter_id:
            best_quiz[str(a.chapter_id)] = max(best_quiz.get(str(a.chapter_id), 0), ratio)
    ch_out = []
    for ch in chapters:
        secs = [s for s in sections if s.chapter_id == ch.id]
        secs_done = sum(1 for s in secs if str(s.id) in done_sections)
        quiz = best_quiz.get(str(ch.id))
        complete = secs_done == len(secs) and quiz is not None and quiz >= PASS_RATIO
        ch_out.append({"chapter_id": str(ch.id), "title": ch.title, "sections_done": secs_done, "sections_total": len(secs),
                       "best_quiz_ratio": quiz, "complete": complete})
    concepts = db.execute(select(Concept, ConceptProgress).join(ConceptProgress, ConceptProgress.concept_id == Concept.id).where(
        Concept.course_id == course_id, ConceptProgress.user_id == user_id)).all()
    return {
        "criteria": f"A chapter is complete when every section is marked done and its chapter quiz is passed with at least {int(PASS_RATIO * 100)}%.",
        "sections_done": len(done_sections & {str(s.id) for s in sections}),
        "sections_total": len(sections),
        "done_section_ids": sorted(done_sections & {str(s.id) for s in sections}),
        "chapters": ch_out,
        "concepts": [{"concept_id": str(c.id), "name": c.name, "correct": cp.correct, "total": cp.total,
                      "trend": "solid" if cp.correct / cp.total >= 0.8 else "building" if cp.correct / cp.total >= PASS_RATIO else "needs practice",
                      "evidence": f"{cp.correct}/{cp.total} correct"} for c, cp in concepts if cp.total],
        "history": history[-30:],
    }
