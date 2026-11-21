from app.api.growth import sm2

from .conftest import login, make_client


def _new_user(c, email, name, searchable=True, message_setting="followers"):
    r = c.post("/api/auth/register", json={"email": email, "password": "longpassword", "display_name": name})
    assert r.status_code == 200, r.text
    c.patch("/api/auth/me", json={"searchable": searchable, "message_setting": message_setting})
    return r.json()["username"]


def test_social_privacy_follow_block_dm(seeded):
    with make_client() as a, make_client() as b, make_client() as hidden:
        ua = _new_user(a, "alice@example.com", "Alice Test", message_setting="followers")
        ub = _new_user(b, "bob@example.com", "Bob Test", message_setting="everyone")
        _new_user(hidden, "hid@example.com", "Hidden Test", searchable=False)
        names = [u["username"] for u in a.get("/api/users/search?q=test").json()]
        assert ub in names and "hid" not in names and ua not in names  # opt-in only, never yourself
        assert "email" not in str(a.get("/api/users/search?q=bob").json())
        # Bob may not DM Alice (she only accepts people she follows); Alice may DM Bob (everyone)
        assert b.post("/api/conversations", json={"username": ua}).status_code == 403
        conv = a.post("/api/conversations", json={"username": ub}).json()
        assert a.post(f"/api/conversations/{conv['id']}/messages", json={"body": "salut"}).status_code == 200
        assert b.get(f"/api/conversations/{conv['id']}/messages").json()["messages"][0]["body"] == "salut"
        assert hidden.get(f"/api/conversations/{conv['id']}/messages").status_code == 404  # participants only
        a.post(f"/api/users/{ub}/follow")
        assert b.post("/api/conversations", json={"username": ua}).status_code == 200  # now Alice follows Bob
        # Block: no more messages either way, disappears from search, follow removed
        b.post(f"/api/users/{ua}/block")
        assert a.post(f"/api/conversations/{conv['id']}/messages", json={"body": "?"}).status_code == 403
        assert ub not in [u["username"] for u in a.get("/api/users/search?q=bob").json()]
        assert a.post(f"/api/users/{ub}/follow").status_code == 400


def test_groups_recommendations_and_srs(client, demo_course_id):
    gid = client.post(f"/api/courses/{demo_course_id}/groups", json={"title": "Groupe test", "exam_date": "2030-01-15"}).json()["id"]
    groups = client.get(f"/api/courses/{demo_course_id}/groups").json()
    assert any(g["id"] == gid and g["joined"] for g in groups)
    assert client.post(f"/api/conversations/{gid}/messages", json={"body": "On révise ?"}).status_code == 200

    recs = client.get("/api/recommendations").json()
    assert recs["items"] and all(r["reason"] for r in recs["items"])
    rid = recs["items"][0]["id"]
    client.post(f"/api/recommendations/{rid}/feedback", json={"action": "dismissed"})
    assert rid not in [r["id"] for r in client.get("/api/recommendations").json()["items"]]

    due = client.get(f"/api/courses/{demo_course_id}/flashcards/due").json()
    assert due["due"] and due["total"] >= len(due["due"])
    k = due["due"][0]["key"]
    r = client.post(f"/api/courses/{demo_course_id}/flashcards/review", json={"key": k, "quality": 5}).json()
    assert r["interval_days"] == 1
    assert k not in [c["key"] for c in client.get(f"/api/courses/{demo_course_id}/flashcards/due").json()["due"]]


def test_sm2_schedule():
    e, i, n = sm2(2.5, 0, 0, 5)
    assert (i, n) == (1, 1)
    e, i, n = sm2(e, i, n, 4)
    assert (i, n) == (6, 2)
    e2, i, n = sm2(e, i, n, 1)
    assert (i, n) == (1, 0) and e2 < e


