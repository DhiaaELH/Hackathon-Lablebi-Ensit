"""The specialist roles. One underlying model, distinct prompts/inputs/schemas per role.
Language is a parameter, never a separate agent."""
import copy
import json
import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..llm.provider import DemoProvider, SystemBlock, get_provider
from ..models import Course, SourceChunk
from ..retrieval.search import Hit, format_passages, hybrid_search
from . import demo_course, heuristics
from .context import corpus_block, known_refs
from .prompts import GLOBAL_POLICY, ROLE_PROMPTS, language_instruction
from .schemas import (
    CourseStructure,
    OpenGrade,
    ExerciseSet,
    MockExam,
    ProjectSet,
    QualityReport,
    QuizSet,
    RevisionPack,
    TutorReply,
)

GEN_SCHEMAS = {"clara": CourseStructure, "quinn": QuizSet, "alex": ExerciseSet, "sage": RevisionPack, "max": MockExam}
DEMO_FIXTURES = {"clara": demo_course.STRUCTURE, "quinn": demo_course.QUIZZES, "alex": demo_course.EXERCISES,
                 "sage": demo_course.REVISION, "max": demo_course.MOCK_EXAM}


@dataclass
class AgentResult:
    payload: dict
    demo: bool
    usage: dict = field(default_factory=dict)
    findings: list = field(default_factory=list)


def is_demo() -> bool:
    return isinstance(get_provider(), DemoProvider)


def _chunks(db: Session, course: Course) -> list[SourceChunk]:
    return db.scalars(select(SourceChunk).where(SourceChunk.course_id == course.id).order_by(SourceChunk.ordinal)).all()


def _shared_prefix(db: Session, course: Course) -> list[SystemBlock]:
    """policy + full course corpus, cache breakpoint at the end. Identical for every generation role."""
    corpus = corpus_block(db, course, get_settings().corpus_max_tokens)
    return [SystemBlock(GLOBAL_POLICY), SystemBlock(corpus, cache=True)]


# ---------------------------------------------------------------- generation roles
def generate(role: str, db: Session, course: Course, lang: str, script: str, outline: str | None = None,
             demo_structure: dict | None = None) -> AgentResult:
    if is_demo():
        if course.is_demo:
            return AgentResult(copy.deepcopy(DEMO_FIXTURES[role]), demo=True)
        struct = demo_structure or heuristics.structure(_chunks(db, course), course.title)
        fn = {"clara": lambda: struct, "quinn": lambda: heuristics.quizzes(struct), "alex": lambda: heuristics.exercises(struct),
              "sage": lambda: heuristics.revision(struct), "max": lambda: heuristics.mock_exam(heuristics.quizzes(struct))}[role]
        return AgentResult(fn(), demo=True)

    user = f"{ROLE_PROMPTS[role]}\n\n{language_instruction(lang, script)}"
    if outline:
        user += f"\n\n<outline>\n{outline}\n</outline>"
    parsed, meta = get_provider().structured(
        role, _shared_prefix(db, course), [{"role": "user", "content": user}], GEN_SCHEMAS[role],
        effort="high" if role == "clara" else None,
    )
    return AgentResult(parsed.model_dump(mode="json"), demo=False, usage=meta.usage)


def projects(db: Session, course: Course, chapter_title: str, concept_keys: list[str], outline: str, lang: str, script: str) -> AgentResult:
    if is_demo():
        fx = demo_course.PROJECTS.get(chapter_title) if course.is_demo else None
        return AgentResult(copy.deepcopy(fx) if fx else heuristics.projects(chapter_title, concept_keys), demo=True)
    user = (f"{ROLE_PROMPTS['alex_projects']}\n\n{language_instruction(lang, script)}\n\nCompleted chapter: {chapter_title}\n"
            f"Concept keys: {', '.join(concept_keys)}\n\n<outline>\n{outline}\n</outline>")
    parsed, meta = get_provider().structured("alex", _shared_prefix(db, course), [{"role": "user", "content": user}], ProjectSet)
    return AgentResult(parsed.model_dump(mode="json"), demo=False, usage=meta.usage)


