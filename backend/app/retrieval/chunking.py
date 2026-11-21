"""Split extracted pages into retrieval chunks while preserving page/slide provenance."""
import re
from dataclasses import dataclass

HEADING_RE = re.compile(r"^\s*(?:#{1,4}\s+|(?:chapitre|chapter|section|partie|part)\s+[\dIVX]+|[\dIVX]+(?:\.\d+)*[.)]?\s+[A-ZÀ-Ý؀-ۿ])", re.I)


@dataclass
class Page:
    number: int | None  # 1-based page/slide; None for pasted text
    text: str


@dataclass
class ChunkDraft:
    page: int | None
    section_hint: str | None
    text: str


def normalize(text: str) -> str:
    text = text.replace("\x00", "").replace("\r", "")
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def chunk_pages(pages: list[Page], target_chars: int = 900, overlap_chars: int = 120) -> list[ChunkDraft]:
    chunks: list[ChunkDraft] = []
    heading: str | None = None
    for page in pages:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\n(?=\s*(?:#|\d+[.)]\s))", normalize(page.text)) if p.strip()]
        buf = ""
        for para in paragraphs:
            first_line = para.split("\n", 1)[0]
            if HEADING_RE.match(first_line) and len(first_line) < 160:
                if buf:
                    chunks.append(ChunkDraft(page.number, heading, buf.strip()))
                    buf = ""
                heading = first_line.lstrip("# ").strip()
            if len(buf) + len(para) > target_chars and buf:
                chunks.append(ChunkDraft(page.number, heading, buf.strip()))
                buf = buf[-overlap_chars:] + "\n" if overlap_chars else ""
            while len(para) > target_chars * 1.5:  # very long paragraph: hard split on sentence boundary
                cut = para.rfind(". ", 0, target_chars)
                cut = cut + 1 if cut > target_chars // 2 else target_chars
                chunks.append(ChunkDraft(page.number, heading, (buf + para[:cut]).strip()))
                buf, para = "", para[cut:].strip()
            buf += para + "\n\n"
        if buf.strip():
            chunks.append(ChunkDraft(page.number, heading, buf.strip()))
    return [c for c in chunks if len(c.text) > 20]


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 3)  # conservative for FR/AR mixed text
