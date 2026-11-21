"""DEMO MODE ONLY: deterministic, rule-based stand-ins for the agents when no LLM key is configured.
Output is plausible but shallow and is always labelled "demo" in the UI. It never claims a model ran."""
import random
import re
import unicodedata

from ..models import SourceChunk

DEF_RE = re.compile(r"^\s*([A-ZÀ-Ýa-zà-ÿ؀-ۿ][\w\s'’\-/()]{1,50}?)\s*[:：]\s+(.{12,240})$", re.M)
DEF2_RE = re.compile(r"^\s*(?:(?:L[ea]|Un|Une|The|An?)\s+)?([A-ZÀ-Ýa-zà-ÿ][\w\-'’ ]{2,40}?)\s+(?:est|is|sont|are)\s+(.{12,200}?)[.]", re.M)
FORMULA_RE = re.compile(r"^\s*(?:Formule|Formula)\s*:\s*(.+)$", re.M | re.I)
HARD_RE = re.compile(r"^\s*(?:Point difficile|Attention|Remarque importante|Common mistake)\s*:\s*(.+)$", re.M | re.I)


def slug(text: str) -> str:
    t = unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", t).strip("_")[:40] or "concept"


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.replace("\n", " ")) if len(s.strip()) > 25]


def structure(chunks: list[SourceChunk], course_title: str) -> dict:
    """Group chunks by heading: '# ...'/'Chapitre' headings start chapters, others start sections."""
    chapters: list[dict] = []
    current_ch: dict | None = None
    current_sec: dict | None = None
    for c in chunks:
        hint = c.section_hint or ""
        is_chapter_heading = bool(re.match(r"^(chapitre|chapter|partie|part)\b", hint, re.I))
        chapter_title = hint if is_chapter_heading else None
        if current_ch is None or (chapter_title and chapter_title != current_ch["title"]):
            current_ch = {"title": chapter_title or f"Partie {len(chapters) + 1}", "summary": "", "sections": [], "citations": []}
            chapters.append(current_ch)
            current_sec = None
        sec_title = hint or f"Section {len(current_ch['sections']) + 1}"
        if current_sec is None or (current_sec["title"] != sec_title and not is_chapter_heading):
            current_sec = {"title": sec_title, "content": "", "objectives": [], "key_terms": [], "formulas": [], "hard_points": [], "concept_keys": [], "citations": [], "_text": ""}
            current_ch["sections"].append(current_sec)
        current_sec["_text"] += "\n" + c.text
        current_sec["citations"].append(c.ref)
        current_ch["citations"].append(c.ref)
        # Very long untitled material: start a new part every 4 chunks
        if not hint and len(current_sec["citations"]) >= 4:
            current_sec = None
            if len(current_ch["sections"]) >= 3:
                current_ch = None

    concepts: list[dict] = []
    seen: set[str] = set()
    prev_key: str | None = None
    for ch in chapters:
        for sec in ch["sections"]:
            text = sec.pop("_text")
            sents = _sentences(text)
            sec["content"] = " ".join(sents[:3])[:700] or text[:500]
            terms = [(m.group(1).strip(), m.group(2).strip()) for m in DEF_RE.finditer(text)]
            terms += [(m.group(1).strip(), m.group(2).strip()) for m in DEF2_RE.finditer(text)]
            uniq = []
            for t, d in terms:
                if t.lower() not in {u[0].lower() for u in uniq} and not t.lower().startswith(("formule", "formula", "point difficile", "exemple")):
                    uniq.append((t, d))
            sec["key_terms"] = [{"term": t, "definition": d} for t, d in uniq[:5]]
            sec["formulas"] = [{"name": f"Formule {i + 1}", "expression": f.strip(), "meaning": ""} for i, f in enumerate(FORMULA_RE.findall(text))]
            sec["hard_points"] = [h.strip() for h in HARD_RE.findall(text)]
            sec["objectives"] = [f"Comprendre : {sec['title']}"]
            key = slug(sec["title"])
            base, i = key, 2
            while key in seen:
                key, i = f"{base}_{i}", i + 1
            seen.add(key)
            sec["concept_keys"] = [key]
            concepts.append({"key": key, "name": sec["title"], "description": (sec["key_terms"][0]["definition"] if sec["key_terms"] else sec["content"][:160]),
                             "section_title": sec["title"], "prerequisites": [prev_key] if prev_key else [], "citations": sec["citations"][:2]})
            prev_key = key
        ch["summary"] = " ".join(s["title"] for s in ch["sections"])[:300]
    return {"chapters": chapters, "concepts": concepts,
            "missing_or_ambiguous": ["Demo mode: structure inferred from headings by rules, not by an AI model."], "confidence": 0.4}


