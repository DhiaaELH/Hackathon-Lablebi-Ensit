"""Gemini multimodal helpers: OCR of scanned PDFs/images, YouTube transcription, Google-Search grounding.
Only used when GEMINI_API_KEY is set; every function fails with a clear, user-facing message otherwise."""
import ipaddress
import logging
import socket
from urllib.parse import urlparse

from ..config import get_settings
from ..retrieval.chunking import Page

log = logging.getLogger("lessonforge.media")


class MediaUnavailable(RuntimeError):
    pass


def _client():
    s = get_settings()
    if not s.gemini_api_key:
        raise MediaUnavailable("This needs a Gemini key on the server (GEMINI_API_KEY).")
    from google import genai
    from google.genai import types

    return genai.Client(api_key=s.gemini_api_key, http_options=types.HttpOptions(timeout=120_000)), types


def _model() -> str:
    return get_settings().gemini_fast_model


PAGE_SEP = "=====PAGE====="


def ocr(data: bytes, mime: str) -> list[Page]:
    """Transcribe a scanned PDF or a photo of notes. Returns pages with 1-based numbers."""
    client, types = _client()
    prompt = (f"Transcribe all readable text of this document exactly, in its original language. Keep headings. "
              f"Start every page with a line '{PAGE_SEP} <page number>'. Output only the transcription.")
    try:
        r = client.models.generate_content(model=_model(), contents=[types.Part.from_bytes(data=data, mime_type=mime), prompt])
    except Exception as e:
        raise MediaUnavailable(f"OCR failed: {str(e)[:160]}") from e
    text = r.text or ""
    pages: list[Page] = []
    for block in text.split(PAGE_SEP):
        block = block.strip()
        if not block:
            continue
        first, _, rest = block.partition("\n")
        num = int(first.strip()) if first.strip().isdigit() else len(pages) + 1
        if rest.strip():
            pages.append(Page(num, rest.strip()))
    if not pages and text.strip():
        pages = [Page(1, text.strip())]
    return pages


def youtube_transcript(url: str) -> list[Page]:
    client, types = _client()
    prompt = ("Write a faithful, detailed transcript-style summary of what is taught in this video, in the video's language, "
              "with section headings ('## ...') and timestamps like [mm:ss] at the start of each section. Do not add facts not in the video.")
    try:
        r = client.models.generate_content(model=_model(), contents=types.Content(parts=[types.Part(file_data=types.FileData(file_uri=url)), types.Part(text=prompt)]))
    except Exception as e:
        raise MediaUnavailable(f"Could not read this video (captions/visibility?): {str(e)[:160]}") from e
    if not (r.text or "").strip():
        raise MediaUnavailable("The video returned no usable content.")
    return [Page(None, r.text)]


def _public_host(url: str) -> bool:
    try:
        host = urlparse(url).hostname or ""
        for info in socket.getaddrinfo(host, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        return bool(host)
    except Exception:
        return False


def _verify(url: str) -> str | None:
    """Follow redirects (grounding links are redirects) and return the final URL if it answers < 400."""
    import httpx

    if not url.startswith(("http://", "https://")) or not _public_host(url):
        return None
    try:
        with httpx.Client(follow_redirects=True, timeout=6.0, headers={"User-Agent": "LessonForge-ResourceFinder/0.1"}) as c:
            r = c.get(url)
            final = str(r.url)
            if r.status_code < 400 and _public_host(final):
                return final
    except Exception:
        return None
    return None


def find_resources(topic: str, language: str) -> list[dict]:
    """Resource Finder: Gemini + Google Search grounding. Only links returned by the search tool are used,
    and each is fetched to check it exists. The model never writes URLs itself."""
    client, types = _client()
    lang = {"fr": "French", "en": "English", "ar": "Arabic", "derja": "French or Arabic"}.get(language, "French")
    prompt = (f"Find up to 4 free, credible learning resources (videos, course pages, exercises) in {lang} for a university "
              f"student who struggles with: {topic}. For each, one short sentence on why it helps.")
    try:
        r = client.models.generate_content(model=_model(), contents=prompt,
                                           config=types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())]))
    except Exception as e:
        msg = str(e)
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
            raise MediaUnavailable("Web search is not included in this Gemini plan (quota). Enable billing to use the Resource Finder.") from e
        raise MediaUnavailable(f"Search failed: {msg[:160]}") from e
    gm = r.candidates[0].grounding_metadata if r.candidates else None
    chunks = (gm.grounding_chunks or []) if gm else []
    reasons: dict[int, str] = {}
    for sup in (gm.grounding_supports or []) if gm else []:
        for idx in sup.grounding_chunk_indices or []:
            reasons.setdefault(idx, (sup.segment.text or "")[:220] if sup.segment else "")
    out, seen = [], set()
    for i, ch in enumerate(chunks):
        if not ch.web or not ch.web.uri:
            continue
        final = _verify(ch.web.uri)
        if not final or final in seen:
            continue
        seen.add(final)
        out.append({"title": ch.web.title or urlparse(final).hostname, "url": final, "provider": urlparse(final).hostname,
                    "reason": reasons.get(i, ""), "topic": topic})
        if len(out) >= 4:
            break
    return out
