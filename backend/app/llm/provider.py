"""LLM provider adapter with three caching layers.

1. **Anthropic prompt caching (server-side prefix cache).** Requests are laid out stable-first:
       system[0]  shared LessonForge policy            (identical for every role)
       system[1]  course corpus OR role+course outline  <- cache_control breakpoint
       messages   role task / chat history / retrieved passages (volatile, after the breakpoint)
   All generation agents (Clara, Quinn, Alex, Sage, Max, Riley) share the same
   `policy + course corpus` prefix, so after Clara writes it, the others read it at ~5% of the
   input price. Multi-turn tutor chats additionally use top-level automatic caching so the growing
   conversation history is cached turn over turn.
2. **Application response cache.** Validated structured outputs are stored in Postgres keyed by a
   SHA-256 of (model, role, system, messages, schema); re-running an identical generation (e.g. retrying a
   workflow on unchanged material) costs nothing.
3. **Client query cache** lives in the React app (TanStack Query) - see frontend/src/api.

Every call is logged to `llm_calls` with cache read/write token counts (`GET /api/system/llm-stats`).
"""
import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from typing import TypeVar

from pydantic import BaseModel

from ..config import get_settings
from ..db import SessionLocal, get_engine
from ..models import LLMCall, LLMResponseCache

log = logging.getLogger("lessonforge.llm")
T = TypeVar("T", bound=BaseModel)

FALLBACK_BETA = "server-side-fallback-2026-07-01"


class LLMError(RuntimeError):
    transient = False


class TransientLLMError(LLMError):
    transient = True


class LLMRefusal(LLMError):
    pass


@dataclass
class SystemBlock:
    text: str
    cache: bool = False  # put a cache_control breakpoint at the end of this block
    ttl: str | None = None  # None -> default 5 min; "1h" for long-lived prefixes


@dataclass
class CallMeta:
    provider: str
    model: str
    usage: dict = field(default_factory=dict)
    app_cache_hit: bool = False


def _cache_key(model: str, role: str, system: list[SystemBlock], messages: list, schema_name: str) -> str:
    blob = json.dumps(
        {"m": model, "r": role, "s": [b.text for b in system], "msg": messages, "schema": schema_name},
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(blob.encode()).hexdigest()


def _log_call(role: str, meta: CallMeta, latency_ms: int) -> None:
    try:
        get_engine()
        with SessionLocal() as db:
            u = meta.usage
            db.add(
                LLMCall(
                    agent_role=role,
                    provider=meta.provider,
                    model=meta.model,
                    input_tokens=u.get("input_tokens", 0) or 0,
                    output_tokens=u.get("output_tokens", 0) or 0,
                    cache_read_tokens=u.get("cache_read_input_tokens", 0) or 0,
                    cache_write_tokens=u.get("cache_creation_input_tokens", 0) or 0,
                    app_cache_hit=meta.app_cache_hit,
                    latency_ms=latency_ms,
                )
            )
            db.commit()
    except Exception:  # observability must never break a learning flow
        log.exception("could not log llm call")


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, model: str | None = None) -> None:
        import anthropic

        s = get_settings()
        if not s.anthropic_api_key:
            raise LLMError("ANTHROPIC_API_KEY is not set but a tier uses the anthropic provider")
        self._anthropic = anthropic
        self.client = anthropic.Anthropic(api_key=s.anthropic_api_key, timeout=s.llm_timeout_s, max_retries=2)
        self.model = model or s.llm_model
        self.effort = s.llm_effort

    @staticmethod
    def _system(blocks: list[SystemBlock]) -> list[dict]:
        out = []
        for b in blocks:
            block: dict = {"type": "text", "text": b.text}
            if b.cache:
                block["cache_control"] = {"type": "ephemeral", **({"ttl": b.ttl} if b.ttl else {})}
            out.append(block)
        return out

    def _common(self, system: list[SystemBlock], messages: list, effort: str | None, auto_cache: bool) -> dict:
        kw: dict = dict(
            model=self.model,
            max_tokens=16000,
            system=self._system(system),
            messages=messages,
            output_config={"effort": effort or self.effort},
            # Server-side refusal fallback: on a policy decline the API re-runs on a fallback model.
            betas=[FALLBACK_BETA],
            fallbacks="default",
        )
        if auto_cache:
            kw["cache_control"] = {"type": "ephemeral"}  # caches the growing conversation prefix
        return kw

    def _wrap_errors(self, fn):
        a = self._anthropic
        try:
            return fn()
        except a.RateLimitError as e:
            raise TransientLLMError("The AI service is busy (rate limited).") from e
        except a.APIConnectionError as e:  # includes timeouts
            raise TransientLLMError("Could not reach the AI service.") from e
        except a.BadRequestError as e:
            raise LLMError(f"AI request rejected: {e.message}") from e
        except a.APIStatusError as e:
            if e.status_code >= 500:
                raise TransientLLMError("The AI service had a temporary error.") from e
            raise LLMError(f"AI service error {e.status_code}") from e

    @staticmethod
    def _check_stop(resp) -> None:
        if resp.stop_reason == "refusal":
            raise LLMRefusal("The AI declined this request.")
        if resp.stop_reason == "max_tokens":
            raise LLMError("The AI response was cut off (too long).")

    @staticmethod
    def _usage(resp) -> dict:
        u = resp.usage
        return {
            "input_tokens": u.input_tokens,
            "output_tokens": u.output_tokens,
            "cache_read_input_tokens": getattr(u, "cache_read_input_tokens", 0) or 0,
            "cache_creation_input_tokens": getattr(u, "cache_creation_input_tokens", 0) or 0,
        }

    def structured(self, role: str, system: list[SystemBlock], messages: list, schema: type[T],
                   effort: str | None = None, app_cache: bool = True, auto_cache: bool = False) -> tuple[T, CallMeta]:
        key = _cache_key(self.model, role, system, messages, schema.__name__)
        if app_cache:
            with SessionLocal() as db:
                hit = db.get(LLMResponseCache, key)
                if hit:
                    meta = CallMeta(self.name, self.model, app_cache_hit=True)
                    _log_call(role, meta, 0)
                    return schema.model_validate(hit.payload), meta
        t0 = time.monotonic()
        resp = self._wrap_errors(
            lambda: self.client.beta.messages.parse(**self._common(system, messages, effort, auto_cache), output_format=schema)
        )
        self._check_stop(resp)
        parsed = resp.parsed_output
        if parsed is None:
            raise LLMError("The AI returned an output that did not match the schema.")
        meta = CallMeta(self.name, resp.model, self._usage(resp))
        _log_call(role, meta, int((time.monotonic() - t0) * 1000))
        if app_cache:
            with SessionLocal() as db:
                db.merge(LLMResponseCache(key=key, agent_role=role, payload=parsed.model_dump(mode="json")))
                db.commit()
        return parsed, meta


