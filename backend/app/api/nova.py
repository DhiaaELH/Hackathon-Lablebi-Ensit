"""Nova - the student liaison. Routing is plain code (a keyword table in FR/EN/AR/Derja): it picks only the
relevant specialist(s), makes the hand-off visible, and never invents a specialist's answer."""
import json
import re
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..agents import roles
from ..config import get_settings
from ..db import get_db
from ..llm.provider import LLMError
from ..models import (
    AgentArtifact,
    AgentTask,
    Assessment,
    Concept,
    ConceptPrerequisite,
    ContentReport,
    ProgressEvent,
    Question,
    TutorConversation,
    TutorMessage,
    WorkflowRun,
)
from ..security import current_user, get_readable_course, rate_limit

router = APIRouter(prefix="/api", tags=["nova"])

ROUTES = [
    ("jordan", r"\b(statut|status|avancement|progress of generation|prêt|ready|where are|ça avance)\b|وين وصل|واش حضر|حالة"),
    ("max", r"examen blanc|mock exam|exam blanc|امتحان تجريبي|اكزامان"),
    ("sage", r"résumé|resume|summary|flashcards?|fiche|carte mentale|topic map|ملخص|لخص|فيش"),
    ("quinn", r"\bquiz\b|\btest\b|diagnostic|اختبار|كويز"),
    ("alex", r"exercices?|exercises?|practice|entraîn|projets?|projects?|تمارين|تمرين|مشروع|پروجي"),
    ("clara", r"prérequis|prerequisite|plan du cours|structure|sommaire|outline|متطلبات|شنوة لازم نعرف"),
    ("resource_finder", r"vidéo|video|youtube|ressources?|resources?|lien|link|فيديو|مصادر"),
    ("riley", r"(c'est|est) faux dans|erreur dans (le|la) (quiz|cours|résumé)|wrong in the|mistake in the (quiz|summary)|غلطة في"),
]

HANDOFF = {
    "fr": "Je vérifie avec {name}…", "en": "Checking this with {name}…", "ar": "أتحقق من ذلك مع {name}…", "derja": "نثبّت مع {name}…",
}
# Only the two personas the student talks to keep a name (Nova, Sam); background roles are described by what they do.
NAMES = {"sam": "Sam", "clara": "the course analysis", "alex": "the practice exercises", "quinn": "the quizzes",
         "sage": "the revision material", "max": "the mock exams", "resource_finder": "the resource search", "jordan": "the generation status",
         "riley": "the quality check"}
NAMES_FR = {"sam": "Sam", "clara": "l'analyse du cours", "alex": "les exercices", "quinn": "les quiz", "sage": "les fiches de révision",
            "max": "les examens blancs", "resource_finder": "la recherche de ressources", "jordan": "l'état de la génération", "riley": "le contrôle qualité"}
NAMES_AR = {"sam": "Sam", "clara": "تحليل الدرس", "alex": "التمارين", "quinn": "الاختبارات", "sage": "مواد المراجعة", "max": "الامتحانات التجريبية",
            "resource_finder": "البحث عن المصادر", "jordan": "حالة التوليد", "riley": "مراقبة الجودة"}
LABELS = {"fr": NAMES_FR, "en": NAMES, "ar": NAMES_AR, "derja": NAMES_AR}
ITEMS = {"quinn": "quiz", "max": "mock exam", "alex": "exercise set"}


def route(message: str, mode: str | None) -> list[str]:
    if mode and mode != "ask":
        return ["sam"]
    low = message.lower()
    targets = [role for role, pattern in ROUTES if re.search(pattern, low)]
    return targets[:3] or ["sam"]


class NovaIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    mode: Literal["ask", "socratic", "hint", "answer", "alternate", "explain_mistake", "mini_lesson"] | None = None
    hint_level: int = Field(default=1, ge=1, le=3)
    question_id: uuid.UUID | None = None
    chosen_index: int | None = Field(default=None, ge=0, le=9)
    concept_id: uuid.UUID | None = None
    language: Literal["fr", "en", "ar", "derja"] | None = None


def _conversation(db: Session, user_id, course_id) -> TutorConversation:
    conv = db.scalar(select(TutorConversation).where(TutorConversation.user_id == user_id, TutorConversation.course_id == course_id))
    if not conv:
        conv = TutorConversation(user_id=user_id, course_id=course_id)
        db.add(conv)
        db.flush()
    return conv


