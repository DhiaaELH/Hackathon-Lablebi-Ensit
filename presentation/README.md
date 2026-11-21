# LessonForge Orbit — 3D presentation

An interactive deck: the ten AI agents are planets orbiting the course (Jordan, the sun), the
community is the asteroid belt, and comets show the real workflow live. It covers the full
workflow, every feature, roles, the RAG pipeline, and the business case (LLM cost levers +
an interactive cost calculator built on token counts measured from our own `llm_calls` log).

Static site: `index.html` + `styles.css` + `main.js` + `slides.js`. No build step.
Three.js `0.160.0` and fonts load from CDNs.

## Open it

```bash
cd presentation
python3 -m http.server 8765
# → http://localhost:8765
```

(ES modules need a web server — opening `index.html` directly from disk won't work.)

Online, straight from GitHub without hosting:
`https://raw.githack.com/DhiaaELH/Hackathon-Lablebi-Ensit/main/presentation/index.html`

## Controls

| Key | Action |
|---|---|
| `→` / `Space` / `PageDown` | next slide |
| `←` / `PageUp` | previous slide |
| `Home` / `End` | first / last slide |
| `E` | explore mode: drag to orbit, scroll to zoom, click a planet to open its slide |
| `F` | fullscreen |
| `P` | print → **Save as PDF** gives a one-slide-per-page handout (A4 landscape) |

EN / FR toggle at the top right. Deep links: `#5` opens slide 5.

## Editing

All text lives in `slides.js` (one object per slide, `en` + `fr`). Each slide picks a camera
(`focus` = a planet id, or a `cam` preset) and an animation (`workflow`, `rag`, `nova`, `belt`,
`insights`). Cost-calculator token constants are at the top of the calculator section in `main.js`;
prices are editable in the deck and are illustrative.