class DemoProvider:
    """No model is called. Agents use deterministic heuristics/fixtures and label output as demo."""

    name = "demo"
    model = "demo-fixtures"


_provider = None


class GeminiProvider:
    """Google Gemini via the official `google-genai` SDK. Same interface as AnthropicProvider.

    Caching on Gemini: the stable `policy + course corpus` prefix is sent as `system_instruction`, which is the
    start of the prompt, so Gemini's *implicit* context caching (automatic on 2.5+ models) can reuse it across
    the agents; cached tokens are reported in `usage_metadata.cached_content_token_count` and logged as cache reads.
    The application response cache works exactly as for Claude.
    """

    name = "gemini"

    def __init__(self, model: str | None = None, fast: bool = False) -> None:
        from google import genai
        from google.genai import errors, types

        s = get_settings()
        if not s.gemini_api_key:
            raise LLMError("GEMINI_API_KEY is not set but a tier uses the gemini provider")
        self._types, self._errors = types, errors
        timeout_s = 60 if fast else s.llm_timeout_s
        self.client = genai.Client(api_key=s.gemini_api_key, http_options=types.HttpOptions(timeout=int(timeout_s * 1000)))
        self.model = model or s.gemini_model
        self.fast = fast
        # Tried in order when a model is overloaded (429/5xx) or unavailable to this key (404).
        pool = [m.strip() for m in (s.gemini_fallback_models + "," + s.gemini_model + "," + s.gemini_fast_model).split(",") if m.strip()]
        self.models = list(dict.fromkeys([self.model] + pool))[:3]

    def _generate(self, contents, config):
        last: Exception | None = None
        for model in self.models:
            try:
                return model, self._call(lambda: self.client.models.generate_content(model=model, contents=contents, config=config))
            except TransientLLMError as exc:
                last = exc
            except LLMError as exc:
                if "(404)" not in str(exc):
                    raise
                last = exc
            log.warning("gemini model %s failed (%s); trying next", model, last)
        raise last or LLMError("No Gemini model available")

    def _contents(self, messages: list) -> list:
        t = self._types
        return [t.Content(role="model" if m["role"] == "assistant" else "user", parts=[t.Part(text=m["content"])]) for m in messages]

    def _call(self, fn):
        e = self._errors
        try:
            return fn()
        except e.ClientError as exc:
            if exc.code == 429:
                raise TransientLLMError("The AI service is busy (rate limited).") from exc
            raise LLMError(f"AI request rejected ({exc.code}): {exc.message}") from exc
        except e.ServerError as exc:
            raise TransientLLMError("The AI service had a temporary error.") from exc
        except e.APIError as exc:
            raise LLMError(f"AI service error {exc.code}") from exc
        except Exception as exc:  # network errors / timeouts raised by the HTTP layer
            if exc.__class__.__name__ in ("ConnectError", "ReadTimeout", "TimeoutException", "ConnectTimeout"):
                raise TransientLLMError("Could not reach the AI service.") from exc
            raise

    def structured(self, role: str, system: list[SystemBlock], messages: list, schema: type[T],
                   effort: str | None = None, app_cache: bool = True, auto_cache: bool = False) -> tuple[T, CallMeta]:
        key = _cache_key(self.model, role, system, messages, schema.__name__)
        if app_cache:
            hit = _app_cache_get(key, schema)
            if hit is not None:
                meta = CallMeta(self.name, self.model, app_cache_hit=True)
                _log_call(role, meta, 0)
                return hit, meta
        t = self._types
        level = "LOW" if self.fast else {"low": "LOW", "medium": "MEDIUM", "high": "HIGH"}.get(effort or "")
        config = t.GenerateContentConfig(
            system_instruction="\n\n".join(b.text for b in system),
            response_mime_type="application/json",
            response_json_schema=schema.model_json_schema(),
            max_output_tokens=16000,
            thinking_config=t.ThinkingConfig(thinking_level=level) if level else None,
        )
        t0 = time.monotonic()
        used_model, resp = self._generate(self._contents(messages), config)
        if resp.prompt_feedback is not None and resp.prompt_feedback.block_reason:
            raise LLMRefusal("The AI declined this request.")
        cand = resp.candidates[0] if resp.candidates else None
        reason = str(getattr(cand, "finish_reason", "") or "")
        if "SAFETY" in reason or "PROHIBITED" in reason or "BLOCKLIST" in reason:
            raise LLMRefusal("The AI declined this request.")
        if "MAX_TOKENS" in reason:
            raise LLMError("The AI response was cut off (too long).")
        if not resp.text:
            raise LLMError("The AI returned an empty response.")
        parsed = schema.model_validate_json(resp.text)  # pydantic ValidationError -> bounded retry in Jordan
        u = resp.usage_metadata
        cached = (u.cached_content_token_count or 0) if u else 0
        usage = {"input_tokens": max(0, ((u.prompt_token_count or 0) if u else 0) - cached),
                 "output_tokens": ((u.candidates_token_count or 0) + (u.thoughts_token_count or 0)) if u else 0,
                 "cache_read_input_tokens": cached, "cache_creation_input_tokens": 0}
        meta = CallMeta(self.name, used_model, usage)
        _log_call(role, meta, int((time.monotonic() - t0) * 1000))
        if app_cache:
            _app_cache_put(key, role, parsed)
        return parsed, meta