def _history(db: Session, conv: TutorConversation) -> list[dict]:
    """Replays exactly the bytes sent previously (meta.replay) so the cached conversation prefix matches."""
    msgs = db.scalars(select(TutorMessage).where(TutorMessage.conversation_id == conv.id, TutorMessage.agent_role == "sam")
                      .order_by(TutorMessage.id)).all()
    out = []
    for m in msgs:
        replay = (m.meta or {}).get("replay")
        if replay:
            out.append({"role": m.role, "content": replay})
    return out


def _specialist_summary(db: Session, course, role: str, message: str, lang: str, user) -> tuple[str, list[str], dict | None]:
    """Non-tutor routes answered from persisted specialist results (never fabricated)."""
    if role == "jordan":
        wf = db.scalar(select(WorkflowRun).where(WorkflowRun.course_id == course.id).order_by(WorkflowRun.created_at.desc()))
        if not wf:
            return "No generation has been started for this course yet.", [], None
        tasks = db.scalars(select(AgentTask).where(AgentTask.workflow_id == wf.id)).all()
        parts = ", ".join(f"{NAMES.get(t.agent_role, t.agent_role)}: {t.status}" for t in tasks)
        return f"Workflow status: {wf.status}. {parts}.", [], {"open": "overview"}
    if role == "sage":
        rev = db.scalar(select(AgentArtifact).where(AgentArtifact.course_id == course.id, AgentArtifact.kind == "revision"))
        if not rev:
            return "The revision material is not ready yet.", [], None
        return (f"There are {len(rev.payload.get('summaries', []))} chapter summaries and {len(rev.payload.get('flashcards', []))} flashcards "
                f"(quality: {rev.quality_status}). Open the Revision tab to read them, flip flashcards or download the PDF."), [], {"open": "revision"}
    if role in ("quinn", "max", "alex"):
        kind = {"quinn": "chapter_quiz", "max": "mock_exam", "alex": "exercise"}[role]
        items = db.scalars(select(Assessment).where(Assessment.course_id == course.id, Assessment.kind == kind)).all()
        if not items:
            return f"No {ITEMS[role]} is ready yet for this course.", [], None
        extra = " Applied projects unlock when you complete a chapter." if role == "alex" else ""
        return f"{len(items)} {ITEMS[role]}(s) ready: " + "; ".join(a.title for a in items[:5]) + "." + extra, [], {"open": "practice"}
    if role == "clara":
        concepts = db.scalars(select(Concept).where(Concept.course_id == course.id)).all()
        low = message.lower()
        match = next((c for c in concepts if c.name.lower() in low or c.key.replace("_", " ") in low), None)
        if match:
            pre_ids = db.scalars(select(ConceptPrerequisite.prerequisite_id).where(ConceptPrerequisite.concept_id == match.id)).all()
            pres = [c.name for c in concepts if c.id in pre_ids]
            return (f"According to the course analysis, '{match.name}' builds on: {', '.join(pres) or 'no earlier concept in this course'}.",
                    match.citations, {"open": "map"})
        return f"This course has {len(concepts)} concepts. The Topic map shows how they depend on each other.", [], {"open": "map"}
    if role == "resource_finder":
        if not get_settings().gemini_api_key:
            return "No verified external resource: the search service is not configured on this server, so I won't suggest links.", [], None
        return "The resource search looks through the web and checks every link before showing it. Open the Resources tab to run it.", [], {"open": "resources"}
    if role == "riley":
        db.add(ContentReport(reporter_id=user.id, target_type="ai_content", target_id=str(course.id), reason=message[:1000]))
        db.commit()
        return "Thanks — I sent this to the quality review queue. The item stays marked provisional until it is checked.", [], None
    return "", [], None


