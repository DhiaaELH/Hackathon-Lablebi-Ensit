"""Text extraction with provenance. Uploaded content is untrusted DATA: we only extract text, never
execute anything, and validate type by magic bytes as well as extension/MIME."""
import io
import zipfile
from dataclasses import dataclass, field

from ..retrieval.chunking import Page

ALLOWED = {
    ".pdf": ("pdf", {"application/pdf"}),
    ".pptx": ("pptx", {"application/vnd.openxmlformats-officedocument.presentationml.presentation"}),
    ".txt": ("text", {"text/plain"}),
    ".md": ("text", {"text/markdown", "text/plain"}),
    ".png": ("image", {"image/png"}),
    ".jpg": ("image", {"image/jpeg"}),
    ".jpeg": ("image", {"image/jpeg"}),
}


class UnsupportedFile(ValueError):
    pass


@dataclass
class Extraction:
    kind: str
    pages: list[Page]
    status: str = "ok"  # ok|partial|failed
    notes: list[str] = field(default_factory=list)


def detect_kind(filename: str, mime: str | None, head: bytes) -> str:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED:
        raise UnsupportedFile(f"File type {ext or '(none)'} is not supported. Use PDF, PPTX, TXT/MD, PNG or JPG.")
    kind, _mimes = ALLOWED[ext]
    magic_ok = {
        "pdf": head.startswith(b"%PDF"),
        "pptx": head.startswith(b"PK\x03\x04"),
        "image": head.startswith(b"\x89PNG") or head.startswith(b"\xff\xd8\xff"),
        "text": b"\x00" not in head[:4096],
    }[kind]
    if not magic_ok:
        raise UnsupportedFile("The file content does not match its extension.")
    return kind


def _ocr_image(data: bytes) -> tuple[str | None, str | None]:
    try:
        import pytesseract  # optional
        from PIL import Image
    except ImportError:
        return None, "OCR is not installed on this server (pip install pytesseract pillow + tesseract-ocr). Paste the text instead."
    try:
        return pytesseract.image_to_string(Image.open(io.BytesIO(data)), lang="fra+eng+ara"), None
    except Exception as exc:  # tesseract binary/lang packs missing
        return None, f"OCR failed: {exc.__class__.__name__}. Paste the text instead."


def extract(kind: str, data: bytes) -> Extraction:
    if kind == "text":
        return Extraction(kind, [Page(None, data.decode("utf-8", errors="replace"))])

    if kind == "pdf":
        from pypdf import PdfReader

        try:
            reader = PdfReader(io.BytesIO(data))
        except Exception:
            return Extraction(kind, [], "failed", ["The PDF could not be read (corrupted or encrypted)."])
        pages, empty = [], []
        for i, page in enumerate(reader.pages, start=1):
            try:
                txt = page.extract_text() or ""
            except Exception:
                txt = ""
            if len(txt.strip()) < 15:
                empty.append(i)
            else:
                pages.append(Page(i, txt))
        ex = Extraction(kind, pages)
        if empty:
            ex.status = "partial" if pages else "failed"
            ex.notes.append(
                f"{len(empty)} page(s) look scanned or empty ({', '.join(map(str, empty[:10]))}"
                f"{'…' if len(empty) > 10 else ''}). Scanned-page OCR is not enabled; paste their text if needed."
            )
        return ex

    if kind == "pptx":
        from pptx import Presentation

        try:
            prs = Presentation(io.BytesIO(data))
        except (zipfile.BadZipFile, KeyError, ValueError):
            return Extraction(kind, [], "failed", ["The PowerPoint file could not be read."])
        pages = []
        for i, slide in enumerate(prs.slides, start=1):
            texts = [sh.text_frame.text for sh in slide.shapes if getattr(sh, "has_text_frame", False) and sh.text_frame.text.strip()]
            if texts:
                pages.append(Page(i, "\n".join(texts)))
        return Extraction(kind, pages, "ok" if pages else "failed", [] if pages else ["No text found in the slides."])

    if kind == "image":
        txt, err = _ocr_image(data)
        if err or not txt or not txt.strip():
            return Extraction(kind, [], "failed", [err or "No text recognised in the image."])
        return Extraction(kind, [Page(1, txt)], "partial", ["Text was recognised by OCR; check it for errors."])

    raise UnsupportedFile(kind)
