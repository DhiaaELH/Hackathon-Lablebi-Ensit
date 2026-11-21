"""End-to-end smoke tests: a real headless browser logs in as each demo role and walks the whole UI.

Every page visit records JS exceptions, console errors, failed requests and bad API responses; a test
fails if any of them happened. The suite only navigates and reads - it never creates or edits data - so it
is safe to run against a live deployment.

    E2E_BASE_URL=https://lablebi.nerio.dev pytest e2e        # default: http://localhost:4173 (vite preview)
"""
import os
import re
from dataclasses import dataclass, field

import pytest
from playwright.sync_api import Browser, BrowserContext, Page, Playwright, Response

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:4173").rstrip("/")
PASSWORD = os.environ.get("E2E_PASSWORD", "demo-password-123")

ROLES = {
    "student": "student@demo.lessonforge.local",
    "senior": "senior@demo.lessonforge.local",
    "teacher": "teacher@demo.lessonforge.local",
    "admin": "moderator@demo.lessonforge.local",
}

# API answers that are part of normal behaviour, not bugs: (method, path regex, status)
EXPECTED_API_ERRORS = [
    ("GET", r"^/api/auth/me$", 401),  # "am I logged in?" probe on the login page
]


@dataclass
class Problems:
    items: list[str] = field(default_factory=list)

    def add(self, kind: str, msg: str) -> None:
        self.items.append(f"[{kind}] {msg}")


def _expected(method: str, path: str, status: int) -> bool:
    return any(m == method and re.search(p, path) and s == status for m, p, s in EXPECTED_API_ERRORS)


def watch(page: Page) -> Problems:
    """Attach listeners that collect everything that looks like a bug."""
    probs = Problems()

    def on_console(msg):
        if msg.type == "error":
            text = msg.text
            # The browser logs every non-2xx fetch as a console error; those are judged by on_response instead.
            if "Failed to load resource" in text:
                return
            probs.add("console", text[:400])

    def on_response(resp: Response):
        path = re.sub(r"^https?://[^/]+", "", resp.url).split("?")[0]
        if not path.startswith("/api/"):
            if resp.status >= 400 and resp.request.resource_type in ("script", "stylesheet", "document", "image", "font"):
                probs.add("asset", f"{resp.status} {resp.request.method} {path}")
            return
        if resp.status >= 400 and not _expected(resp.request.method, path, resp.status):
            body = ""
            try:
                body = resp.text()[:200]
            except Exception:
                pass
            probs.add("api", f"{resp.status} {resp.request.method} {path} {body}")

    def on_failed(req):
        failure = req.failure or ""
        if "ERR_ABORTED" in failure:  # navigation away / react-query cancellation - not a bug
            return
        probs.add("network", f"{req.method} {req.url} {failure}")

    page.on("console", on_console)
    page.on("pageerror", lambda exc: probs.add("pageerror", str(exc)[:400]))
    page.on("response", on_response)
    page.on("requestfailed", on_failed)
    return probs


def settle(page: Page) -> None:
    """Wait until the SPA has finished loading data (polling endpoints never go fully idle, so cap it)."""
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    page.wait_for_timeout(300)


def assert_rendered(page: Page) -> None:
    """The app shell must have real content: a blank #root means React crashed."""
    root_text = page.locator("#root").inner_text(timeout=5000).strip()
    assert len(root_text) > 20, f"page looks blank at {page.url!r}: {root_text[:80]!r}"


def assert_clean(probs: Problems, where: str) -> None:
    assert not probs.items, f"{len(probs.items)} problem(s) on {where}:\n  " + "\n  ".join(probs.items)


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


@pytest.fixture(scope="session")
def browser(playwright: Playwright) -> Browser:
    b = playwright.chromium.launch(headless=True)
    yield b
    b.close()


def login(context: BrowserContext, email: str) -> None:
    page = context.new_page()
    page.goto(f"{BASE_URL}/login")
    page.fill("#email", email)
    page.fill("#pw", PASSWORD)
    page.click("button[type=submit]")
    page.wait_for_url(lambda u: not u.rstrip("/").endswith("/login"), timeout=15000)
    page.close()


_STATES: dict[str, dict] = {}


def state_for(browser: Browser, role: str) -> dict:
    """Logged-in storage state for a role. One real login per role per run (login is rate-limited)."""
    if role not in _STATES:
        ctx = browser.new_context(locale="fr-FR")
        login(ctx, ROLES[role])
        _STATES[role] = ctx.storage_state()
        ctx.close()
    return _STATES[role]


PHONE = {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True}


@pytest.fixture
def as_role(browser: Browser):
    """as_role("teacher") -> a fresh desktop Page already logged in; as_role("student", phone=True) -> same on a 390px phone."""
    contexts: list[BrowserContext] = []

    def make(role: str, phone: bool = False) -> Page:
        ctx = browser.new_context(locale="fr-FR", storage_state=state_for(browser, role), **(PHONE if phone else {}))
        contexts.append(ctx)
        return ctx.new_page()

    yield make
    for c in contexts:
        c.close()


@pytest.fixture
def anon_page(browser: Browser):
    ctx = browser.new_context(locale="fr-FR")
    yield ctx.new_page()
    ctx.close()
