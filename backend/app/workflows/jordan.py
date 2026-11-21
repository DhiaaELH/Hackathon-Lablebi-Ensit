"""Jordan - the coordinator. Plain code, not an LLM: it owns task order, parallelism, bounded retries,
status events and persistence. Agents never talk to each other directly.

    clara (structure) ──► quinn (quizzes) ─┐
                      ├─► alex  (exercises) ├─► riley checks each ─► persisted artefacts
                      ├─► sage  (revision)  │
                      └─► max   (mock exam) ┘     + topic map (plain code)

Clara runs first and writes the shared `policy + corpus` prompt-cache entry; the four parallel roles then
read it from cache.
"""
import logging
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..agents import roles
from ..agents.context import CorpusTooLarge, build_outline, resolve_citations
from ..agents.schemas import AgentEnvelope
from ..db import SessionLocal
from ..llm.provider import LLMError, LLMRefusal, TransientLLMError
from ..models import (
    AgentArtifact,
    AgentTask,
    Assessment,
    Chapter,
    Concept,
    ConceptPrerequisite,
    Course,
    Question,
    Section,
    WorkflowEvent,
    WorkflowRun,
)

log = logging.getLogger("lessonforge.jordan")
PARALLEL_ROLES = ["quinn", "alex", "sage", "max"]
ROLE_LABEL = {"clara": "Clara is analysing the course structure", "quinn": "Quinn is writing chapter quizzes",
              "alex": "Alex is designing practice exercises", "sage": "Sage is preparing revision material",
              "max": "Max is building a mock exam", "riley": "Riley is checking quality"}


def _now():
    return datetime.now(timezone.utc)


def event(db: Session, wf_id, role: str, type_: str, message: str, task_id=None) -> None:
    db.add(WorkflowEvent(workflow_id=wf_id, task_id=task_id, agent_role=role, type=type_, message=message))
    db.commit()


def start_workflow(db: Session, course: Course, user_id: uuid.UUID, lang: str, demo: bool) -> WorkflowRun:
    wf = WorkflowRun(course_id=course.id, user_id=user_id, language=lang, demo_mode=demo, status="queued")
    db.add(wf)
    db.flush()
    clara = AgentTask(workflow_id=wf.id, course_id=course.id, agent_role="clara", kind="structure")
    db.add(clara)
    db.flush()
    for r in PARALLEL_ROLES:
        db.add(AgentTask(workflow_id=wf.id, course_id=course.id, agent_role=r, kind=r, depends_on=[str(clara.id)]))
    course.status = "processing"
    db.commit()
    event(db, wf.id, "jordan", "started", "Workflow created. Nova will keep you posted." + (" (Demo mode: no AI model is called.)" if demo else ""))
    return wf


# ---------------------------------------------------------------- retries
def _attempt(db: Session, task: AgentTask, fn):
    """Transient errors: at most 2 retries. Invalid output: 1 retry. Refusal: no retry, needs review."""
    max_retries = 2
    while True:
        try:
            return fn()
        except LLMRefusal as e:
            task.status, task.error = "needs_review", str(e)
            db.commit()
            return None
        except (TransientLLMError, LLMError, ValidationError) as e:
            transient = isinstance(e, TransientLLMError)
            limit = max_retries if transient else 1
            if task.retry_count >= limit:
                task.status, task.error = "failed", str(e)[:500]
                db.commit()
                return None
            task.retry_count += 1
            db.commit()
            event(db, task.workflow_id, "jordan", "retry", f"Retrying {task.agent_role} ({task.retry_count}/{limit}).", task.id)


# ---------------------------------------------------------------- persistence
def _creates_cycle(edges: dict[str, set[str]], concept: str, prereq: str) -> bool:
    stack, seen = [prereq], set()
    while stack:
        node = stack.pop()
        if node == concept:
            return True
        if node in seen:
            continue
        seen.add(node)
        stack.extend(edges.get(node, ()))
    return False