@router.post("/courses/{course_id}/nova", dependencies=[Depends(rate_limit("nova", 20, 60))])
def nova(course_id: uuid.UUID, body: NovaIn, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_readable_course(db, user, course_id)
    lang = body.language or user.profile.locale
    script = user.profile.derja_script
    targets = route(body.message, body.mode)
    conv = _conversation(db, user.id, course.id)
    db.add(TutorMessage(conversation_id=conv.id, role="user", agent_role=None, mode=body.mode, content=body.message))
    db.commit()

    question, a = None, None
    if body.question_id:
        q = db.get(Question, body.question_id)
        a = db.get(Assessment, q.assessment_id) if q else None
        if not q or a.course_id != course.id:
            raise HTTPException(404, "Question not found")
        question = {"prompt": q.prompt, "choices": q.choices, "correct_index": q.correct_index, "explanation": q.explanation,
                    "distractor_notes": q.distractor_notes, "citations": q.citations}
        if body.mode == "explain_mistake" and body.chosen_index is None:
            raise HTTPException(400, "chosen_index is required to explain a mistake")
        if body.mode in ("explain_mistake", "answer"):
            attempted = db.scalar(select(func.count()).select_from(ProgressEvent).where(
                ProgressEvent.user_id == user.id, ProgressEvent.kind == "attempt", ProgressEvent.ref_id == str(a.id)))
            if not attempted:
                question["correct_index"] = None  # never reveal the key before the student has attempted it
                if body.mode == "explain_mistake":
                    raise HTTPException(400, "Submit your answer first")
    message = body.message
    if body.mode == "mini_lesson" and body.concept_id:
        c = db.get(Concept, body.concept_id)
        if not c or c.course_id != course.id:
            raise HTTPException(404, "Concept not found")
        message = f"Mini-lesson please on: {c.name}. {c.description}"

    replies = []
    for role in targets:
        handoff = HANDOFF.get(lang, HANDOFF["en"]).format(name=LABELS.get(lang, NAMES)[role])
        if role == "sam":
            # Retrieval scope: this course only (already authorised above).
            history = _history(db, conv)
            last = db.scalar(select(TutorMessage).where(TutorMessage.conversation_id == conv.id, TutorMessage.agent_role == "sam").order_by(TutorMessage.id.desc()))
            prev_method = (last.meta or {}).get("method") if last else None
            try:
                data, rendered, demo = roles.tutor(db, course, [course.id], course.outline_digest or "", lang, script, body.mode or "ask", message, history,
                                                   body.hint_level, question, body.chosen_index, prev_method)
            except LLMError as e:
                replies.append({"agent_role": "sam", "handoff": handoff, "message": f"Sam is not available right now ({e}). Please retry.",
                                "citations": [], "supported": None, "error": True, "demo": False})
                continue
            if body.mode == "hint":
                hint_section = str(a.section_id) if question and a.section_id else None
                db.add(ProgressEvent(user_id=user.id, course_id=course.id, kind="hint", ref_id=hint_section, data={"level": body.hint_level}))
            db.add(TutorMessage(conversation_id=conv.id, role="user", agent_role="sam", mode=body.mode, content=message, meta={"replay": rendered}))
            db.add(TutorMessage(conversation_id=conv.id, role="assistant", agent_role="sam", mode=body.mode, content=data["message"], citations=data["citations"],
                                meta={"replay": json.dumps(data, ensure_ascii=False, sort_keys=True), "method": data.get("method"), "demo": demo}))
            db.commit()
            replies.append({"agent_role": "sam", "handoff": handoff, "message": data["message"], "citations": data["citations"],
                            "supported": data["supported_by_course"], "method": data.get("method"), "follow_up": data.get("follow_up_question"), "demo": demo})
        else:
            text, cites, action = _specialist_summary(db, course, role, body.message, lang, user)
            db.add(TutorMessage(conversation_id=conv.id, role="assistant", agent_role=role, content=text, citations=cites))
            db.commit()
            replies.append({"agent_role": role, "handoff": handoff, "message": text, "citations": cites, "action": action, "demo": roles.is_demo()})
    return {"routed_to": targets, "replies": replies}


@router.get("/courses/{course_id}/nova/history")
def nova_history(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    course = get_readable_course(db, user, course_id)
    conv = db.scalar(select(TutorConversation).where(TutorConversation.user_id == user.id, TutorConversation.course_id == course.id))
    if not conv:
        return []
    msgs = db.scalars(select(TutorMessage).where(TutorMessage.conversation_id == conv.id).order_by(TutorMessage.id)).all()
    # Hide the internal duplicate user turns stored for cache-stable replay.
    return [{"id": m.id, "role": m.role, "agent_role": m.agent_role, "mode": m.mode, "content": m.content, "citations": m.citations,
             "demo": (m.meta or {}).get("demo", False), "at": m.created_at.isoformat()}
            for m in msgs if not (m.role == "user" and m.agent_role == "sam")]



@router.delete("/courses/{course_id}/nova/history")
def clear_nova_history(course_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    """The student erases their own conversation with Nova for this course."""
    course = get_readable_course(db, user, course_id)
    for conv in db.scalars(select(TutorConversation).where(TutorConversation.user_id == user.id, TutorConversation.course_id == course.id)):
        db.delete(conv)
    db.commit()
    return {"ok": True}
