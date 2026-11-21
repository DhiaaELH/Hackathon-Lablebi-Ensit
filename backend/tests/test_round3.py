from app.llm.provider import _retry_delay
from app.workflows.jordan import _backoff

from .conftest import login, make_client


def test_people_suggestions_privacy(client):
    login(client, "student@demo.lessonforge.local")
    sugg = client.get("/api/users/suggestions").json()
    names = [s["username"] for s in sugg]
    assert names and all(s["reason"] for s in sugg)
    assert "youssef" not in names  # already followed
    assert "synthetic4" not in names  # not searchable
    s2 = next(s for s in sugg if s["username"] == "synthetic2")
    assert "Followed by Youssef" in s2["reason"]  # Youssef opted in to showing follows
    client.post("/api/users/synthetic1/dismiss-suggestion")
    assert "synthetic1" not in [s["username"] for s in client.get("/api/users/suggestions").json()]
    client.post("/api/users/synthetic3/block")
    assert "synthetic3" not in [s["username"] for s in client.get("/api/users/suggestions").json()]
    client.delete("/api/users/synthetic3/block")


def test_open_problems_flow(client, demo_course_id):
    ex = next(a for a in client.get(f"/api/courses/{demo_course_id}/assessments").json() if a["kind"] == "exercise" and "Sous-réseaux" in a["title"])
    assert ex["problems"] == 1 and ex["questions"] == 2
    detail = client.get(f"/api/assessments/{ex['id']}").json()
    prob = next(q for q in detail["questions"] if q["qtype"] == "open")
    assert prob["hints"] and "worked_solution" not in prob and "rubric" not in prob and prob["rubric_size"] >= 3
    # solution is locked until an answer (or an explicit give-up)
    assert client.get(f"/api/questions/{prob['id']}/solution").status_code == 400
    g = client.post(f"/api/questions/{prob['id']}/open-answer",
                    json={"answer": "On emprunte 2 bits : masque /26 = 255.255.255.192, pas de 64, 62 hôtes utilisables.", "hints_used": 1}).json()
    assert 0 <= g["score"] <= 100 and g["met"] and g["demo"] is True
    sol = client.get(f"/api/questions/{prob['id']}/solution").json()
    assert "192.168.10.64" in sol["solution"] and len(sol["rubric"]) >= 3
    # MCQ scoring ignores open problems
    mcq = [q for q in detail["questions"] if q["qtype"] == "mcq"]
    res = client.post(f"/api/assessments/{ex['id']}/attempts", json={"answers": {q["id"]: 0 for q in mcq}}).json()
    assert len(res["results"]) == len(mcq)
    again = client.get(f"/api/assessments/{ex['id']}").json()
    assert next(q for q in again["questions"] if q["qtype"] == "open")["my_last"]["score"] == g["score"]


def test_retry_failed_agents(client, demo_course_id):
    detail = client.get(f"/api/courses/{demo_course_id}").json()
    wf = detail["workflow"]["id"]
    assert client.post(f"/api/workflows/{wf}/retry").status_code == 403  # students can't
    with make_client() as t:
        login(t, "teacher@demo.lessonforge.local")
        assert t.post(f"/api/workflows/{wf}/retry").status_code == 400  # nothing failed in the seed


def test_backoff_and_retry_delay():
    assert _retry_delay(Exception("429 ... {'retryDelay': '23s'}")) == 23
    assert _retry_delay(Exception("no hint")) is None
    assert 23 <= _backoff(0, 23) <= 24.6
    assert _backoff(10, None) <= 46.6  # capped