def persist_structure(db: Session, course: Course, s: dict) -> None:
    for model in (Assessment, AgentArtifact, Concept, Chapter):
        db.execute(delete(model).where(model.course_id == course.id))
    db.flush()
    section_by_title: dict[str, Section] = {}
    for ci, ch in enumerate(s["chapters"]):
        chapter = Chapter(course_id=course.id, ordinal=ci, title=ch["title"][:300], summary=ch.get("summary", ""),
                          citations=resolve_citations(db, course.id, ch.get("citations", [])))
        db.add(chapter)
        db.flush()
        for si, sec in enumerate(ch["sections"]):
            section = Section(chapter_id=chapter.id, course_id=course.id, ordinal=si, title=sec["title"][:300], content=sec.get("content", ""),
                              objectives=sec.get("objectives", []), key_terms=sec.get("key_terms", []), formulas=sec.get("formulas", []),
                              hard_points=sec.get("hard_points", []), citations=resolve_citations(db, course.id, sec.get("citations", [])))
            db.add(section)
            db.flush()
            section_by_title[sec["title"]] = section
    concepts: dict[str, Concept] = {}
    for c in s["concepts"]:
        if c["key"] in concepts:
            continue
        sec = section_by_title.get(c.get("section_title", ""))
        concept = Concept(course_id=course.id, section_id=sec.id if sec else None, key=c["key"][:80], name=c["name"][:200],
                          description=c.get("description", ""), citations=resolve_citations(db, course.id, c.get("citations", [])))
        db.add(concept)
        concepts[c["key"]] = concept
    db.flush()
    edges: dict[str, set[str]] = {}
    for c in s["concepts"]:
        for p in c.get("prerequisites", []):
            if p in concepts and p != c["key"] and not _creates_cycle(edges, c["key"], p):
                edges.setdefault(c["key"], set()).add(p)
                db.add(ConceptPrerequisite(concept_id=concepts[c["key"]].id, prerequisite_id=concepts[p].id))
    db.commit()


def _lookup(db: Session, course: Course):
    chapters = {c.title: c for c in db.scalars(select(Chapter).where(Chapter.course_id == course.id))}
    sections = {s.title: s for s in db.scalars(select(Section).where(Section.course_id == course.id))}
    concepts = {c.key: c for c in db.scalars(select(Concept).where(Concept.course_id == course.id))}
    return chapters, sections, concepts


def _add_questions(db: Session, course: Course, assessment: Assessment, questions: list[dict], concepts: dict) -> None:
    for i, q in enumerate(questions):
        concept = concepts.get(q.get("concept_key"))
        db.add(Question(assessment_id=assessment.id, concept_id=concept.id if concept else None, ordinal=i, qtype="mcq", prompt=q["prompt"],
                        choices=q["choices"], correct_index=q["correct_index"], explanation=q.get("explanation", ""),
                        distractor_notes=q.get("distractor_notes", []), points=q.get("points", 1),
                        citations=resolve_citations(db, course.id, q.get("citations", []))))


def _resolve_payload_citations(db: Session, course: Course, role: str, payload: dict) -> dict:
    """Fixture citations are headings; map them to refs before Riley validates them."""
    def fix(items):
        for it in items:
            it["citations"] = resolve_citations(db, course.id, it.get("citations", []))
    if role == "quinn":
        for qz in payload["quizzes"]:
            fix(qz["questions"])
    elif role == "alex":
        for ex in payload["exercises"]:
            fix(ex["questions"])
    elif role == "max":
        fix(payload["questions"])
    elif role == "sage":
        fix(payload["summaries"])
        fix(payload["flashcards"])
    return payload