# ---------------------------------------------------------------- Riley
def _question_rules(q: dict, refs: set[str], concept_keys: set[str], where: str) -> list[dict]:
    f = []
    if len(q.get("choices", [])) != 4:
        f.append({"severity": "high", "item": where, "issue": "Question must have exactly 4 choices."})
    ci = q.get("correct_index")
    if not isinstance(ci, int) or not 0 <= ci < len(q.get("choices", [])):
        f.append({"severity": "high", "item": where, "issue": "Answer key index is out of range."})
    elif len(q["choices"][ci]) > 12 and q["choices"][ci].lower() in q.get("prompt", "").lower():
        f.append({"severity": "medium", "item": where, "issue": "The correct answer appears verbatim in the question (leak)."})
    if len(set(c.strip().lower() for c in q.get("choices", []))) < len(q.get("choices", [])):
        f.append({"severity": "medium", "item": where, "issue": "Duplicate choices."})
    if concept_keys and q.get("concept_key") not in concept_keys:
        f.append({"severity": "low", "item": where, "issue": f"Unknown concept key '{q.get('concept_key')}'."})
    bad = [c for c in q.get("citations", []) if c not in refs]
    if bad or not q.get("citations"):
        f.append({"severity": "medium", "item": where, "issue": "Missing or invalid source citation." + (f" ({', '.join(bad)})" if bad else "")})
    return f


def riley_rules(kind: str, payload: dict, refs: set[str], concept_keys: set[str]) -> list[dict]:
    """Deterministic checks that always run, with or without an LLM."""
    findings: list[dict] = []
    if kind == "quinn":
        for qz in payload.get("quizzes", []):
            for i, q in enumerate(qz["questions"]):
                findings += _question_rules(q, refs, concept_keys, f"{qz['chapter_title']} Q{i + 1}")
    elif kind == "alex":
        for ex in payload.get("exercises", []):
            for i, q in enumerate(ex["questions"]):
                findings += _question_rules(q, refs, concept_keys, f"{ex['section_title']} E{i + 1}")
            for i, pb in enumerate(ex.get("problems", [])):
                where = f"{ex['section_title']} P{i + 1}"
                if len(pb.get("rubric", [])) < 2 or not pb.get("worked_solution", "").strip():
                    findings.append({"severity": "high", "item": where, "issue": "Open problem needs a worked solution and at least 2 rubric points."})
                if not pb.get("hints"):
                    findings.append({"severity": "low", "item": where, "issue": "Open problem has no hints."})
                bad = [c for c in pb.get("citations", []) if c not in refs]
                if bad or not pb.get("citations"):
                    findings.append({"severity": "medium", "item": where, "issue": "Missing or invalid source citation."})
    elif kind == "max":
        for i, q in enumerate(payload.get("questions", [])):
            findings += _question_rules(q, refs, concept_keys, f"Mock Q{i + 1}")
    elif kind == "sage":
        for s in payload.get("summaries", []):
            if not s.get("citations") or any(c not in refs for c in s["citations"]):
                findings.append({"severity": "medium", "item": s["chapter_title"], "issue": "Summary has missing/invalid citations."})
        for i, fc in enumerate(payload.get("flashcards", [])):
            if any(c not in refs for c in fc.get("citations", [])):
                findings.append({"severity": "low", "item": f"Flashcard {i + 1}", "issue": "Invalid citation."})
    elif kind == "clara":
        keys = {c["key"] for c in payload.get("concepts", [])}
        for c in payload.get("concepts", []):
            missing = [p for p in c["prerequisites"] if p not in keys]
            if missing:
                findings.append({"severity": "low", "item": c["key"], "issue": f"Unknown prerequisites {missing} were dropped."})
    return findings


