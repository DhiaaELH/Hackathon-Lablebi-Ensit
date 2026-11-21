"""Access-scoped hybrid retrieval: Postgres full-text (ts_rank_cd) + pgvector cosine, fused with
Reciprocal Rank Fusion. Callers MUST pass course ids the user is authorised to read; this module never
widens scope."""
import re
import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from .embeddings import get_embedder

RRF_K = 60


@dataclass
class Hit:
    id: uuid.UUID
    ref: str
    page: int | None
    section_hint: str | None
    text: str
    score: float


def _or_tsquery(q: str) -> str | None:
    words = [w for w in re.findall(r"\w+", q.lower()) if len(w) > 2][:24]
    return " | ".join(dict.fromkeys(words)) or None


def hybrid_search(db: Session, course_ids: list[uuid.UUID], query: str, k: int = 6) -> list[Hit]:
    if not course_ids or not query.strip():
        return []
    emb = get_embedder().embed([query])[0]
    tsq = _or_tsquery(query)
    sql = text(
        """
        WITH vec AS (
            SELECT id, row_number() OVER (ORDER BY embedding <=> CAST(:emb AS vector)) AS r
            FROM source_chunks WHERE course_id = ANY(:cids)
            ORDER BY embedding <=> CAST(:emb AS vector) LIMIT 24
        ),
        fts AS (
            SELECT id, row_number() OVER (ORDER BY ts_rank_cd(tsv, to_tsquery('simple', CAST(:tsq AS text))) DESC) AS r
            FROM source_chunks
            WHERE course_id = ANY(:cids) AND tsv @@ to_tsquery('simple', CAST(:tsq AS text))
            LIMIT 24
        ),
        fused AS (
            SELECT id, sum(1.0 / (:rrf + r)) AS score FROM (SELECT * FROM vec UNION ALL SELECT * FROM fts) u GROUP BY id
        )
        SELECT c.id, c.ref, c.page, c.section_hint, c.text, f.score
        FROM fused f JOIN source_chunks c ON c.id = f.id
        ORDER BY f.score DESC LIMIT :k
        """
    )
    rows = db.execute(sql, {"emb": str(emb), "cids": list(course_ids), "tsq": tsq, "rrf": RRF_K, "k": k}).all()
    return [Hit(*r) for r in rows]


def format_passages(hits: list[Hit]) -> str:
    """Render retrieved chunks as delimited, citable *data* (never instructions)."""
    parts = []
    for h in hits:
        loc = f"page {h.page}" if h.page else "pasted text"
        parts.append(f'<passage ref="{h.ref}" location="{loc}" section="{h.section_hint or ""}">\n{h.text}\n</passage>')
    return "\n".join(parts)