def persist_role_output(db: Session, course: Course, role: str, payload: dict, lang: str, status: str, findings: list, task_id) -> None:
    chapters, sections, concepts = _lookup(db, course)
    chapter_list = sorted(chapters.values(), key=lambda c: c.ordinal)
    if role == "quinn":
        for i, qz in enumerate(payload["quizzes"]):
            ch = chapters.get(qz["chapter_title"]) or (chapter_list[i] if i < len(chapter_list) else None)
            a = Assessment(course_id=course.id, chapter_id=ch.id if ch else None, kind="chapter_quiz", agent_role="quinn",
                           title=f"Quiz — {ch.title if ch else qz['chapter_title']}", quality_status=status, findings=findings)
            db.add(a)
            db.flush()
            _add_questions(db, course, a, qz["questions"], concepts)
    elif role == "alex":
        for ex in payload["exercises"]:
            sec = sections.get(ex["section_title"])
            a = Assessment(course_id=course.id, chapter_id=sec.chapter_id if sec else None, section_id=sec.id if sec else None, kind="exercise",
                           agent_role="alex", title=f"Exercices — {ex['section_title']}", quality_status=status, findings=findings)
            db.add(a)
            db.flush()
            _add_questions(db, course, a, ex["questions"], concepts)
    elif role == "max":
        a = Assessment(course_id=course.id, kind="mock_exam", agent_role="max", title=payload["title"], quality_status=status, findings=findings)
        db.add(a)
        db.flush()
        _add_questions(db, course, a, payload["questions"], concepts)
        db.add(AgentArtifact(course_id=course.id, task_id=task_id, kind="mock_exam_meta", language=lang,
                             payload={"assessment_id": str(a.id), "duration_minutes": payload["duration_minutes"]}, quality_status=status, findings=findings))
    elif role == "sage":
        db.add(AgentArtifact(course_id=course.id, task_id=task_id, kind="revision", language=lang, payload=payload, quality_status=status, findings=findings))
    db.commit()


def build_topic_map(db: Session, course: Course) -> dict:
    """Plain-code topic map: concept nodes layered by prerequisite depth."""
    concepts = db.scalars(select(Concept).where(Concept.course_id == course.id)).all()
    ids = {c.id for c in concepts}
    edges = [(p, c) for c, p in db.execute(select(ConceptPrerequisite.concept_id, ConceptPrerequisite.prerequisite_id)).all() if c in ids]
    parents: dict = {}
    for p, c in edges:
        parents.setdefault(c, []).append(p)
    depth: dict = {}

    def d(cid, seen=()):
        if cid in depth:
            return depth[cid]
        if cid in seen:
            return 0
        val = 1 + max((d(p, seen + (cid,)) for p in parents.get(cid, [])), default=-1)
        depth[cid] = val
        return val

    nodes = [{"id": str(c.id), "key": c.key, "label": c.name, "layer": d(c.id), "section_id": str(c.section_id) if c.section_id else None} for c in concepts]
    return {"nodes": sorted(nodes, key=lambda n: (n["layer"], n["label"])), "edges": [{"from": str(p), "to": str(c)} for p, c in edges]}


# ---------------------------------------------------------------- run
def _envelope(task: AgentTask, wf: WorkflowRun, status: str, payload: dict, findings: list, demo: bool, cites: list[str] | None = None) -> dict:
    return AgentEnvelope(task_id=str(task.id), workflow_id=str(wf.id), course_id=str(task.course_id), agent_role=task.agent_role, status=status,
                         payload={"summary": payload} if not isinstance(payload, dict) else {"keys": sorted(payload.keys())},
                         source_citations=cites or [], findings=findings, retry_count=task.retry_count, demo=demo).model_dump(mode="json")


def _run_parallel_role(wf_id: uuid.UUID, task_id: uuid.UUID, script: str) -> None:
    with SessionLocal() as db:
        task = db.get(AgentTask, task_id)
        wf = db.get(WorkflowRun, wf_id)
        course = db.get(Course, task.course_id)
        role = task.agent_role
        task.status = "running"
        db.commit()
        event(db, wf.id, role, "running", ROLE_LABEL[role] + "…", task.id)
        outline = course.outline_digest
        result = _attempt(db, task, lambda: roles.generate(role, db, course, wf.language, script, outline=outline))
        if result is None:
            event(db, wf.id, "jordan", "failed", f"{role.capitalize()} could not finish: {task.error}. You can retry later.", task.id)
            return
        payload = _resolve_payload_citations(db, course, role, result.payload)
        _, _, concepts = _lookup(db, course)
        event(db, wf.id, "riley", "running", f"Riley is checking {role.capitalize()}'s work…", task.id)
        verdict, findings = roles.riley_review(db, course, wf.language, role, payload, set(concepts))
        persist_role_output(db, course, role, payload, wf.language, verdict, findings, task.id)
        task.status = "done" if verdict in ("pass", "unverified", "uncertain") else "needs_review"
        task.output = _envelope(task, wf, "done", payload, findings, result.demo)
        task.updated_at = _now()
        db.commit()
        label = {"pass": "verified", "revise": "flagged for review", "uncertain": "not fully verifiable", "unverified": "provisional (not AI-verified)"}[verdict]
        event(db, wf.id, role, "done", f"{role.capitalize()} finished — {label}.", task.id)


