"""Verifies the Claude request layout without network access (the SDK client is replaced by a fake)."""
from types import SimpleNamespace

from sqlalchemy import select

from app.agents import roles
from app.agents.schemas import CourseStructure, QuizSet, TutorReply
from app.db import SessionLocal
from app.llm import provider as provider_mod
from app.models import Course


class FakeMessages:
    def __init__(self):
        self.calls = []

    def parse(self, **kw):
        self.calls.append(kw)
        schema = kw["output_format"]
        if schema is CourseStructure:
            parsed = CourseStructure(chapters=[], concepts=[], missing_or_ambiguous=[], confidence=0.5)
        elif schema is QuizSet:
            parsed = QuizSet(quizzes=[])
        else:
            parsed = TutorReply(message="ok", citations=["S1", "S999"], supported_by_course=True, method="analogy", follow_up_question="")
        n = len(self.calls)
        usage = SimpleNamespace(input_tokens=50, output_tokens=20, cache_read_input_tokens=0 if n == 1 else 3000, cache_creation_input_tokens=3000 if n == 1 else 0)
        return SimpleNamespace(parsed_output=parsed, stop_reason="end_turn", usage=usage, model=kw["model"])


def _fake_provider():
    p = provider_mod.AnthropicProvider.__new__(provider_mod.AnthropicProvider)
    import anthropic

    p._anthropic, p.model, p.effort = anthropic, "claude-opus-5-5", "medium"
    fake = FakeMessages()
    p.client = SimpleNamespace(beta=SimpleNamespace(messages=fake))
    return p, fake


def test_generation_roles_share_cached_corpus_prefix(seeded):
    p, fake = _fake_provider()
    saved = provider_mod._provider
    provider_mod._provider = p
    try:
        with SessionLocal() as db:
            course = db.scalar(select(Course).where(Course.is_demo.is_(True)))
            roles.generate("clara", db, course, "fr", "arabic")
            roles.generate("quinn", db, course, "derja", "arabic", outline="outline")
            roles.generate("clara", db, course, "fr", "arabic")  # identical request -> app cache, no API call
    finally:
        provider_mod._provider = saved
    assert len(fake.calls) == 2
    a, b = fake.calls
    assert a["system"] == b["system"], "policy + corpus prefix must be byte-identical across roles"
    assert a["system"][1]["cache_control"] == {"type": "ephemeral"} and "cache_control" not in a["system"][0]
    assert "<course_source" in a["system"][1]["text"]
    assert "Target language: Tunisian" in b["messages"][0]["content"] and "Target language" not in str(b["system"])  # language lives after the breakpoint
    assert a["fallbacks"] == "default" and provider_mod.FALLBACK_BETA in a["betas"]
    assert a["output_config"]["effort"] == "high" and b["output_config"]["effort"] == "medium"
    assert "temperature" not in a and "thinking" not in a


def test_tutor_uses_auto_cache_and_drops_unretrieved_citations(seeded):
    p, fake = _fake_provider()
    saved = provider_mod._provider
    provider_mod._provider = p
    try:
        with SessionLocal() as db:
            course = db.scalar(select(Course).where(Course.is_demo.is_(True)))
            hist = [{"role": "user", "content": "earlier"}, {"role": "assistant", "content": "{}"}]
            data, rendered, demo = roles.tutor(db, course, [course.id], course.outline_digest, "fr", "arabic", "hint", "masque /24 ?", hist, 2)
    finally:
        provider_mod._provider = saved
    kw = fake.calls[0]
    assert kw["cache_control"] == {"type": "ephemeral"}  # automatic caching of the growing conversation
    assert kw["system"][1]["cache_control"] == {"type": "ephemeral"} and "<course_outline>" in kw["system"][1]["text"]
    assert kw["messages"][:2] == hist and "<passages>" in kw["messages"][-1]["content"]
    assert "S999" not in data["citations"]  # never surface a citation that was not retrieved
    assert demo is False
