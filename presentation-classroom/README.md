# LessonForge — A Day at School

A presentation of LessonForge told as a short low-poly 3D story. We follow a student, Yasmine, and her
teacher, Mr. Karim, through a semester: from the panic of the night before an exam to a calm last day.
Each scene explains one part of the product, and the real site appears on the screens inside the scene.

It is a static site: no build step. Three.js `0.170.0` and the fonts load from CDNs.

## Open it

```bash
cd presentation-classroom
python3 -m http.server 8080
# → http://localhost:8080
```

It does not work from `file://` (ES modules need a web server).

## Controls

| Key | Action |
|---|---|
| `→` / `Space` / `PageDown` | next step (a "beat"). On some steps the next press flies into the screen of the scene and shows the real site full-size; the press after that moves on |
| `←` / `PageUp` | previous step |
| `Home` / `End` | first / last scene |
| digits then `Enter` | jump to a scene (the number is shown top-left) |
| `L` | French / English |
| `S` | speaker notes in a second window (notes, next step, timer; arrow keys work there too) |
| `E` | explore: drag to orbit, scroll to zoom, click a screen to open it |
| `F` | fullscreen |
| `P` | print → *Save as PDF* gives a handout, one page per scene (A4 landscape) |
| `H` | help |

Deep links: `#scene-beat`, for example `#7-2`. Add `?lang=en` to start in English, `?debug` for an
FPS / draw-call counter, `?reduced` to replace camera flights with short fades (this also happens
automatically when the system asks for reduced motion).

## The scenes

| # | Scene | What it explains |
|---|---|---|
| 0 | The night before the exam | the problem; the paper towers become the logo |
| 1 | Morning, in class | who it is for, four pillars, four languages |
| 2 | Drop your course in | upload formats, OCR, videos, private storage |
| 3 | Backstage | the AI team: Jordan, Clara, Quinn/Alex/Sage/Max in parallel, Riley, Resource Finder |
| 4 | The course is ready | the course tabs |
| 5 | Where am I lost? | topic map, prerequisite-gap diagnosis, mini-lesson |
| 6 | Practice | hints, rubric grading, unlocked solution, timed quiz, mock exam |
| 7 | Nova and Sam | routing with hand-off, cited answers, "not in your course", modes, languages |
| 8 | Under the hood | pipeline, hybrid search, three caches, models, then the architecture diagram full screen |
| 9 | The same night, differently | spaced repetition, audio, planner, offline pack |
| 10 | Learning together | community, exam archive, glossary, study groups |
| 11 | Challenges | AI grading, 60% pass line, 3 attempts, XP levels, leaderboard |
| 12 | See the class, not the student | anonymous signals, the rule of five, senior queue |
| 13 | The business model | running costs in TND (measured AI tokens), plans and prices, then the cost sheet full screen |
| 14 | End of the semester | recap, QR code to the live site |

The architecture diagram (`tools/architecture.html`) and the cost sheet (`tools/business.html`) are
FR/EN pages (`?lang=en`) rendered to `shots/<name>-fr.webp` / `-en.webp` by `tools/render_architecture.py`.
The cost sheet's sources and assumptions are listed in a comment at the top of `tools/business.html`.

## Editing

- **Words** (both languages, speaker notes, scene order): `scenes.js`. One entry per beat.
  Add `dive: true` to a beat (17 beats have it) to get the extra "fly into the screen" step after it; remove it to skip.
- **A scene's 3D**: `scenes/<id>.js`. Each exports `{ place, origin, mood, build(S) }`; `build` returns
  one object per beat: `{ cam: [x,y,z, lookX,lookY,lookZ], run(S) { … }, shot, screen }`.
  The number of beats must match the entries in `scenes.js`.
- **Models**: `models/kit.js` (builder that merges primitives into one mesh, people, robots, labels,
  screens) and `models/places.js` (the classroom and the dorm room, shared by several scenes).
- Everything is built from Three.js primitives in code: there are no downloaded 3D assets.

## Screenshots of the site

The images in `shots/` are real screens of LessonForge, taken headlessly by `tools/capture.py` from a
**local demo instance** (seeded synthetic data only), so no real user ever appears in them:

```bash
# in the repo: start the app (see the main README), seeded with `python -m app.seed --reset`
pip install playwright pillow && playwright install chromium
python presentation-classroom/tools/capture.py
```

## Checking it

`tools/walk.py` loads every beat of every scene in a headless browser, saves a screenshot of each
and fails on console errors or on a beat/text mismatch:

```bash
python tools/walk.py --lang fr --out /tmp/walk
python tools/walk.py --lang en --reduced --out /tmp/walk-en
```

## Credits

- [Three.js](https://threejs.org) (MIT), loaded from jsDelivr.
- QR code: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase (MIT), vendored in `vendor/`.
- Fonts: Kalam, Patrick Hand, Atkinson Hyperlegible Next (Google Fonts, OFL).
