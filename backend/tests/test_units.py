from app.agents.roles import riley_rules, stable_history
from app.retrieval.chunking import Page, chunk_pages
from app.retrieval.embeddings import HashEmbedder
from app.workflows.jordan import _creates_cycle


def test_chunking_keeps_pages_and_headings():
    chunks = chunk_pages([Page(1, "## Intro\nHello world, this is a test paragraph."), Page(2, "More text on page two that is long enough.")])
    assert [c.page for c in chunks] == [1, 2] and chunks[0].section_hint == "Intro"


def test_hash_embedder_similarity():
    e = HashEmbedder(384)
    a, b, c = e.embed(["masque de sous-réseau", "le masque du sous réseau", "poignée de main TCP"])
    dot = lambda x, y: sum(i * j for i, j in zip(x, y))
    assert dot(a, b) > dot(a, c)


def test_cycle_prevention():
    edges = {"b": {"a"}}
    assert _creates_cycle(edges, "a", "b") is True
    assert _creates_cycle(edges, "c", "b") is False


def test_riley_rules_catch_bad_questions():
    payload = {"quizzes": [{"chapter_title": "C", "questions": [
        {"concept_key": "x", "prompt": "Q?", "choices": ["a", "b", "c"], "correct_index": 5, "explanation": "", "distractor_notes": [], "citations": ["S99"]}]}]}
    issues = {f["issue"].split(".")[0] for f in riley_rules("quinn", payload, {"S1"}, {"x"})}
    assert any("4 choices" in i for i in issues) and any("out of range" in i for i in issues) and any("citation" in i for i in issues)


def test_history_window_is_stable():
    hist = [{"role": "user" if i % 2 == 0 else "assistant", "content": str(i)} for i in range(30)]
    w1 = stable_history(hist)
    w2 = stable_history(hist + [{"role": "user", "content": "x"}, {"role": "assistant", "content": "y"}])
    assert w2[: len(w1)] == w1  # appending turns never changes the earlier (cached) prefix
