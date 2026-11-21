import time

from .conftest import login, make_client

SAMPLE = """# Chapitre 1 : Les fonctions

## 1.1 Définition
Fonction : relation qui associe à chaque élément x d'un ensemble de départ au plus un élément f(x).
Domaine de définition : ensemble des valeurs de x pour lesquelles f(x) existe.

## 1.2 Dérivée
Dérivée : limite du taux d'accroissement quand h tend vers 0.
Formule : (u + v)' = u' + v'
Point difficile : la dérivée d'un produit n'est pas le produit des dérivées.

# Chapitre 2 : Intégrales

## 2.1 Primitive
Primitive : fonction F telle que F' = f sur un intervalle.
Intégrale : aire algébrique sous la courbe entre a et b, égale à F(b) - F(a).
"""


def test_health_reports_demo_mode(client):
    h = client.get("/api/system/health").json()
    assert h["demo_mode"] is True and h["provider"] == "demo" and h["min_cohort"] == 5


def test_csrf_header_required(seeded):
    with make_client() as c:
        del c.headers["X-Requested-With"]
        r = c.post("/api/auth/login", json={"email": "student@demo.lessonforge.local", "password": "x"})
        assert r.status_code == 403


def test_login_errors_are_generic(client):
    r1 = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "whatever123"})
    r2 = client.post("/api/auth/login", json={"email": "student@demo.lessonforge.local", "password": "wrong-password"})
    assert r1.status_code == r2.status_code == 401 and r1.json() == r2.json()


def test_teacher_signup_requires_code(client):
    r = client.post("/api/auth/register", json={"email": "t1@example.com", "password": "longpassword", "display_name": "T", "role": "teacher"})
    assert r.status_code == 403


def test_upload_workflow_tutor_and_privacy(client):
    client.post("/api/auth/register", json={"email": "owner@example.com", "password": "longpassword", "display_name": "Owner"})
    course = client.post("/api/courses", json={"title": "Analyse 1", "language": "fr"}).json()
    cid = course["id"]
    assert course["visibility"] == "private"
    r = client.post(f"/api/courses/{cid}/resources/text", json={"title": "notes", "text": SAMPLE, "rights_confirmed": False})
    assert r.status_code == 400
    r = client.post(f"/api/courses/{cid}/resources/text", json={"title": "notes", "text": SAMPLE, "rights_confirmed": True})
    assert r.status_code == 200 and r.json()["chunks"] >= 3
    # A fake PDF is rejected by magic-byte check
    r = client.post(f"/api/courses/{cid}/resources/upload", files={"file": ("x.pdf", b"not a pdf", "application/pdf")}, data={"rights_confirmed": "true"})
    assert r.status_code == 415

    wf = client.post(f"/api/courses/{cid}/workflow").json()["workflow_id"]
    for _ in range(50):
        st = client.get(f"/api/workflows/{wf}").json()
        if st["status"] in ("done", "partial", "failed"):
            break
        time.sleep(0.2)
    assert st["status"] in ("done", "partial"), st
    detail = client.get(f"/api/courses/{cid}").json()
    assert len(detail["chapters"]) == 2
    terms = [kt["term"] for ch in detail["chapters"] for s in ch["sections"] for kt in s["key_terms"]]
    assert "Dérivée" in terms
    assert all(s["citations"] for ch in detail["chapters"] for s in ch["sections"])

    # Tutor answers from the student's own source with valid citations
    r = client.post(f"/api/courses/{cid}/nova", json={"message": "C'est quoi une primitive ?", "mode": "answer"}).json()
    sam = r["replies"][0]
    assert r["routed_to"] == ["sam"] and sam["citations"] and sam["demo"] is True
    assert sam["citations"][0] in detail["refs"]
    assert "primitive" in (detail["refs"][sam["citations"][0]]["excerpt"]).lower()

    # Another user cannot see or retrieve from this private course
    with make_client() as other:
        login(other, "senior@demo.lessonforge.local")
        assert other.get(f"/api/courses/{cid}").status_code == 404
        assert other.post(f"/api/courses/{cid}/nova", json={"message": "primitive"}).status_code == 404
        assert all(c["id"] != cid for c in other.get("/api/library").json())


