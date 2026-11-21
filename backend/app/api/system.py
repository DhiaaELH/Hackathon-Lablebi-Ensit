from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import LLMCall
from ..retrieval.embeddings import get_embedder
from ..security import current_user

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
