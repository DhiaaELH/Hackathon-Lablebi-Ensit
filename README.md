<div align="center">

<img src="https://img.shields.io/badge/LessonForge-ff4d4d?style=for-the-badge&labelColor=2d2d2d&logo=bookstack&logoColor=white" alt="LessonForge" height="38" />

# Your course notes, *finally* alive.
Presentation link : https://deck.nerio.dev/#0-0


**LessonForge turns a pile of lecture PDFs into a full study space:** a structured course with citations,
real exercises with AI grading, revision packs, a topic map, a tutor that answers in **Derja, French, English or Arabic**,
and anonymous class insights that show teachers where students get stuck, **without ever exposing who**.

[![Live demo](https://img.shields.io/badge/▶_Live_demo-lablebi.nerio.dev-ff4d4d?style=flat-square)](https://lablebi.nerio.dev) [![3D pitch deck](https://img.shields.io/badge/🎬_3D_story_deck-deck.nerio.dev-2d5da1?style=flat-square)](https://deck.nerio.dev) [![Built at ENSIT](https://img.shields.io/badge/built_at-ENSIT_Hackathon-fff9c4?style=flat-square&labelColor=2d2d2d)](#-team)

![React](https://img.shields.io/badge/React_18-20232a?style=flat-square&logo=react&logoColor=61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/Postgres_16_+_pgvector-4169e1?style=flat-square&logo=postgresql&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini-8e75b2?style=flat-square&logo=googlegemini&logoColor=white) ![Claude](https://img.shields.io/badge/Claude-d97757?style=flat-square&logo=anthropic&logoColor=white)

<br />

<a href="https://lablebi.nerio.dev"><img src="docs/screenshots/hero.webp" alt="LessonForge login page: 'Your course notes, finally alive.'" width="900" /></a>

**[Try it live →](https://lablebi.nerio.dev)** · [Features](#-features) · [How it works](#-how-it-works) · [Run locally](#-run-it-locally) · [Architecture](#-under-the-hood)

</div>

---

## 🍲 Why "Lablebi"?

Lablebi is the Tunisian chickpea soup every student knows: cheap, filling, made from whatever is at hand.
LessonForge is the study version of that. Students throw in what they have (slides, scanned handouts, a YouTube lecture)
and get back something they can actually revise from, in the language they think in.

Tunisian university students juggle courses taught in French, explained in Derja, and examined under pressure.
Generic chatbots invent answers and don't know the course. Teachers can't see who is lost until the exam.
LessonForge is built around three ideas:

| | |
|---|---|
| 📚 **Grounded, not guessed** | Every answer and every generated section cites the page or slide it comes from (`S12`, `p.3`). If the course doesn't cover it, the tutor says so. |
| 🗣️ **Speaks like you do** | French, English, Arabic (RTL) and **Tunisian Derja**, switchable at any time, including the tutor. |
| 🕶️ **Private by design** | Teachers see *where* the class struggles, never *who*. Aggregates are hidden below 5 students. |

## 🚀 Try it in 10 seconds

Open **[lablebi.nerio.dev](https://lablebi.nerio.dev)** and click one of the quick-access buttons on the login page
(password `lessonforge2026`):

| Role | Account | Look at |
|---|---|---|
| 🎓 Student | `amira.benali@lessonforge.tn` | courses, practice, revision, Nova, challenges |
| 🤝 Peer tutor | `youssef.trabelsi@lessonforge.tn` | the tutor queue, community answers |
| 🧑‍🏫 Teacher | `sami.bensalah@lessonforge.tn` | class insights, roster, publishing challenges |
| 🛡️ Admin | `ines.gharbi@lessonforge.tn` | moderation, accounts, AI cost |

The data is a realistic semester of fictional students: six courses, quiz attempts, threads, challenges and study groups.

<div align="center">
  <img src="docs/screenshots/tour.gif" alt="Animated tour: library, course, Nova, practice, revision, topic map, challenges, community, teacher insights, Arabic" width="820" />
</div>

## ✨ Features

### Learn

<table>
<tr>
<td width="50%" valign="top">

**📄 Upload anything, get a course**<br />
PDF, PPTX, text, photos of handouts (OCR) or a YouTube link. Specialist AI roles build chapters, objectives,
exercises, quizzes, a mock exam and a revision pack, with a source reference on every section.

<img src="docs/screenshots/course.webp" alt="A generated course with chapters and source citations" />
</td>
<td width="50%" valign="top">

**💬 Nova, the course assistant**<br />
Ask anything about *your* course. Nova routes the question to the right specialist (tutor, quiz, revision…)
and shows the hand-off. The tutor answers only from retrieved passages: Socratic mode, hints 1 to 3, or explain-my-mistake.

<img src="docs/screenshots/nova.webp" alt="Nova side panel next to the course" />
</td>
</tr>
<tr>
<td valign="top">

**✍️ Real practice, not just MCQs**<br />
TD-style open problems with progressive hints, AI grading against a rubric, worked solutions unlocked after an attempt,
chapter quizzes, and a timed mock exam whose key stays hidden until you submit.

<img src="docs/screenshots/practice.webp" alt="Practice tab: exercises per section with progress rings" />
</td>
<td valign="top">

**🧠 Revision that sticks**<br />
Summaries, flashcards with spaced repetition (SM-2), a revision planner, read-aloud, an offline study pack and a clean PDF export
(LaTeX turned into readable math).

<img src="docs/screenshots/revision.webp" alt="Revision tab: summary, flashcards, revision mode, planner" />
</td>
</tr>
<tr>
<td valign="top">

**🗺️ Topic map**<br />
Prerequisite graph of every concept, coloured by how well *you* know it. Gaps are diagnosed by walking the graph backwards,
followed by a mini-lesson.

<img src="docs/screenshots/topic-map.webp" alt="Interactive topic map coloured by mastery" />
</td>
<td valign="top">

**📈 Progress you own**<br />
Completion criteria per chapter and per-concept trends. Your progress is private: teachers and other students can't see it.

<img src="docs/screenshots/progress.webp" alt="Progress tab with completion criteria and concept trends" />
</td>
</tr>
</table>

### Together

<table>
<tr>
<td width="50%" valign="top">

**🏆 Challenges and XP**<br />
Teachers and peer tutors publish tasks and projects with criteria. Students submit; the AI or a human grades,
XP is earned above 60%, and a leaderboard keeps it friendly (private profiles are anonymised).

<img src="docs/screenshots/challenges.webp" alt="Challenges page with levels and XP" />
</td>
<td width="50%" valign="top">

**🗨️ Community**<br />
Chapter threads with votes and accepted answers, shared resources, a multilingual glossary, study groups with exam countdowns,
DMs, follows, and a moderation console.

<img src="docs/screenshots/community.webp" alt="Community feed across all courses" />
</td>
</tr>
<tr>
<td valign="top">

**📝 Past papers**<br />
An exam archive by faculty, subject, year and session, with student corrections and a count of how often each chapter comes up.

<img src="docs/screenshots/past-papers.webp" alt="Past papers with chapter frequency" />
</td>
<td valign="top">

**📚 Library**<br />
Browse and join published courses. Course owners can publish, keep private, add material or regenerate everything with AI.

<img src="docs/screenshots/library.webp" alt="Library of published courses" />
</td>
</tr>
</table>

### Teach

<table>
<tr>
<td width="50%" valign="top">

**🔍 Class insights, anonymous by construction**<br />
A confusion map per section: vocabulary, missing prerequisite, too fast, needs an example, exercise too hard.
Signals carry **no account id**, only the day is stored, and every cell is hidden below **5 distinct students**.

<img src="docs/screenshots/insights.webp" alt="Teacher confusion map with suppressed cells" />
</td>
<td width="50%" valign="top">

**🧑‍🏫 A course is a classroom**<br />
Teachers manage the roster, add co-teachers, post announcements, and answer the de-identified questions that
peer tutors escalate.

<img src="docs/screenshots/classroom.webp" alt="Class roster on a course" />
</td>
</tr>
</table>

### Everywhere, in every language

<table>
<tr>
<td width="50%"><img src="docs/screenshots/arabic-rtl.webp" alt="The course in Arabic, right to left" /><p align="center"><sub>العربية, full right-to-left layout</sub></p></td>
<td width="50%"><img src="docs/screenshots/derja.webp" alt="The revision tab in Tunisian Derja" /><p align="center"><sub>Tunisian Derja</sub></p></td>
</tr>
</table>

<div align="center">
  <img src="docs/screenshots/mobile.webp" alt="Four phone screenshots: course, practice, revision, challenges" width="820" />
  <p><sub>Built for the phone first: 44 px touch targets, Nova as a drawer, readable 19 px base text.</sub></p>
</div>

## 🧩 How it works

```mermaid
flowchart LR
    U([📄 Upload<br/>PDF · PPTX · photo · YouTube]) --> I[Ingest<br/>OCR · chunk · embed]
    I --> J{{Jordan<br/>coordinator}}
    J --> C[Clara<br/>course structure]
    C --> Q[Quinn<br/>quizzes]
    C --> A[Alex<br/>exercises]
    C --> S[Sage<br/>revision]
    C --> M[Max<br/>mock exam]
    Q & A & S & M --> R[Riley<br/>quality check]
    R --> DB[(Postgres<br/>+ pgvector)]
    DB --> UI([🖥️ Course ready])
    UI -. question .-> N[Nova router] --> T[Sam, tutor<br/>answers from retrieved passages only]
    T -. hybrid search .-> DB
```

1. **Ingest.** Files are checked by magic bytes, stored privately, OCR'd when scanned, and split into chunks that keep their page or slide.
2. **Generate.** Jordan (plain code, persisted tasks, bounded retries) runs Clara first, then Quinn, Alex, Sage and Max in parallel on the same cached course prefix. Riley runs rule checks plus an AI review.
3. **Retrieve.** Hybrid search in Postgres: full-text (`tsvector`) **+** dense vectors (pgvector HNSW) fused with Reciprocal Rank Fusion, always scoped to courses the user may read.
4. **Answer.** The tutor only answers from what was retrieved. Any citation the model returns that wasn't retrieved is dropped.

## 🛠️ Run it locally

You need **Python 3.12** and **Node 20+**. No Docker and no API key are required: the backend starts an embedded Postgres, and without a key it runs in *demo mode*.

```bash
git clone https://github.com/DhiaaELH/Hackathon-Lablebi-Ensit.git
cd Hackathon-Lablebi-Ensit

# 1. Backend
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                    # add GEMINI_API_KEY or ANTHROPIC_API_KEY for real AI (optional)
.venv/bin/python -m app.seed --reset    # schema + a sample course
.venv/bin/uvicorn app.main:app --port 8000

# 2. Frontend (new terminal)
cd frontend && npm install && npm run dev   # → http://localhost:5173 (proxies /api to :8000)
```

Local seed accounts: `student@`, `senior@`, `teacher@`, `moderator@demo.lessonforge.local`, password `demo-password-123`
(change it with `LF_DEMO_PASSWORD` before seeding). New teacher sign-ups need `TEACHER_INVITE_CODE` (default `demo-teacher-code`).

<details>
<summary><b>Database options</b></summary>

With `DATABASE_URL` unset, the backend starts an **embedded PostgreSQL 16 + pgvector** (`pgserver`, data in `backend/.pgdata`).
For a regular server:

```bash
docker compose up -d db
# backend/.env
DATABASE_URL=postgresql+psycopg://lessonforge:lessonforge@localhost:5432/lessonforge
```
</details>

<details>
<summary><b>LLM providers: Gemini, Claude, or none</b></summary>

Put **one** key in `backend/.env` (never commit `.env`):

* `GEMINI_API_KEY=...` → Gemini (default `gemini-3.5-flash`), with automatic fallback to `GEMINI_FALLBACK_MODELS` when a model is overloaded.
* `ANTHROPIC_API_KEY=...` → Claude (`claude-opus-5-5`). With both keys, `LLM_PROVIDER=gemini|anthropic` chooses.
* **Two tiers:** `fast` (interactive tutor, default `gemini-3.5-flash-lite`, about 2 s answers) and `smart` (background generation).
  Override with `LLM_FAST=provider:model` / `LLM_SMART=provider:model`, e.g. `LLM_FAST=anthropic:claude-haiku-5-5`.
* `GET /api/system/health` shows the active provider and both tiers.

**No key → demo mode** (yellow banner): the sample course uses hand-written fixtures, new uploads use rule-based heuristics,
and the tutor assembles answers from retrieved passages. Nothing pretends an AI ran.

**With a key:** every role returns structured output (Pydantic schemas). With Claude: adaptive thinking, per-role effort, and the server-side refusal fallback.
</details>

<details>
<summary><b>Checks</b></summary>

```bash
cd frontend && npm run typecheck && npm run build
```
</details>

## 🔬 Under the hood

<details>
<summary><b>Retrieval (RAG)</b></summary>

`backend/app/retrieval/`: chunks keep page/slide provenance and a short citation ref (`S12`).
Hybrid retrieval in PostgreSQL: full-text (`tsvector`, `simple` config, GIN index) **+** dense vectors (pgvector HNSW, cosine), fused with **Reciprocal Rank Fusion**.
Queries are always scoped to course ids the user is authorised to read. Embeddings: offline char-n-gram hashing by default (works for French, Arabic and Arabizi, no download);
set `EMBEDDINGS_PROVIDER=fastembed` (+ `pip install fastembed`) for multilingual MiniLM.
</details>

<details>
<summary><b>Prompt caching, three layers</b></summary>

1. **Provider prompt cache** (`app/llm/provider.py`). Prompts are laid out stable-first: shared policy → **whole course corpus** with a cache breakpoint → role task and language.
   Clara writes the cache; Quinn, Alex, Sage, Max and Riley, run in parallel afterwards, read the same byte-identical prefix. The tutor caches policy + role + course outline,
   and the conversation history moves in 20-turn windows so the cached prefix isn't invalidated every turn.
2. **Application response cache**: validated outputs stored in `llm_response_cache`, keyed by a SHA-256 of the full request. Identical re-runs cost nothing.
3. **Client cache**: TanStack Query with long `staleTime` for immutable course data; polling only for workflow status.

Every call logs cache read/write tokens to `llm_calls` (`GET /api/system/llm-stats`); admins see the running cost in Settings.
</details>

<details>
<summary><b>Architecture and privacy</b></summary>

`React UI → FastAPI (cookie session, CSRF header, rate limits) → Jordan (coordinator, persisted tasks/events, bounded retries) → specialist roles → Riley (rule checks + AI review) → Postgres → UI (polling)`

Roles: Jordan, Clara, Alex, Quinn, Riley, Sam, Sage, Max, Nova and Resource Finder. One model, distinct prompts and schemas; language is a parameter.
Nova routes with a keyword table (4 languages) to only the relevant specialist. Plain code owns scoring, prerequisite-graph traversal, the topic map, PDF export,
insight aggregation and notifications.

**Class insights:** signals have **no user foreign key**; one-per-student dedupe uses `HMAC(server key, user|section)`; only the day is stored.
SQL functions `insight_*` return nothing below **5 distinct students** for every breakdown and trend. Notification subscriptions live in a separate table the teacher API never reads.
</details>

<details>
<summary><b>Project layout</b></summary>

```
backend/                 FastAPI app
  app/agents/            role prompts, schemas, demo fixtures
  app/api/               REST endpoints
  app/ingestion/         PDF/PPTX/OCR/YouTube readers
  app/llm/               Gemini + Claude providers, pricing
  app/retrieval/         hybrid search (FTS + pgvector + RRF)
  app/workflows/         Jordan, the coordinator
frontend/                React 18 + Vite + TanStack Query
  src/pages/             one file per screen
  src/features/          course tabs, Nova, community…
  src/i18n/              FR · EN · AR · Derja
presentation-classroom/  the 3D story deck (Three.js, no build)
docs/                    STATUS.md, screenshots
```
</details>

See [`docs/STATUS.md`](docs/STATUS.md) for what is implemented and what is still on the list.

## 🎬 The pitch, as a 3D story

The presentation is a website too: a low-poly Three.js story that follows a student and her teacher through a semester,
with the real app playing on the screens inside each scene. **[Open it at deck.nerio.dev](https://deck.nerio.dev)**,
or run it from [`presentation-classroom/`](presentation-classroom/).

## 👥 Team

Built in Tunisia during the **ENSIT Hackathon** by:

<a href="https://github.com/DhiaaELH/Hackathon-Lablebi-Ensit/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=DhiaaELH/Hackathon-Lablebi-Ensit" alt="Contributors" />
</a>

<div align="center">

### ⭐ If LessonForge would have saved your exam week, star the repo!

It helps other students find it.

[![GitHub stars](https://img.shields.io/github/stars/DhiaaELH/Hackathon-Lablebi-Ensit?style=social)](https://github.com/DhiaaELH/Hackathon-Lablebi-Ensit/stargazers)

</div>