def test_verified_by_students_and_corrections(client, demo_course_id):
    items = client.get(f"/api/courses/{demo_course_id}/assessments").json()
    quiz = next(a for a in items if a["kind"] == "chapter_quiz" and "Adressage" in a["title"])
    q = client.get(f"/api/assessments/{quiz['id']}").json()["questions"][0]
    assert client.post(f"/api/questions/{q['id']}/endorse").status_code in (200, 400)
    res = client.post(f"/api/assessments/{quiz['id']}/attempts", json={"answers": {q["id"]: 1}}).json()
    comm = next(r for r in res["results"] if r["question_id"] == q["id"])["community"]
    assert comm["verified_by_students"] is True and "not expert" in comm["note"]  # 3 synthetic endorsements
    st = client.post(f"/api/questions/{q['id']}/corrections", json={"body": "L'explication devrait rappeler que h = 32 - préfixe."}).json()
    cid = st["corrections"][-1]["id"]
    with make_client() as t:
        login(t, "teacher@demo.lessonforge.local")
        st = t.post(f"/api/question-corrections/{cid}/vote").json()  # teacher vote accepts immediately
    assert any(c["status"] == "accepted" for c in st["corrections"]) and st["corrected_by_students"]


def test_glossary_exams_and_shared(client, demo_course_id):
    t = client.post(f"/api/courses/{demo_course_id}/glossary", json={"term_fr": "Routeur", "term_ar": "موجّه", "explanation": "Relie des réseaux."}).json()
    assert t["review_state"] == "pending"
    with make_client() as s:
        login(s, "senior@demo.lessonforge.local")
        assert s.post(f"/api/glossary/{t['id']}/review").json()["review_state"] == "reviewed"
    ex = client.get(f"/api/courses/{demo_course_id}/exams").json()
    assert len(ex["exams"]) >= 2 and max(c["papers"] for c in ex["chapter_frequency"]) >= 2
    assert client.get(f"/api/courses/{demo_course_id}/exams?year=2024").json()["exams"][0]["year"] == 2024
    e = client.get(f"/api/exams/{ex['exams'][0]['id']}").json()
    assert e["correction_list"]
    detail = client.get(f"/api/courses/{demo_course_id}").json()
    ch = detail["chapters"][0]["id"]
    assert client.post(f"/api/chapters/{ch}/shared", json={"kind": "note", "title": "Ma fiche", "body": "x", "rights_confirmed": False}).status_code == 400
    r = client.post(f"/api/chapters/{ch}/shared", json={"kind": "video_url", "title": "Vidéo", "url": "https://example.com/v", "rights_confirmed": True}).json()
    assert r["url"].startswith("https://")
    fr = client.post(f"/api/courses/{demo_course_id}/resource-finder", json={"topic": "sous-réseaux"}).json()
    assert fr["available"] is False and fr["results"] == []  # no key in tests -> honest unavailable state, no invented links


def test_senior_queue_and_moderation(client, demo_course_id):
    assert client.get("/api/senior/queue").status_code == 403
    with make_client() as s:
        login(s, "senior@demo.lessonforge.local")
        q = s.get("/api/senior/queue?hours=0").json()
        assert q["items"] and all(i["students"] >= 5 for i in q["items"])
        assert "token" not in str(q) and "@" not in str(q)
    detail = client.get(f"/api/courses/{demo_course_id}").json()
    tid = client.post(f"/api/chapters/{detail['chapters'][0]['id']}/threads", json={"title": "spam spam", "body": "spam"}).json()["id"]
    client.post("/api/reports", json={"target_type": "thread", "target_id": tid, "reason": "spam"})
    assert client.get("/api/admin/reports").status_code == 403
    with make_client() as m:
        login(m, "moderator@demo.lessonforge.local")
        rep = next(r for r in m.get("/api/admin/reports").json() if r["target_id"] == tid)
        assert rep["preview"] == "spam spam"
        assert m.post(f"/api/admin/reports/{rep['id']}", json={"action": "remove"}).status_code == 200
    assert client.get(f"/api/threads/{tid}").status_code == 404
