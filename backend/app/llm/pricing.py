"""API cost estimate: logged token counts (llm_calls) x a per-model price list.

Prices are USD per 1M tokens: input (uncached), output (incl. thinking), cache read, cache write.
Defaults are the public list prices as of 2026-11; override any model with LLM_PRICES in .env, e.g.
LLM_PRICES='{"gemini-3.5-flash": {"input": 1.5, "output": 9, "cache_read": 0.15}}'.
Not counted: embeddings, Gemini context-cache storage per hour, search grounding fees.
"""
import json
import logging

log = logging.getLogger(__name__)

PRICES_AS_OF = "2026-11"

DEFAULT_PRICES: dict[str, dict[str, float]] = {
    # Google Gemini (paid tier)
    "gemini-3.5-flash-lite": {"input": 0.30, "output": 2.50, "cache_read": 0.03, "cache_write": 0.0},
    "gemini-3.5-flash": {"input": 1.50, "output": 9.00, "cache_read": 0.15, "cache_write": 0.0},
    # Anthropic Claude (cache write = 5-minute TTL, 1.25x input)
    "claude-opus-5-5": {"input": 4.00, "output": 20.00, "cache_read": 0.20, "cache_write": 5.00},
    "claude-opus-5": {"input": 5.00, "output": 25.00, "cache_read": 0.50, "cache_write": 6.25},
    "claude-sonnet-5-5": {"input": 2.00, "output": 10.00, "cache_read": 0.10, "cache_write": 2.50},
    "claude-sonnet-5": {"input": 2.00, "output": 10.00, "cache_read": 0.20, "cache_write": 2.50},
    "claude-haiku-5-5": {"input": 0.10, "output": 0.50, "cache_read": 0.01, "cache_write": 0.125},
}


def price_table(override_json: str | None) -> dict[str, dict[str, float]]:
    table = {k: dict(v) for k, v in DEFAULT_PRICES.items()}
    if override_json:
        try:
            for model, p in json.loads(override_json).items():
                table.setdefault(model, {"input": 0.0, "output": 0.0, "cache_read": 0.0, "cache_write": 0.0}).update(
                    {k: float(v) for k, v in p.items() if k in ("input", "output", "cache_read", "cache_write")})
        except (ValueError, AttributeError, TypeError):
            log.warning("LLM_PRICES is not valid JSON; using default prices")
    return table


def price_for(model: str, table: dict[str, dict[str, float]]) -> dict[str, float] | None:
    """Exact model id first, then the longest known id the logged name starts with (e.g. dated variants)."""
    m = (model or "").removeprefix("models/")
    if m in table:
        return table[m]
    hits = [k for k in table if m.startswith(k)]
    return table[max(hits, key=len)] if hits else None


def cost_usd(p: dict[str, float] | None, inp: int, out: int, read: int, write: int) -> float | None:
    if p is None:
        return None
    return (inp * p.get("input", 0) + out * p.get("output", 0) + read * p.get("cache_read", 0)
            + write * p.get("cache_write", 0)) / 1_000_000