def riley_review(db: Session, course: Course, lang: str, kind: str, payload: dict, concept_keys: set[str]) -> tuple[str, list[dict]]:
    refs = known_refs(db, course.id)
    findings = riley_rules(kind, payload, refs, concept_keys)
    high = any(f["severity"] == "high" for f in findings)
    if is_demo():
        findings.append({"severity": "low", "item": "Quality check", "issue": "Rule checks only: AI quality review not run in demo mode."})
        return ("revise" if high else "unverified"), findings
    from ..models import GlossaryTerm

    terms = db.scalars(select(GlossaryTerm).where(GlossaryTerm.course_id == course.id, GlossaryTerm.review_state == "reviewed").order_by(GlossaryTerm.term_fr)).all()
    glossary = "\n".join(f"- {g.term_fr} | AR: {g.term_ar or '-'} | Derja: {g.term_derja or '-'} | EN: {g.term_en or '-'}: {g.explanation}" for g in terms)
    user = (f"{ROLE_PROMPTS['riley']}\n\n{language_instruction(lang)}\n\n"
            + (f"<glossary>\nCheck terminology against these reviewed terms:\n{glossary}\n</glossary>\n\n" if glossary else "")
            + f"<artifact kind=\"{kind}\">\n"
            f"{json.dumps(payload, ensure_ascii=False, sort_keys=True)}\n</artifact>")
    try:
        report, _ = get_provider().structured("riley", _shared_prefix(db, course), [{"role": "user", "content": user}], QualityReport, effort="low")
    except Exception:
        findings.append({"severity": "low", "item": "Quality check", "issue": "Quality checker unavailable; content is provisional."})
        return "unverified", findings
    findings += [f.model_dump() for f in report.findings]
    verdict = "revise" if high else report.verdict
    return verdict, findings


# ---------------------------------------------------------------- Sam (tutor)
HISTORY_WINDOW = 20