def _app_cache_get(key: str, schema: type[T]) -> T | None:
    get_engine()
    with SessionLocal() as db:
        hit = db.get(LLMResponseCache, key)
        return schema.model_validate(hit.payload) if hit else None


def _app_cache_put(key: str, role: str, parsed: BaseModel) -> None:
    with SessionLocal() as db:
        db.merge(LLMResponseCache(key=key, agent_role=role, payload=parsed.model_dump(mode="json")))
        db.commit()


_by_tier: dict[str, object] = {}


def get_provider(tier: str = "smart"):
    """'smart' = background generation roles, 'fast' = interactive tutor. Each tier may use its own
    provider/model (LLM_FAST / LLM_SMART), e.g. a quick model for chat and a stronger one for generation.
    `_provider`, when set (tests, seeding), overrides every tier."""
    if _provider is not None:
        return _provider
    if tier not in _by_tier:
        prov, model = get_settings().tier(tier)
        if prov == "anthropic":
            _by_tier[tier] = AnthropicProvider(model)
        elif prov == "gemini":
            _by_tier[tier] = GeminiProvider(model, fast=tier == "fast")
        else:
            _by_tier[tier] = DemoProvider()
    return _by_tier[tier]


def reset_provider() -> None:
    global _provider
    _provider = None
    _by_tier.clear()
