"""Builds the byte-stable context blocks used as cached prompt prefixes."""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Chapter, Concept, ConceptPrerequisite, Course, Section, SourceChunk
from ..retrieval.chunking import estimate_tokens


class CorpusTooLarge(ValueError):
    pass


def corpus_block(db: Session, course: Course, max_tokens: int) -> str:
    """Whole course source as delimited passages, ordered deterministically (same bytes every call)."""
    chunks = db.scalars(select(SourceChunk).where(SourceChunk.course_id == course.id).order_by(SourceChunk.ordinal)).all()
    parts = [f'<course_source title="{course.title}">']
    for c in chunks:
        loc = f"page {c.page}" if c.page else "pasted text"
        parts.append(f'<passage ref="{c.ref}" location="{loc}" section="{c.section_hint or ""}">\n{c.text}\n</passage>')
    parts.append("</course_source>")
    text = "\n".join(parts)
    if estimate_tokens(text) > max_tokens:
        raise CorpusTooLarge(
            "This course material is too large to analyse in one pass. Split it into smaller courses (for example one per chapter)."
        )
    return text


def known_refs(db: Session, course_id: uuid.UUID) -> set[str]:
    return set(db.scalars(select(SourceChunk.ref).where(SourceChunk.course_id == course_id)))


def resolve_citations(db: Session, course_id: uuid.UUID, cites: list[str]) -> list[str]:
    """Keep valid refs; map section headings (used by fixtures) to the refs of chunks under them."""
    refs = known_refs(db, course_id)
    out: list[str] = []
    for c in cites or []:
        if c in refs:
            out.append(c)
            continue
        matched = db.scalars(
            select(SourceChunk.ref).where(SourceChunk.course_id == course_id, SourceChunk.section_hint == c).order_by(SourceChunk.ordinal)
        ).all()
        out.extend(matched[:2])
    return list(dict.fromkeys(out))


def build_outline(db: Session, course: Course) -> str:
    """Compact, deterministic outline (chapters > sections > concepts). Stored on the course so that the
    tutor's cached prefix stays identical between turns."""
    lines = [f"Course: {course.title}"]
    chapters = db.scalars(select(Chapter).where(Chapter.course_id == course.id).order_by(Chapter.ordinal)).all()
    concepts = db.scalars(select(Concept).where(Concept.course_id == course.id).order_by(Concept.key)).all()
    by_section: dict = {}
    for c in concepts:
        by_section.setdefault(c.section_id, []).append(c)
    prereqs = db.execute(select(ConceptPrerequisite.concept_id, ConceptPrerequisite.prerequisite_id)).all()
    key_of = {c.id: c.key for c in concepts}
    pre_map: dict = {}
    for cid, pid in prereqs:
        if cid in key_of and pid in key_of:
            pre_map.setdefault(cid, []).append(key_of[pid])
    for ch in chapters:
        lines.append(f"\n## {ch.title}")
        secs = db.scalars(select(Section).where(Section.chapter_id == ch.id).order_by(Section.ordinal)).all()
        for s in secs:
            lines.append(f"- Section: {s.title} [refs: {', '.join(s.citations)}]")
            for o in s.objectives:
                lines.append(f"  - objective: {o}")
            for c in by_section.get(s.id, []):
                pre = ", ".join(sorted(pre_map.get(c.id, []))) or "none"
                lines.append(f"  - concept `{c.key}`: {c.name} (prerequisites: {pre})")
    return "\n".join(lines)
