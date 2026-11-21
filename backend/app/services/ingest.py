"""Turn extracted pages into stored, embedded, access-scoped chunks."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Course, Resource, SourceChunk
from ..retrieval.chunking import Page, chunk_pages
from ..retrieval.embeddings import get_embedder


def add_chunks(db: Session, course: Course, resource: Resource, pages: list[Page]) -> int:
    drafts = chunk_pages(pages)
    if not drafts:
        return 0
    start = db.scalar(select(func.coalesce(func.max(SourceChunk.ordinal), -1)).where(SourceChunk.course_id == course.id)) + 1
    vectors = get_embedder().embed([f"{d.section_hint or ''}\n{d.text}" for d in drafts])
    for i, (d, v) in enumerate(zip(drafts, vectors)):
        n = start + i
        db.add(SourceChunk(course_id=course.id, resource_id=resource.id, ordinal=n, ref=f"S{n + 1}", page=d.page,
                           section_hint=(d.section_hint or None) and d.section_hint[:300], text=d.text, embedding=v))
    db.flush()
    return len(drafts)