def run_workflow(wf_id: uuid.UUID, script: str = "arabic") -> None:
    with SessionLocal() as db:
        wf = db.get(WorkflowRun, wf_id)
        course = db.get(Course, wf.course_id)
        wf.status = "running"
        db.commit()
        clara = db.scalar(select(AgentTask).where(AgentTask.workflow_id == wf.id, AgentTask.agent_role == "clara"))
        try:
            clara.status = "running"
            db.commit()
            event(db, wf.id, "clara", "running", ROLE_LABEL["clara"] + "…", clara.id)
            result = _attempt(db, clara, lambda: roles.generate("clara", db, course, wf.language, script))
            if result is None:
                raise LLMError(clara.error or "Clara failed")
            payload = result.payload
            findings = roles.riley_rules("clara", payload, set(), set())
            persist_structure(db, course, payload)
            course.outline_digest = build_outline(db, course)
            db.add(AgentArtifact(course_id=course.id, task_id=clara.id, kind="topic_map", language=wf.language, payload=build_topic_map(db, course),
                                 quality_status="pass", findings=[]))
            db.add(AgentArtifact(course_id=course.id, task_id=clara.id, kind="analysis_notes", language=wf.language,
                                 payload={"missing_or_ambiguous": payload.get("missing_or_ambiguous", []), "confidence": payload.get("confidence")},
                                 quality_status="unverified" if result.demo else "pass", findings=findings))
            clara.status = "done"
            clara.output = _envelope(clara, wf, "done", payload, findings, result.demo)
            db.commit()
            event(db, wf.id, "clara", "done", f"Clara found {len(payload['chapters'])} chapters and {len(payload['concepts'])} concepts.", clara.id)
        except (CorpusTooLarge, LLMError) as e:
            clara.status, clara.error = "failed", str(e)
            wf.status, course.status = "failed", "failed"
            db.commit()
            event(db, wf.id, "jordan", "failed", f"Course analysis failed: {e}")
            return
        except Exception:
            log.error("clara crashed: %s", traceback.format_exc())
            clara.status, clara.error = "failed", "internal error"
            wf.status, course.status = "failed", "failed"
            db.commit()
            event(db, wf.id, "jordan", "failed", "Course analysis failed because of an internal error.")
            return

        tasks = db.scalars(select(AgentTask).where(AgentTask.workflow_id == wf.id, AgentTask.agent_role.in_(PARALLEL_ROLES))).all()
        event(db, wf.id, "jordan", "dispatch", "Structure ready. Dispatching practice, quizzes, revision and mock exam in parallel.")
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(_run_parallel_role, wf.id, t.id, script) for t in tasks]
            for f in futures:
                try:
                    f.result()
                except Exception:
                    log.error("role crashed: %s", traceback.format_exc())
        db.expire_all()
        statuses = [t.status for t in db.scalars(select(AgentTask).where(AgentTask.workflow_id == wf.id))]
        for t in db.scalars(select(AgentTask).where(AgentTask.workflow_id == wf.id, AgentTask.status.in_(["pending", "running"]))):
            t.status, t.error = "failed", "internal error"
        wf.status = "done" if all(s == "done" for s in statuses) else "partial"
        wf.updated_at = _now()
        course.status = "ready"
        db.commit()
        event(db, wf.id, "jordan", "finished", "Everything is ready." if wf.status == "done" else "Ready, but some items need review or failed.")