def _mcq_from_terms(terms: list[tuple[str, str, str, list[str]]], rng: random.Random, limit: int) -> list[dict]:
    """terms: (term, definition, concept_key, citations). Ask which definition matches the term."""
    out = []
    for i, (term, definition, ckey, cites) in enumerate(terms[:limit]):
        others = [d for j, (_, d, _, _) in enumerate(terms) if j != i]
        if len(others) < 3:
            break
        distractors = rng.sample(others, 3)
        choices = distractors + [definition]
        rng.shuffle(choices)
        correct = choices.index(definition)
        out.append({"concept_key": ckey, "prompt": f"Quelle définition correspond à « {term} » ?", "choices": choices, "correct_index": correct,
                    "explanation": f"D'après le cours : {term} — {definition}", "distractor_notes": ["" if k == correct else "Définition d'un autre terme du cours." for k in range(4)],
                    "citations": cites, "points": 1})
    return out


def _all_terms(struct: dict, chapter_title: str | None = None) -> list[tuple[str, str, str, list[str]]]:
    terms = []
    for ch in struct["chapters"]:
        if chapter_title and ch["title"] != chapter_title:
            continue
        for s in ch["sections"]:
            for kt in s["key_terms"]:
                terms.append((kt["term"], kt["definition"], s["concept_keys"][0], s["citations"][:1]))
    return terms


def quizzes(struct: dict) -> dict:
    rng = random.Random(7)
    pool = _all_terms(struct)
    out = []
    for ch in struct["chapters"]:
        own = _all_terms(struct, ch["title"])
        qs = _mcq_from_terms(own + [t for t in pool if t not in own], rng, limit=max(1, min(4, len(own))))
        qs = [q for q in qs if any(q["prompt"].endswith(f"« {t[0]} » ?") for t in own)]
        if qs:
            out.append({"chapter_title": ch["title"], "questions": qs})
    return {"quizzes": out}


def exercises(struct: dict) -> dict:
    rng = random.Random(11)
    pool = _all_terms(struct)
    out = []
    for ch in struct["chapters"]:
        for s in ch["sections"]:
            own = [(kt["term"], kt["definition"], s["concept_keys"][0], s["citations"][:1]) for kt in s["key_terms"]]
            if not own:
                continue
            qs = _mcq_from_terms(own + [t for t in pool if t not in own], rng, limit=1)
            if qs:
                qs[0]["prompt"] = "Exercice : " + qs[0]["prompt"]
            term, definition, ckey, cites = own[0]
            problem = {"concept_key": ckey, "difficulty": "easy", "citations": cites,
                       "statement": f"Expliquez avec vos propres mots la notion de « {term} », puis donnez un exemple concret et une erreur fréquente à éviter.",
                       "hints": [f"Relisez la section « {s['title']} ».", "Commencez par la définition, puis appliquez-la à un cas simple."],
                       "worked_solution": f"{term} : {definition}",
                       "rubric": [f"Définition correcte de « {term} »", "Un exemple concret et juste", "Une erreur fréquente identifiée"]}
            out.append({"section_title": s["title"], "questions": qs, "problems": [problem]})
    return {"exercises": out[:8]}


def revision(struct: dict) -> dict:
    summaries = [{"chapter_title": ch["title"], "bullets": [s["content"][:220] for s in ch["sections"]][:6], "citations": ch["citations"][:4]} for ch in struct["chapters"]]
    cards = []
    for ch in struct["chapters"]:
        for s in ch["sections"]:
            cards += [{"front": kt["term"], "back": kt["definition"], "kind": "term", "citations": s["citations"][:1]} for kt in s["key_terms"]]
            cards += [{"front": f["name"], "back": f["expression"], "kind": "formula", "citations": s["citations"][:1]} for f in s["formulas"]]
    return {"summaries": summaries, "flashcards": cards[:30]}


def mock_exam(quiz_set: dict) -> dict:
    qs = [dict(q, points=2) for qz in quiz_set["quizzes"] for q in qz["questions"]][:10]
    return {"title": "Examen blanc (démo)", "duration_minutes": max(10, 3 * len(qs)), "questions": qs}