def stable_history(history: list[dict]) -> list[dict]:
    """Window that only moves in steps of HISTORY_WINDOW so the cached conversation prefix stays valid
    for many turns (a sliding window would change the prefix on every turn)."""
    n = len(history)
    start = max(0, (n // HISTORY_WINDOW - 1) * HISTORY_WINDOW)
    msgs = history[start:]
    while msgs and msgs[0]["role"] != "user":
        msgs = msgs[1:]
    return msgs


def render_tutor_turn(mode: str, message: str, hits: list[Hit], lang: str, script: str, hint_level: int,
                      question: dict | None, chosen_index: int | None) -> str:
    parts = [f"<passages>\n{format_passages(hits) or '(no matching passage found)'}\n</passages>",
             language_instruction(lang, script), f"Mode: {mode}"]
    if mode == "hint":
        parts.append(f"Hint level: {hint_level}")
    if question:
        parts.append("Exercise question: " + question["prompt"] + "\nChoices: " + " | ".join(f"{i}) {c}" for i, c in enumerate(question["choices"])))
        if chosen_index is not None and chosen_index < len(question["choices"]):
            parts.append(f"Student chose: {chosen_index}) {question['choices'][chosen_index]}")
        if question.get("correct_index") is not None:  # only after the student has attempted it
            parts.append(f"Correct answer: {question['correct_index']}) {question['choices'][question['correct_index']]}")
    parts.append(f"Student message: {message}")
    return "\n\n".join(parts)


def tutor(db: Session, course: Course, scope_course_ids: list[uuid.UUID], outline: str, lang: str, script: str,
          mode: str, message: str, history: list[dict], hint_level: int = 1, question: dict | None = None,
          chosen_index: int | None = None, prev_method: str | None = None) -> tuple[dict, str, bool]:
    """Returns (reply dict, rendered user turn for history replay, demo flag)."""
    query = message if not question else f"{question['prompt']} {message}"
    hits = hybrid_search(db, scope_course_ids, query, k=5)
    rendered = render_tutor_turn(mode, message, hits, lang, script, hint_level, question, chosen_index)
    hit_refs = {h.ref for h in hits}

    if isinstance(get_provider("fast"), DemoProvider):
        return _demo_tutor(mode, lang, hits, hint_level, question, chosen_index), rendered, True

    if prev_method and mode == "alternate":
        rendered += f"\n\nPrevious explanation method (do not reuse): {prev_method}"
    system = [SystemBlock(GLOBAL_POLICY), SystemBlock(f"{ROLE_PROMPTS['sam']}\n\n<course_outline>\n{outline}\n</course_outline>", cache=True)]
    messages = stable_history(history) + [{"role": "user", "content": rendered}]
    reply, _ = get_provider("fast").structured("sam", system, messages, TutorReply, app_cache=False, auto_cache=True, effort="low" if mode in ("hint", "socratic", "ask") else None)
    data = reply.model_dump()
    valid = [c for c in data["citations"] if c in hit_refs]
    if len(valid) != len(data["citations"]):
        data["citations"] = valid  # never show a citation that was not actually retrieved
    if not hits:
        data["supported_by_course"] = False
    return data, rendered, False


def _loc(h: Hit) -> str:
    return f"p. {h.page}" if h.page else h.ref


def _demo_tutor(mode: str, lang: str, hits: list[Hit], hint_level: int, question: dict | None, chosen_index: int | None) -> dict:
    T = heuristics.t
    note = T("demo_note", lang)
    if mode == "explain_mistake" and question is not None and chosen_index is not None and question.get("correct_index") is not None:
        ci = question["correct_index"]
        notes = question.get("distractor_notes") or []
        msg = T("explain_mistake", lang, chosen=question["choices"][chosen_index], note=(notes[chosen_index] if chosen_index < len(notes) else ""),
                correct=question["choices"][ci], explanation=question.get("explanation", ""))
        return {"message": f"{msg}\n\n{note}", "citations": question.get("citations", [])[:2], "supported_by_course": True,
                "method": "misconception analysis", "follow_up_question": ""}
    if not hits:
        return {"message": f"{T('unsupported', lang)}\n\n{note}", "citations": [], "supported_by_course": False, "method": "none", "follow_up_question": ""}
    top = hits[0]
    if mode == "socratic":
        msg, method = T("socratic", lang, quote=heuristics.quote(top.text), loc=_loc(top)), "guiding question"
    elif mode == "hint":
        h = hits[min(hint_level - 1, len(hits) - 1)] if hint_level < 3 else top
        msg, method = T("hint", lang, level=hint_level, quote=heuristics.quote(h.text, 120 + 60 * hint_level), loc=_loc(h)), "progressive hint"
    elif mode == "alternate":
        msg, method = T("alternate", lang, steps=heuristics.steps_from(top.text)), "step-by-step decomposition"
    else:
        msg, method = T("answer", lang, loc=_loc(top), text=top.text[:600]), "direct explanation"
    return {"message": f"{msg}\n\n{note}", "citations": [top.ref] + ([hits[1].ref] if len(hits) > 1 and mode == "answer" else []),
            "supported_by_course": True, "method": method, "follow_up_question": ""}


# ---------------------------------------------------------------- open-problem grading (fast tier)
def grade_open(db: Session, course: Course, question: dict, answer: str, lang: str, script: str) -> tuple[dict, bool]:
    """Returns (grading dict, demo flag). The reference solution stays server-side."""
    provider = get_provider("fast")
    if isinstance(provider, DemoProvider):
        return _demo_grade(question, answer), True
    hits = hybrid_search(db, [course.id], question["prompt"], k=3)
    rubric = "\n".join(f"- {r}" for r in question["rubric"])
    user = (f"{ROLE_PROMPTS['grader']}\n\n{language_instruction(lang, script)}\n\n"
            f"<passages>\n{format_passages(hits)}\n</passages>\n\n"
            f"<exercise>\n{question['prompt']}\n</exercise>\n\n<reference>\nRubric:\n{rubric}\n\nReference solution:\n{question['solution']}\n</reference>\n\n"
            f"<student_answer>\n{answer}\n</student_answer>")
    grade, _ = provider.structured("grader", [SystemBlock(GLOBAL_POLICY)], [{"role": "user", "content": user}], OpenGrade, app_cache=False, effort="low")
    data = grade.model_dump()
    data["score"] = max(0, min(100, data["score"]))
    return data, False


def _demo_grade(question: dict, answer: str) -> dict:
    """Rule-based estimate: share of rubric points whose key words appear in the answer."""
    import re as _re
    import unicodedata as _ud

    def norm(t: str) -> set[str]:
        t = _ud.normalize("NFKD", t.lower()).encode("ascii", "ignore").decode()
        return {w for w in _re.findall(r"[a-z0-9./]{2,}", t) if w not in {"les", "des", "une", "est", "pas", "the", "and", "par", "pour", "avec"}}

    ans = norm(answer)
    met, missing = [], []
    for point in question["rubric"]:
        words = norm(point)
        hit = len(words & ans) / max(1, len(words))
        (met if hit >= 0.4 else missing).append(point)
    score = round(100 * len(met) / max(1, len(question["rubric"])))
    return {"score": score, "met": met, "missing": missing, "misconception": "",
            "feedback": "Estimation par mots-clés (mode démo, pas d'IA) : compare ta réponse avec les points attendus, puis regarde la solution."}