def test_answer_key_hidden_then_scored_with_gap_diagnosis(client, demo_course_id):
    items = client.get(f"/api/courses/{demo_course_id}/assessments").json()
    quiz = next(a for a in items if a["kind"] == "chapter_quiz" and "Adressage" in a["title"])
    a = client.get(f"/api/assessments/{quiz['id']}").json()
    assert all("correct_index" not in q and "explanation" not in q for q in a["questions"])
    first = a["questions"][0]  # 62 hosts question: answer 0 (64) is the 2^h mistake
    answers = {q["id"]: 0 for q in a["questions"]}
    res = client.post(f"/api/assessments/{quiz['id']}/attempts", json={"answers": answers}).json()
    r0 = next(r for r in res["results"] if r["question_id"] == first["id"])
    assert r0["correct"] is False and r0["misconception"] and r0["correct_index"] == 1
    assert res["gaps"], "missed subnetting should point at an untested/weak prerequisite"
    assert all(g["evidence"] for g in res["gaps"])
    # explain my mistake now allowed
    r = client.post(f"/api/courses/{demo_course_id}/nova", json={"message": "pourquoi ?", "mode": "explain_mistake", "question_id": first["id"], "chosen_index": 0})
    assert r.status_code == 200 and "62" in r.json()["replies"][0]["message"]


def test_explain_mistake_requires_attempt(client, demo_course_id):
    items = client.get(f"/api/courses/{demo_course_id}/assessments").json()
    mock = next(a for a in items if a["kind"] == "mock_exam")
    q = client.get(f"/api/assessments/{mock['id']}").json()["questions"][0]
    with make_client() as c2:
        login(c2, "senior@demo.lessonforge.local")
        r = c2.post(f"/api/courses/{demo_course_id}/nova", json={"message": "?", "mode": "explain_mistake", "question_id": q["id"], "chosen_index": 2})
        assert r.status_code == 400


def test_insights_threshold_and_anonymity(client, demo_course_id):
    # students cannot read the dashboard
    assert client.get(f"/api/courses/{demo_course_id}/insights").status_code == 403
    with make_client() as t:
        login(t, "teacher@demo.lessonforge.local")
        d = t.get(f"/api/courses/{demo_course_id}/insights").json()
        by = {h["section"].split(" ")[0]: h for h in d["heatmap"]}
        assert by["2.3"]["students"] == 6 and not by["2.3"]["suppressed"]
        assert by["1.3"]["students"] is None and by["1.3"]["suppressed"]  # 4 students < 5
        assert all(v >= 5 for h in d["heatmap"] for v in h["reasons"].values())
        assert all(t["students"] >= 5 for t in d["trend"])
        blob = str(d)
        assert "token" not in blob and "@" not in blob and "synthetic" not in blob.lower()
        assert d["most_failed_questions"] and d["most_failed_questions"][0]["students"] >= 5

    # A 5th student signals 1.3 -> it becomes visible; a duplicate signal is ignored.
    sec_13 = by["1.3"]["section_id"]
    r = client.post(f"/api/sections/{sec_13}/confusion", json={"reasons": ["vocabulary"], "notify": True}).json()
    assert r["recorded"] is True
    assert client.post(f"/api/sections/{sec_13}/confusion", json={"reasons": ["too_fast"]}).json()["already_signalled"] is True
    with make_client() as t:
        login(t, "teacher@demo.lessonforge.local")
        d = t.get(f"/api/courses/{demo_course_id}/insights").json()
        h = next(h for h in d["heatmap"] if h["section_id"] == sec_13)
        assert h["students"] == 5 and h["reasons"].get("vocabulary") == 5
        assert t.post(f"/api/courses/{demo_course_id}/teacher-responses",
                      json={"section_id": sec_13, "kind": "clarification", "body": "MAC = saut local, IP = bout en bout."}).status_code == 200
    notes = client.get("/api/notifications").json()
    assert any("1.3" in n["title"] for n in notes)


