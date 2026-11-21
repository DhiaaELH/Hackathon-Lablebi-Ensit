# Hackathon-Lablebi-Ensit — LessonForge

AI learning platform for Tunisian university students (Learn · Community · Class insights).
**Stack:** React 18 + TypeScript (Vite, TanStack Query) · FastAPI (Python 3.12) · PostgreSQL 16 + pgvector · **Gemini** (`google-genai`, default `gemini-3.5-flash`) or **Claude** (`anthropic`, `claude-opus-5-5`) — pick with one env var.

## Run locally

```bash
# 1. Backend
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env               # optional; leave DATABASE_URL empty to use the embedded Postgres
.venv/bin/python -m app.seed --reset   # creates schema + synthetic demo course (no API key needed)
.venv/bin/uvicorn app.main:app --port 8000

# 2. Frontend (new terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api to :8000)
```

Database options: with `DATABASE_URL` unset, the backend starts an **embedded PostgreSQL 16 + pgvector** (`pgserver` package, data in `backend/.pgdata`). For a regular server: `docker compose up -d db` and set
`DATABASE_URL=postgresql+psycopg://lessonforge:lessonforge@localhost:5432/lessonforge`.

**Checks:** `cd backend && .venv/bin/python -m pytest -q` (33 tests) · `cd frontend && npm run typecheck && npm run build`.

### Demo accounts (local only, synthetic)
Password for all: `demo-password-123` (override with `LF_DEMO_PASSWORD` before seeding).
`student@demo.lessonforge.local` · `senior@demo.lessonforge.local` · `teacher@demo.lessonforge.local` · `moderator@demo.lessonforge.local`.
New teacher sign-ups need `TEACHER_INVITE_CODE` (default `demo-teacher-code`).

### LLM providers (Gemini / Claude / demo)
Put **one** key in `backend/.env` (copy `.env.example`; never commit `.env`):
* `GEMINI_API_KEY=...` → Gemini (`GEMINI_MODEL`, with automatic fallback to `GEMINI_FALLBACK_MODELS` when a model is overloaded).
* `ANTHROPIC_API_KEY=...` → Claude. With both keys, `LLM_PROVIDER=gemini|anthropic` chooses.
* **Two tiers:** `fast` (interactive tutor, default `gemini-3.5-flash-lite`, low thinking → ~2 s answers) and `smart` (background generation, `GEMINI_MODEL`). Override either with `LLM_FAST=provider:model` / `LLM_SMART=provider:model` (e.g. `LLM_FAST=anthropic:claude-haiku-5-5`).
* Math: agents write LaTeX in `$...$`; the UI renders it with KaTeX and the PDF converts it to readable symbols.
* Check: `GET /api/system/health` shows the active provider and both tiers. Course owners/teachers get a **Regenerate with AI** button to rerun all agents live.

### Demo mode
* **No key** → *demo mode* (yellow banner). The seeded course uses hand-written fixtures; new uploads use rule-based heuristics; the tutor assembles answers from retrieved passages. Nothing claims an AI ran.
* **With a key** → all 10 roles call Claude with structured outputs (Pydantic schemas), adaptive thinking (default on Opus 5.5), per-role effort, and the server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`).

## RAG

`backend/app/retrieval/` — chunks keep page/slide provenance and a short citation ref (`S12`).
Hybrid retrieval in PostgreSQL: full-text (`tsvector`, `simple` config, GIN index) **+** dense vectors (pgvector HNSW, cosine) fused with **Reciprocal Rank Fusion**. Queries are always scoped to course ids the user is authorised to read. Embeddings: offline char-n-gram hashing by default (works for French/Arabic/Arabizi, no download); set `EMBEDDINGS_PROVIDER=fastembed` (+ `pip install fastembed`) for multilingual MiniLM.
The tutor (Sam) only answers from retrieved passages; any citation the model returns that was not retrieved is dropped, and "not in your course" is shown when retrieval finds nothing.

## Prompt caching (three layers)

1. **Claude prompt cache** (`app/llm/provider.py`). Prompts are laid out stable-first: `system[0]` shared policy → `system[1]` **whole course corpus** with a `cache_control` breakpoint → role task/language in `messages`. Clara writes the cache; Quinn, Alex, Sage, Max and Riley (run in parallel afterwards) read the same byte-identical prefix. The tutor caches `policy + role + course outline`, and uses top-level automatic caching for the growing conversation. History replays the exact bytes previously sent and moves in 20-turn windows so the cached prefix is not invalidated each turn. Language/mode/time never appear before a breakpoint.
2. **Application response cache** — validated outputs stored in `llm_response_cache` keyed by SHA-256 of the full request; identical re-runs cost nothing.
3. **Client cache** — TanStack Query with long `staleTime` for immutable course data (structure, revision, topic map), polling only for workflow status.

Every call logs cache read/write tokens to `llm_calls`; see `GET /api/system/llm-stats`. `tests/test_prompt_caching.py` asserts the request layout with a fake SDK client.

## Architecture

`React UI → FastAPI (cookie session, CSRF header, rate limits) → Jordan (plain-code coordinator, persisted tasks/events, bounded retries) → specialist roles → Riley (rule checks + AI review) → Postgres → UI (polling)`.
Roles: Jordan, Clara, Alex, Quinn, Riley, Sam, Sage, Max, Nova, Resource Finder — one model, distinct prompts/schemas; language is a parameter. Nova routes with a keyword table (4 languages) to only the relevant specialist and shows the hand-off. Plain code owns scoring, prerequisite-graph traversal (gap diagnosis), topic map, PDF export, insight aggregation, notifications.

Class insights: signals have **no user FK**; one-per-student dedupe uses `HMAC(server key, user|section)`; only the day is stored. SQL functions `insight_*` return nothing below **5 distinct students** for every breakdown and trend. Notification subscriptions live in a separate table the teacher API never reads.

See `docs/STATUS.md` for what is implemented vs deferred.
