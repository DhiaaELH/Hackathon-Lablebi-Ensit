from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..llm.pricing import PRICES_AS_OF, cost_usd, price_for, price_table
from ..models import LLMCall
from ..retrieval.embeddings import get_embedder
from ..security import current_user, require_roles

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/health")
def health():
    s = get_settings()
    fast, smart = s.tier("fast"), s.tier("smart")
    return {"ok": True, "demo_mode": s.demo_mode, "provider": smart[0], "model": smart[1],
            "tiers": {"fast": f"{fast[0]}:{fast[1]}", "smart": f"{smart[0]}:{smart[1]}"}, "embeddings": get_embedder().name,
            "resource_finder": bool(s.search_api_key), "min_cohort": max(5, s.insight_min_cohort)}


@router.get("/llm-stats")
def llm_stats(user=Depends(current_user), db: Session = Depends(get_db)):
    """Prompt-cache effectiveness across all calls (aggregate only; contains no user data)."""
    rows = db.execute(select(LLMCall.agent_role, func.count(), func.sum(LLMCall.input_tokens), func.sum(LLMCall.cache_read_tokens),
                             func.sum(LLMCall.cache_write_tokens), func.sum(LLMCall.output_tokens),
                             func.count().filter(LLMCall.app_cache_hit.is_(True))).group_by(LLMCall.agent_role)).all()
    out, tot_in, tot_read = [], 0, 0
    for role, n, inp, read, write, outp, hits in rows:
        inp, read, write = inp or 0, read or 0, write or 0
        total_input = inp + read + write
        tot_in += total_input
        tot_read += read
        out.append({"agent_role": role, "calls": n, "input_tokens": inp, "cache_read_tokens": read, "cache_write_tokens": write,
                    "output_tokens": outp or 0, "app_cache_hits": int(hits or 0),
                    "cache_hit_ratio": round(read / total_input, 3) if total_input else None})
    return {"by_role": out, "overall_cache_hit_ratio": round(tot_read / tot_in, 3) if tot_in else None}


@router.get("/llm-cost")
def llm_cost(user=Depends(require_roles("admin")), db: Session = Depends(get_db)):
    """Estimated API spend: logged tokens x list prices. Admin only (platform-wide bill)."""
    table = price_table(get_settings().llm_prices)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    day = func.date_trunc("day", LLMCall.created_at)
    rows = db.execute(select(LLMCall.provider, LLMCall.model, day, func.count(), func.sum(LLMCall.input_tokens),
                             func.sum(LLMCall.output_tokens), func.sum(LLMCall.cache_read_tokens),
                             func.sum(LLMCall.cache_write_tokens)).group_by(LLMCall.provider, LLMCall.model, day)).all()
    models: dict[str, dict] = {}
    daily: dict[str, float] = {}
    totals = {"all": 0.0, "month": 0.0, "last_30d": 0.0, "today": 0.0}
    unpriced: set[str] = set()
    for provider, model, d, n, inp, out, read, write in rows:
        inp, out, read, write = inp or 0, out or 0, read or 0, write or 0
        p = price_for(model, table)
        c = cost_usd(p, inp, out, read, write)
        m = models.setdefault(model, {"provider": provider, "model": model, "calls": 0, "input_tokens": 0, "output_tokens": 0,
                                      "cache_read_tokens": 0, "cache_write_tokens": 0, "cost_usd": 0.0 if p else None, "price": p})
        m["calls"] += n
        m["input_tokens"] += inp
        m["output_tokens"] += out
        m["cache_read_tokens"] += read
        m["cache_write_tokens"] += write
        if c is None:
            unpriced.add(model)
            continue
        m["cost_usd"] += c
        d = d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        totals["all"] += c
        if d >= month_start:
            totals["month"] += c
        if d >= now - timedelta(days=30):
            totals["last_30d"] += c
            daily[d.date().isoformat()] = daily.get(d.date().isoformat(), 0.0) + c
        if d.date() == now.date():
            totals["today"] += c
    by_model = sorted(models.values(), key=lambda m: -(m["cost_usd"] or 0))
    for m in by_model:
        m["cost_usd"] = round(m["cost_usd"], 4) if m["cost_usd"] is not None else None
    since = db.scalar(select(func.min(LLMCall.created_at)))
    return {"currency": "USD", "prices_as_of": PRICES_AS_OF, "since": since.isoformat() if since else None,
            "totals": {k: round(v, 4) for k, v in totals.items()},
            "calls": sum(m["calls"] for m in by_model), "by_model": by_model,
            "daily": [{"day": k, "cost_usd": round(v, 4)} for k, v in sorted(daily.items())],
            "unpriced_models": sorted(unpriced)}
