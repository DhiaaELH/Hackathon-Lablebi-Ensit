"""Capture the screenshots used on the screens inside the 3D deck.

Headless only. Runs against a LOCAL demo instance of the app (seeded, synthetic
data only: `python -m app.seed --reset`, uvicorn on :8000, `npx vite` on :5173),
so no real user ever appears in a screenshot. Override with LF_BASE=... Run from a venv that has `playwright` and `pillow`:

    python tools/capture.py            # all shots -> shots/*.webp
    python tools/capture.py teacher    # only one account

Login is rate-limited (10 per 5 min): each account logs in once and its
session is reused through storage_state files kept next to this script.
"""
import io
import os
import sys
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LF_BASE", "http://127.0.0.1:5173")  # a local demo instance (see README)
PW = "demo-password-123"
HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "shots"
STATE = HERE / ".state"
DESKTOP = {"width": 1600, "height": 1000}
PHONE = {"width": 390, "height": 844}


def save(page, name, full=False):
    OUT.mkdir(exist_ok=True)
    png = page.screenshot(full_page=full)
    img = Image.open(io.BytesIO(png)).convert("RGB")
    img.save(OUT / f"{name}.webp", "WEBP", quality=82, method=6)
    print("shot", name, img.size, flush=True)


def settle(page, ms=1200):
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass
    page.wait_for_timeout(ms)


def context(browser, account, lang="fr", viewport=DESKTOP, nova=False):
    STATE.mkdir(exist_ok=True)
    state = STATE / f"{account}.json"
    kw = dict(viewport=viewport, device_scale_factor=1, locale="fr-FR")
    if state.exists():
        ctx = browser.new_context(storage_state=str(state), **kw)
    else:
        ctx = browser.new_context(**kw)
        r = ctx.request.post(
            f"{BASE}/api/auth/login",
            headers={"X-Requested-With": "lessonforge"},
            data={"email": f"{account}@demo.lessonforge.local", "password": PW},
        )
        if not r.ok:
            raise SystemExit(f"login failed for {account}: {r.status} {r.text()[:120]}")
        p = ctx.new_page()
        p.goto(f"{BASE}/")
        settle(p)
        ctx.storage_state(path=str(state))
        p.close()
    ctx.add_init_script(
        f"try{{localStorage.setItem('lf.lang','{lang}');"
        f"localStorage.setItem('lf_nova_open','{'1' if nova else '0'}')}}catch(e){{}}"
    )
    return ctx


def demo_course(page):
    r = page.context.request.get(f"{BASE}/api/courses", headers={"X-Requested-With": "lessonforge"})
    courses = r.json() if r.ok else []
    for c in courses:
        if "MO]" in c.get("title", ""):
            return f"/courses/{c['id']}"
    if courses:
        return f"/courses/{courses[0]['id']}"
    raise SystemExit(f"demo course not found ({r.status})")


def student(browser):
    # login page (logged out)
    ctx = browser.new_context(viewport=DESKTOP, locale="fr-FR")
    ctx.add_init_script("try{localStorage.setItem('lf.lang','fr')}catch(e){}")
    p = ctx.new_page()
    p.goto(f"{BASE}/login")
    settle(p)
    save(p, "login")
    ctx.close()

    ctx = context(browser, "student")
    p = ctx.new_page()
    course = demo_course(p)
    print("course", course, flush=True)
    (HERE / ".course").write_text(course)
    for tab in ["overview", "practice", "revision", "map", "resources", "exams", "projects", "progress"]:
        p.goto(f"{BASE}{course}?tab={tab}")
        settle(p, 1800)
        save(p, f"course-{tab}")
    p.goto(f"{BASE}/community")
    settle(p)
    save(p, "community")
    p.goto(f"{BASE}/challenges")
    settle(p)
    save(p, "challenges")
    tabs = p.locator("[role=tab]")
    if tabs.count() >= 2:
        tabs.nth(1).click()
        settle(p, 800)
        save(p, "leaderboard")
    for path, name in [("/", "dashboard"), ("/library", "library"), ("/people", "people")]:
        p.goto(f"{BASE}{path}")
        settle(p)
        save(p, name)
    ctx.close()

    # Nova: open panel, ask one grounded question and one off-topic one
    ctx = context(browser, "student", nova=True)
    p = ctx.new_page()
    p.goto(f"{BASE}{course}?tab=overview")
    settle(p, 1500)
    if p.locator("#nova-input").count():
        for i, q in enumerate(["Quels sont les prérequis ?", "Quelle est la capitale de l'Australie ?"]):
            p.fill("#nova-input", q)
            p.click("form.nova-foot button[type=submit]")
            p.wait_for_timeout(1000)
            try:
                p.wait_for_function("!document.querySelector('form.nova-foot button[type=submit]').disabled", timeout=60000)
            except Exception:
                pass
            p.wait_for_timeout(1500)
            save(p, f"nova-{i + 1}")
    else:
        print("nova input not found", flush=True)
    ctx.close()

    # languages: Arabic (RTL), Derja, English
    for lang in ["ar", "derja", "en"]:
        ctx = context(browser, "student", lang=lang)
        p = ctx.new_page()
        p.goto(f"{BASE}{course}?tab=overview")
        settle(p, 1500)
        save(p, f"lang-{lang}")
        ctx.close()

    # phone
    ctx = context(browser, "student", viewport=PHONE)
    p = ctx.new_page()
    for tab in ["overview", "revision"]:
        p.goto(f"{BASE}{course}?tab={tab}")
        settle(p, 1500)
        save(p, f"phone-{tab}")
    ctx.close()


def teacher(browser):
    course = (HERE / ".course").read_text().strip()
    ctx = context(browser, "teacher")
    p = ctx.new_page()
    p.goto(f"{BASE}{course}/setup")
    settle(p, 1500)
    save(p, "setup")
    p.goto(f"{BASE}{course}?tab=class")
    settle(p, 1500)
    save(p, "class")
    p.goto(f"{BASE}/insights")
    settle(p, 1500)
    save(p, "insights")
    p.goto(f"{BASE}/challenges")
    settle(p)
    tabs = p.locator("[role=tab]")
    if tabs.count() >= 3:
        tabs.nth(tabs.count() - 1).click()
        settle(p, 800)
        save(p, "challenge-publish")
    ctx.close()


def senior(browser):
    ctx = context(browser, "senior")
    p = ctx.new_page()
    p.goto(f"{BASE}/queue")
    settle(p, 1500)
    save(p, "queue")
    ctx.close()


if __name__ == "__main__":
    which = sys.argv[1:] or ["student", "teacher", "senior"]
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True)
        t0 = time.time()
        for name in which:
            {"student": student, "teacher": teacher, "senior": senior}[name](b)
        b.close()
        print("done in", round(time.time() - t0), "s")
