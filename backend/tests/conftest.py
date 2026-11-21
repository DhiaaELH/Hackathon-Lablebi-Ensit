import os
import tempfile

os.environ.setdefault("LF_PGDATA", os.path.join(tempfile.gettempdir(), "lessonforge-test-pgdata"))
os.environ["LLM_PROVIDER"] = "demo"
os.environ["GEMINI_API_KEY"] = ""  # tests never use real keys from .env
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["LLM_FAST"] = ""
os.environ["LLM_SMART"] = ""
os.environ["DATABASE_URL"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402

get_settings.cache_clear()


@pytest.fixture(scope="session")
def seeded():
    from app.seed import seed
    from app.security import limiter

    limiter.enabled = False
    seed(reset=True)
    return True


def make_client() -> TestClient:
    from app.main import app

    c = TestClient(app)
    c.headers.update({"X-Requested-With": "lessonforge"})
    return c


@pytest.fixture
def client(seeded):
    with make_client() as c:
        yield c


def login(c: TestClient, email: str, password: str = "demo-password-123"):
    r = c.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def demo_course_id(client):
    login(client, "student@demo.lessonforge.local")
    courses = client.get("/api/courses").json()
    return next(c["id"] for c in courses if c["is_demo"])