def test_community_hard_vote_and_accept(client, demo_course_id):
    detail = client.get(f"/api/courses/{demo_course_id}").json()
    ch = detail["chapters"][0]["id"]
    v1 = client.post(f"/api/chapters/{ch}/hard").json()
    v2 = client.post(f"/api/chapters/{ch}/hard").json()
    assert v1["voted"] and not v2["voted"] and v2["count"] == v1["count"] - 1
    tid = client.post(f"/api/chapters/{ch}/threads", json={"title": "Question OSI", "body": "Couche 2 ?"}).json()["id"]
    with make_client() as s:
        login(s, "senior@demo.lessonforge.local")
        pid = s.post(f"/api/threads/{tid}/posts", json={"body": "La liaison de données."}).json()["id"]
        assert s.post(f"/api/posts/{pid}/accept").status_code == 403
    assert client.post(f"/api/posts/{pid}/vote", json={"value": 1}).status_code == 200
    assert client.post(f"/api/posts/{pid}/accept").status_code == 200
    th = client.get(f"/api/threads/{tid}").json()
    assert th["posts"][0]["accepted"] and th["posts"][0]["score"] == 1


def test_projects_locked_until_chapter_complete(client, demo_course_id):
    detail = client.get(f"/api/courses/{demo_course_id}").json()
    ch2 = next(c for c in detail["chapters"] if "Adressage" in c["title"])
    assert client.post(f"/api/chapters/{ch2['id']}/projects/generate").status_code == 400
    for s in ch2["sections"]:
        client.post(f"/api/sections/{s['id']}/complete")
    quiz = next(a for a in client.get(f"/api/courses/{demo_course_id}/assessments").json() if a["kind"] == "chapter_quiz" and a["chapter_id"] == ch2["id"])
    correct = {"0": 1, "1": 0, "2": 1, "3": 1}  # fixture answer key order
    qs = client.get(f"/api/assessments/{quiz['id']}").json()["questions"]
    client.post(f"/api/assessments/{quiz['id']}/attempts", json={"answers": {q["id"]: correct[str(i)] for i, q in enumerate(qs)}})
    r = client.post(f"/api/chapters/{ch2['id']}/projects/generate").json()
    assert r["created"] >= 1
    projects = client.get(f"/api/courses/{demo_course_id}/projects").json()
    chap = next(c for c in projects["chapters"] if c["chapter_id"] == ch2["id"])
    assert chap["unlocked"] and chap["projects"][0]["steps"]
    assert client.put(f"/api/projects/{chap['projects'][0]['id']}/status", json={"status": "started", "progress": 30}).status_code == 200


def test_revision_pdf_and_nova_routing(client, demo_course_id):
    r = client.get(f"/api/courses/{demo_course_id}/revision.pdf")
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    rev = client.get(f"/api/courses/{demo_course_id}/revision").json()
    assert rev["revision"]["flashcards"] and rev["topic_map"]["nodes"]
    r = client.post(f"/api/courses/{demo_course_id}/nova", json={"message": "Je veux un résumé et des flashcards"}).json()
    assert r["routed_to"] == ["sage"]
    r = client.post(f"/api/courses/{demo_course_id}/nova", json={"message": "Tu as une vidéo sur le routage ?"}).json()
    assert r["routed_to"] == ["resource_finder"] and "not configured" in r["replies"][0]["message"]
    r = client.post(f"/api/courses/{demo_course_id}/nova", json={"message": "chnowa el masque ?", "mode": "socratic", "language": "derja"}).json()
    assert r["replies"][0]["agent_role"] == "sam" and "؟" in r["replies"][0]["message"]
