"""Behaviour of the course UI: math rendering, outline, Nova drawer on small screens, no sideways scrolling on phones."""
import re

import pytest

from conftest import BASE_URL, assert_clean, settle, watch

# A LaTeX command that escaped KaTeX and is shown to the student as raw text (e.g. "\mathbb{R}", "\sigma").
RAW_TEX = re.compile(r"\\(?:[a-zA-Z]{2,})")


def _ready_courses(page):
    page.goto(f"{BASE_URL}/")
    r = page.request.get(f"{BASE_URL}/api/courses")
    assert r.ok, r.status
    return [c for c in r.json() if c.get("status") == "ready"]


def _visible_text_outside_math(page) -> str:
    # KaTeX keeps the TeX source in hidden MathML annotations; only text a reader can see counts.
    return page.evaluate("""() => {
        const root = document.querySelector('.workspace-main') || document.body;
        const clone = root.cloneNode(true);
        clone.querySelectorAll('.katex, .tex-raw, textarea, input, script, style').forEach((n) => n.remove());
        return clone.innerText;
    }""")


@pytest.mark.parametrize("tab", ["overview", "practice", "revision", "map"])
def test_no_raw_latex_visible(as_role, tab):
    page = as_role("student")
    courses = _ready_courses(page)
    if not courses:
        pytest.skip("no ready course")
    leaks = []
    for c in courses:
        page.goto(f"{BASE_URL}/courses/{c['id']}?tab={tab}")
        settle(page)
        if tab == "revision":  # open the summary view if the tab has sub-tabs
            page.wait_for_timeout(300)
        text = _visible_text_outside_math(page)
        leaks += [f"{c['title']} / {tab}: …{text[max(0, m.start() - 40):m.end() + 40]!r}…" for m in RAW_TEX.finditer(text)]
        if tab == "map":
            labels = " ".join(t or "" for t in page.locator(".topic-map text").all_text_contents())
            leaks += [f"{c['title']} / map label: {m.group(0)}" for m in RAW_TEX.finditer(labels)]
    assert not leaks, "raw LaTeX visible:\n  " + "\n  ".join(leaks[:20])


def test_outline_lists_every_section(as_role):
    page = as_role("student")
    courses = _ready_courses(page)
    if not courses:
        pytest.skip("no ready course")
    c = courses[0]
    probs = watch(page)
    page.goto(f"{BASE_URL}/courses/{c['id']}?tab=overview")
    settle(page)
    n_sections = page.locator("article.section-block").count()
    assert n_sections > 0
    outline = page.locator("details.outline")
    assert outline.get_attribute("open") is None, "outline should start collapsed"
    outline.locator("summary").click()
    links = outline.locator(".outline-list ol a")
    assert links.count() == n_sections
    links.last.click()
    # smooth scrolling over a long course takes a moment: wait for the section to reach the viewport
    page.wait_for_function("""() => {
        const s = [...document.querySelectorAll('article.section-block')].pop();
        const r = s.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0;
    }""", timeout=5000)
    assert_clean(probs, "outline")


def test_nova_drawer_on_phone(as_role):
    page = as_role("student", phone=True)
    courses = _ready_courses(page)
    if not courses:
        pytest.skip("no ready course")
    probs = watch(page)
    page.goto(f"{BASE_URL}/courses/{courses[0]['id']}")
    settle(page)
    fab = page.locator(".nova-fab")
    assert fab.is_visible(), "the 'Ask Nova' button should be visible on phones"
    assert not page.locator(".nova-dock .nova").is_visible(), "Nova should be hidden until opened"
    fab.click()
    page.wait_for_timeout(500)
    assert page.locator(".nova-dock.open .nova").is_visible()
    assert page.locator(".nova-dock input, .nova-dock textarea").first.is_visible(), "the question box should be usable"
    page.locator(".nova-close").click()
    page.wait_for_timeout(500)
    assert page.locator(".nova-dock.open").count() == 0
    fab.click()
    page.wait_for_timeout(400)
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    assert page.locator(".nova-dock.open").count() == 0, "Esc should close the drawer"
    assert_clean(probs, "nova drawer")


def test_nova_always_visible_on_desktop(as_role):
    page = as_role("student")
    courses = _ready_courses(page)
    if not courses:
        pytest.skip("no ready course")
    page.goto(f"{BASE_URL}/courses/{courses[0]['id']}")
    settle(page)
    assert page.locator(".nova-dock .nova").is_visible()
    assert not page.locator(".nova-fab").is_visible()


@pytest.mark.parametrize("path", ["/", "/library", "/people", "/messages", "/notifications", "/settings"])
def test_no_horizontal_scroll_on_phone(as_role, path):
    page = as_role("student", phone=True)
    page.goto(f"{BASE_URL}{path}")
    settle(page)
    width = page.evaluate("document.documentElement.scrollWidth")
    assert width <= 391, f"{path} is {width}px wide on a 390px phone"
