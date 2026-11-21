"""Gemini adapter: request layout + parsing, with the google-genai client replaced by a fake."""
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.agents import roles
from app.agents.schemas import QuizSet, TutorReply
from app.db import SessionLocal
from app.llm import provider as provider_mod
from app.llm.provider import LLMRefusal
from app.models import Course


class FakeModels:
    def __init__(self, text, finish="STOP"):
        self.calls, self.text, self.finish = [], text, finish

    def generate_content(self, model, contents, config):
        self.calls.append({"model": model, "contents": contents, "config": config})
        usage = SimpleNamespace(prompt_token_count=4000, cached_content_token_count=3000 if len(self.calls) > 1 else 0,
                                candidates_token_count=100, thoughts_token_count=20)
        return SimpleNamespace(text=self.text, prompt_feedback=None, usage_metadata=usage,
                               candidates=[SimpleNamespace(finish_reason=self.finish)])


def _gemini(text, finish="STOP"):
    from google.genai import errors, types

    p = provider_mod.GeminiProvider.__new__(provider_mod.GeminiProvider)
    p._types, p._errors, p.model, p.models, p.fast = types, errors, "gemini-test", ["gemini-test"], False
    fake = FakeModels(text, finish)
    p.client = SimpleNamespace(models=fake)
    return p, fake


@pytest.fixture
def use(seeded):
    saved = provider_mod._provider
    yield lambda p: setattr(provider_mod, "_provider", p)
    provider_mod._provider = saved


def test_gemini_generation_layout(use):
    p, fake = _gemini(QuizSet(quizzes=[]).model_dump_json())
    use(p)
    with SessionLocal() as db:
        course = db.scalar(select(Course).where(Course.is_demo.is_(True)))
        r1 = roles.generate("quinn", db, course, "derja", "arabic", outline="o1")
        roles.generate("quinn", db, course, "fr", "arabic", outline="o1")  # second role call, different language
    a, b = fake.calls
    assert r1.demo is False and r1.payload == {"quizzes": []}
    assert a["config"].system_instruction == b["config"].system_instruction  # shared prefix -> implicit caching
    assert "<course_source" in a["config"].system_instruction
    assert a["config"].response_mime_type == "application/json" and "quizzes" in str(a["config"].response_json_schema)
    assert "Target language: Tunisian" in a["contents"][0].parts[0].text
    assert b["contents"][0].role == "user"


def test_gemini_tutor_roles_and_citation_filter(use):
    p, fake = _gemini(TutorReply(message="ok", citations=["S1", "S999"], supported_by_course=True, method="analogy", follow_up_question="").model_dump_json())
    use(p)
    with SessionLocal() as db:
        course = db.scalar(select(Course).where(Course.is_demo.is_(True)))
        hist = [{"role": "user", "content": "q"}, {"role": "assistant", "content": "{}"}]
        data, _, demo = roles.tutor(db, course, [course.id], course.outline_digest, "fr", "arabic", "answer", "masque ?", hist)
    roles_sent = [c.role for c in fake.calls[0]["contents"]]
    assert roles_sent == ["user", "model", "user"] and demo is False and "S999" not in data["citations"]


def test_gemini_safety_block_is_refusal(use):
    p, _ = _gemini("", finish="SAFETY")
    use(p)
    with pytest.raises(LLMRefusal):
        p.structured("sam", [provider_mod.SystemBlock("x")], [{"role": "user", "content": "hi"}], TutorReply, app_cache=False)


def test_auto_provider_selection(monkeypatch):
    from app.config import Settings

    assert Settings(anthropic_api_key=None, gemini_api_key="g", llm_provider="auto").active_provider == "gemini"
    assert Settings(anthropic_api_key="a", gemini_api_key="g", llm_provider="auto").active_provider == "anthropic"
    assert Settings(anthropic_api_key="a", gemini_api_key="g", llm_provider="gemini").active_provider == "gemini"
    assert Settings(anthropic_api_key=None, gemini_api_key=None, llm_provider="auto").active_provider == "demo"


def test_tiers_resolution():
    from app.config import Settings

    g = Settings(anthropic_api_key=None, gemini_api_key="g", llm_provider="auto", gemini_model="m-smart", gemini_fast_model="m-fast")
    assert g.tier("smart") == ("gemini", "m-smart") and g.tier("fast") == ("gemini", "m-fast")
    mixed = Settings(gemini_api_key="g", anthropic_api_key="a", llm_fast="anthropic:claude-haiku-5-5", llm_smart="gemini:gemini-3.5-flash")
    assert mixed.tier("fast") == ("anthropic", "claude-haiku-5-5") and mixed.tier("smart") == ("gemini", "gemini-3.5-flash")
    assert not mixed.demo_mode
