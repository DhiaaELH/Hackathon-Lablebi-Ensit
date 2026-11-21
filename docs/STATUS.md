# Implementation status

## Implemented and tested
**Learn:** auth (cookie JWT, CSRF header, rate limits, teacher invite code, export, deletion) · course upload (PDF/PPTX/TXT/MD/images, magic-byte checks, private storage) · **OCR of scanned PDFs/photos via Gemini** · **YouTube ingestion via Gemini** · hybrid RAG (Postgres FTS + pgvector + RRF, access-scoped) · Jordan workflow (Clara → Quinn/Alex/Sage/Max in parallel → Riley) with retries · structured course with citations · exercises, quizzes, mock exam (key hidden until submission) · misconception feedback · prerequisite-gap diagnosis + mini-lesson · tutor modes (Socratic, hints 1-3, answer, alternate, explain-my-mistake) · revision summaries, flashcards, PDF · **spaced repetition (SM-2)** · **audio summaries (browser speech)** · **revision planner** · **offline study pack** · interactive topic map · progress · applied projects.

**Community:** chapter threads, votes, accepted answers, hard-chapter votes · **shared student resources + helpful ratings** · **multilingual glossary (FR/AR/Derja/EN) with tutor review, used by Riley** · **exam archive (faculty/subject/year/session) with corrections, voting and chapter-frequency counts** · **"verified by students" on AI questions (endorsements + accepted corrections, shown as community, not expert, verification)** · **study groups with chat and exam countdown** · **peer-tutor badge** · reports + **moderation console**.

**Class insights:** anonymous signals (HMAC dedupe, no user FK, day only), N≥5 suppression on every aggregate, teacher responses, opt-in notifications, hint counter by section · **senior-student de-identified queue** (≥5 students, no teacher response for 24 h).

**Social:** **opt-in user search, public profiles, follow/unfollow, private DMs with pagination, message privacy (everyone/followers/nobody), block (both directions), report**.

**Recommendations:** **transparent rule-based ranker** (weak concepts from your own quiz results, next unfinished section, interest overlap with published courses) with a reason on every item, save/dismiss/tune.

**Resource Finder:** Gemini + Google Search grounding; only links returned by the search tool are shown, each fetched and checked (public host, HTTP < 400). Needs a Gemini plan that includes search; otherwise an honest "unavailable" state.

## Verified
- 29 backend tests (pytest, real PostgreSQL 16 + pgvector) — privacy rules, thresholds, SRS, verification, moderation, etc.
- Frontend: TypeScript strict typecheck + production build; headless-Chromium walkthrough of all main screens (FR + AR/RTL) with zero runtime errors.
- Live Gemini: course generation, tutor, PDF OCR and YouTube reading were exercised with a real key. Search grounding returned "quota exceeded" on the free plan.

## Still not done
- Row-level security in Postgres (authorization is enforced in the API layer).
- Realtime push (chat and notifications poll every 5-30 s).
- Email notifications (in-app only).
- Recommendations are rules, not a trained model (by design for v1).
