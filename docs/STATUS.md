# Implementation status

## Implemented and tested (Phase 1 + core of Phase 2)
- Auth: register/login/logout (bcrypt, JWT in httpOnly SameSite cookie), CSRF header, rate limits, generic login errors + timing equalisation, teacher invite code, profile/preferences, data export, account deletion.
- Courses: create (private by default), paste text, upload PDF/PPTX/TXT/MD/PNG/JPG with size, extension and magic-byte checks, private storage path, rights confirmation, scanned-page detection, opt-in publish with an exact "what becomes visible" preview, library search, enroll.
- RAG: page-aware chunking, hybrid FTS + pgvector + RRF, access-scoped.
- Agents/workflow: Jordan DAG (Clara → Quinn/Alex/Sage/Max in parallel → Riley), persisted tasks/events/envelopes, bounded retries, failure states; cycle-safe prerequisite graph; topic map.
- Learning: structured course with citations, exercises, chapter quizzes, mock exam (answer key hidden until submission), scoring, misconception feedback, prerequisite-gap diagnosis with evidence, mini-lesson, Socratic/hint 1-3/answer/alternate/explain-my-mistake tutor, revision summaries, flashcards, PDF sheet, progress and concept trends, chapter completion criteria, applied projects (locked until completion; save/start/complete/dismiss).
- Community: chapter threads, replies, upvotes, accepted answer, tutor/teacher badges, "this chapter is hard" (1 per student), reports.
- Class insights: anonymous signals with reason chips, N≥5 suppression on heatmap/reasons/trend/hard votes/most-missed questions, teacher responses, opt-in notifications.
- i18n: FR/EN/MSA/Derja UI with RTL; target language passed to every role; Derja Arabic or Arabizi script setting.

## Not verified here
- No real Claude call was made in development (no API key in this environment). The request shape is covered by tests with a fake client; run once with a key and check `/api/system/llm-stats`.
- The UI was type-checked, built and smoke-tested over HTTP but not visually reviewed in a browser.

## Deferred (schema already present, API/UI not built)
- Social: public user search, follow/unfollow, DMs, block (tables `follows`, `blocks`, `conversations`, `messages`).
- Recommendations panel (tables `recommendations`, `recommendation_feedback`) — planned as a transparent content-based ranker.
- Shared student resources + ratings, glossary UI (terms are seeded and stored), exam archive + corrections, "verified by students" flow, senior-student de-identified queue, moderation console.
- Resource Finder: honest "not configured" state only; no search adapter yet.
- OCR requires `pytesseract` + the tesseract binary; YouTube ingestion, study groups, spaced repetition, audio summaries.
- Row-level security: authorization is enforced in the API layer (`app/security.py`); Postgres RLS policies are not configured yet.