def projects(chapter_title: str, concept_keys: list[str]) -> dict:
    return {"projects": [{
        "title": f"Fiche pratique : {chapter_title}", "goal": "Appliquer les notions du chapitre sur un petit cas concret de votre choix et le présenter à un camarade.",
        "concept_keys": concept_keys[:3], "steps": ["Choisir un cas concret", "Appliquer chaque notion du chapitre", "Écrire une page d'explication", "Faire relire par un pair"],
        "difficulty": "beginner", "effort_hours": 2, "materials": ["Notes du cours", "Papier ou éditeur de texte"], "success_criteria": ["Chaque notion est utilisée correctement", "Un camarade comprend l'explication"]}]}


# ---------------------------------------------------------------- tutor templates
TUTOR_TEXT = {
    "socratic": {
        "fr": "Avant que je t'explique : d'après toi, que signifie ce passage ? Relis « {quote} » ({loc}). Qu'est-ce que tu en retiens ?",
        "en": "Before I explain: what do you think this part means? Re-read “{quote}” ({loc}). What do you take from it?",
        "ar": "قبل أن أشرح: ما الذي تفهمه من هذا المقطع؟ أعد قراءة «{quote}» ({loc}). ماذا تستنتج؟",
        "derja": "قبل ما نفسّرلك: إنتِ شنوّة تفهم من الجزء هذا؟ عاود اقرا «{quote}» ({loc}). شنوّة فهمت منّو؟",
    },
    "hint": {
        "fr": "Indice {level} : concentre-toi sur ce passage du cours ({loc}) : « {quote} »",
        "en": "Hint {level}: focus on this part of the course ({loc}): “{quote}”",
        "ar": "تلميح {level}: ركّز على هذا الجزء من الدرس ({loc}): «{quote}»",
        "derja": "تلميح {level}: ركّز على الجزء هذا من الكور ({loc}): «{quote}»",
    },
    "answer": {
        "fr": "Voici ce que dit ton cours ({loc}) : {text}",
        "en": "Here is what your course says ({loc}): {text}",
        "ar": "هذا ما يقوله درسك ({loc}): {text}",
        "derja": "هاذا اللي يقولو الكور متاعك ({loc}): {text}",
    },
    "alternate": {
        "fr": "Essayons autrement, étape par étape :\n{steps}",
        "en": "Let's try another way, step by step:\n{steps}",
        "ar": "لنجرّب طريقة أخرى، خطوة بخطوة:\n{steps}",
        "derja": "يزّي نجرّبو بطريقة أخرى، خطوة بخطوة:\n{steps}",
    },
    "explain_mistake": {
        "fr": "Tu as choisi « {chosen} ». {note} La bonne réponse est « {correct} » : {explanation}",
        "en": "You chose “{chosen}”. {note} The right answer is “{correct}”: {explanation}",
        "ar": "اخترت «{chosen}». {note} الإجابة الصحيحة هي «{correct}»: {explanation}",
        "derja": "إنتِ اخترت «{chosen}». {note} الجواب الصحيح هو «{correct}»: {explanation}",
    },
    "unsupported": {
        "fr": "Je ne trouve pas assez d'informations dans ton cours pour répondre à ça. Tu peux reformuler ou ouvrir la section la plus proche.",
        "en": "I can't find enough information in your course to answer that. Try rephrasing or open the closest section.",
        "ar": "لا أجد معلومات كافية في درسك للإجابة عن ذلك. حاول إعادة الصياغة أو افتح أقرب قسم.",
        "derja": "ما لقيتش معلومات كافية في الكور متاعك باش نجاوبك. عاود صيغ السؤال ولا حل أقرب جزء.",
    },
    "demo_note": {
        "fr": "(Mode démo : réponse construite à partir de ton cours par des règles, sans IA.)",
        "en": "(Demo mode: answer assembled from your course by rules, no AI.)",
        "ar": "(وضع العرض: إجابة مركّبة من درسك بقواعد، دون ذكاء اصطناعي.)",
        "derja": "(وضع ديمو: الجواب مركّب من الكور متاعك بقواعد، بلاش ذكاء اصطناعي.)",
    },
}


def t(key: str, lang: str, **kw) -> str:
    table = TUTOR_TEXT[key]
    return table.get(lang, table["fr"]).format(**kw)


def _strip_headings(text: str) -> str:
    return "\n".join(l for l in text.split("\n") if not l.lstrip().startswith("#"))


def quote(text: str, n: int = 160) -> str:
    text = _strip_headings(text)
    sents = _sentences(text) or [text]
    s = sents[0]
    return s if len(s) <= n else s[: n - 1] + "…"


def steps_from(text: str) -> str:
    text = _strip_headings(text)
    return "\n".join(f"{i}. {s}" for i, s in enumerate((_sentences(text) or [text])[:4], start=1))
