"""Walk every page and every course tab as every role; fail on crashes, console errors or bad API answers."""
import pytest

from conftest import BASE_URL, ROLES, assert_clean, assert_rendered, login, settle, watch

COMMON_PAGES = ["/", "/library", "/people", "/messages", "/notifications", "/settings"]
GATED_PAGES = {  # path -> roles allowed (others are sent back to "/")
    "/insights": {"teacher", "admin"},
    "/queue": {"senior", "teacher", "admin"},
    "/moderation": {"admin"},
}
COURSE_TABS = ["overview", "practice", "revision", "map", "resources", "exams", "projects", "progress", "community"]


def visit(page, path: str):
    probs = watch(page)
    page.goto(f"{BASE_URL}{path}")
    settle(page)
    return probs


# ---------- logged out ----------

def test_login_page_renders(anon_page):
    probs = visit(anon_page, "/login")
    assert_rendered(anon_page)
    assert anon_page.locator("#email").is_visible()
    assert_clean(probs, "/login")


def test_protected_page_redirects_to_login(anon_page):
    probs = visit(anon_page, "/library")
    assert anon_page.url.rstrip("/").endswith("/login"), anon_page.url
    assert_clean(probs, "/library (logged out)")


def test_wrong_password_shows_error_and_stays(anon_page):
    probs = watch(anon_page)
    anon_page.goto(f"{BASE_URL}/login")
    anon_page.fill("#email", ROLES["student"])
    anon_page.fill("#pw", "definitely-not-the-password")
    with anon_page.expect_response(lambda r: "/api/auth/login" in r.url) as resp:
        anon_page.click("button[type=submit]")
    assert resp.value.status in (401, 429), resp.value.status  # 429 = rate limit, also a correct refusal
    settle(anon_page)
    assert anon_page.url.rstrip("/").endswith("/login")
    # the refused login itself is expected; anything else is not
    probs.items = [p for p in probs.items if "/api/auth/login" not in p]
    assert_clean(probs, "wrong-password login")


# ---------- every page, every role ----------

@pytest.mark.parametrize("role", list(ROLES))
@pytest.mark.parametrize("path", COMMON_PAGES)
def test_common_pages(as_role, role, path):
    page = as_role(role)
    probs = visit(page, path)
    assert "/login" not in page.url, f"{role} was logged out on {path}"
    assert_rendered(page)
    assert_clean(probs, f"{path} as {role}")


@pytest.mark.parametrize("role", list(ROLES))
@pytest.mark.parametrize("path", list(GATED_PAGES))
def test_role_gated_pages(as_role, role, path):
    page = as_role(role)
    probs = visit(page, path)
    assert_rendered(page)
    if role in GATED_PAGES[path]:
        assert page.url.split("?")[0].endswith(path), f"{role} should reach {path}, got {page.url}"
    else:
        assert page.url.split("?")[0].rstrip("/") == BASE_URL, f"{role} must not see {path}, got {page.url}"
    assert_clean(probs, f"{path} as {role}")


@pytest.mark.parametrize("role", list(ROLES))
def test_own_profile(as_role, role):
    page = as_role(role)
    page.goto(f"{BASE_URL}/")
    me = page.request.get(f"{BASE_URL}/api/auth/me").json()
    probs = visit(page, f"/u/{me['username']}")
    assert_rendered(page)
    assert_clean(probs, f"own profile as {role}")


def test_unknown_route_goes_home(as_role):
    page = as_role("student")
    probs = visit(page, "/this-page-does-not-exist")
    assert page.url.rstrip("/") == BASE_URL, page.url
    assert_clean(probs, "unknown route")


# ---------- every course the user can open, every tab ----------

def _courses(page):
    page.goto(f"{BASE_URL}/")
    r = page.request.get(f"{BASE_URL}/api/courses")
    assert r.ok, r.status
    return r.json()


@pytest.mark.parametrize("role", ["student", "teacher"])
def test_every_course_tab(as_role, role):
    page = as_role(role)
    courses = [c for c in _courses(page) if c.get("status") == "ready"]
    if not courses:
        pytest.skip(f"{role} has no ready course")
    failures = []
    for c in courses:
        for tab in COURSE_TABS:
            probs = visit(page, f"/courses/{c['id']}?tab={tab}")
            try:
                assert_rendered(page)
            except AssertionError as e:
                failures.append(f"{c['title']} / {tab}: {e}")
            failures += [f"{c['title']} / {tab}: {p}" for p in probs.items]
    assert not failures, f"{len(failures)} problem(s):\n  " + "\n  ".join(failures)


def test_course_setup_page_for_owned_courses(as_role):
    page = as_role("student")
    owned = [c for c in _courses(page) if c.get("access") == "owner"]
    if not owned:
        pytest.skip("student owns no course")
    failures = []
    for c in owned:
        probs = visit(page, f"/courses/{c['id']}/setup")
        assert_rendered(page)
        failures += [f"{c['title']}: {p}" for p in probs.items]
    assert not failures, "\n  ".join(failures)


def test_logout(browser):
    # Own login, so logging out cannot invalidate the session the other tests share.
    ctx = browser.new_context(locale="fr-FR")
    login(ctx, ROLES["senior"])
    page = ctx.new_page()
    page.goto(f"{BASE_URL}/")
    settle(page)
    probs = watch(page)
    r = page.request.post(f"{BASE_URL}/api/auth/logout", headers={"X-Requested-With": "lessonforge"})
    assert r.ok, r.status
    page.goto(f"{BASE_URL}/library")
    settle(page)
    assert page.url.rstrip("/").endswith("/login"), page.url
    assert_clean(probs, "logout")
    ctx.close()
