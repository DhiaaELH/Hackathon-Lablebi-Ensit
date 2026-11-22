"""Headless walkthrough: load every beat of every scene and save a screenshot.

    python tools/walk.py [--lang fr] [--scenes 0,1,2] [--out walk] [--reduced] [--live]

Serves the deck folder itself (no visible browser window is ever opened).
--live: do not fast-forward, wait for the real animations (slower).
Exit code 1 when the page logged errors or a beat count does not match the text.
"""
import argparse
import functools
import http.server
import json
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    h.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="fr")
    ap.add_argument("--scenes", default="")
    ap.add_argument("--out", default="walk")
    ap.add_argument("--reduced", action="store_true")
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--size", default="1600x900")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    srv = serve()
    w, h = (int(x) for x in a.size.split("x"))
    url = f"http://127.0.0.1:{srv.server_port}/index.html?lang={a.lang}&debug=1" + ("&reduced=1" if a.reduced else "")
    errors = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        p = b.new_page(viewport={"width": w, "height": h})
        p.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") and "GPU stall" not in m.text and "GL Driver" not in m.text else None)
        p.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        p.on("requestfailed", lambda r: errors.append(f"requestfailed: {r.url}"))
        p.goto(url)
        p.wait_for_function("window.__deck && document.body.classList.contains('ready')", timeout=60000)
        counts = p.evaluate("window.__deck.counts()")
        for c in counts:
            if c["beats"] != c["text"]:
                errors.append(f"beat mismatch in {c['id']}: {c['beats']} beats vs {c['text']} text entries")
        want = [int(x) for x in a.scenes.split(",") if x != ""] or list(range(len(counts)))
        report = []
        for si in want:
            for bi in range(counts[si]["beats"]):
                if a.live:
                    p.evaluate(f"window.__deck.goto({si},{bi},{'true' if bi == 0 else 'false'})")
                    p.wait_for_timeout(4200)
                else:
                    p.evaluate(f"window.__deck.goto({si},{bi},true); window.__deck.settle()")
                    p.wait_for_timeout(1900)
                info = p.evaluate("window.__deck.info()")
                p.screenshot(path=str(out / f"{si:02d}-{bi}-{counts[si]['id']}.png"))
                report.append(info)
                print(f"{si}-{bi} {info['id']:10s} calls={info['calls']:3d} tris={info['tris']}", flush=True)
        (out / "report.json").write_text(json.dumps({"counts": counts, "beats": report, "errors": errors}, indent=1))
        b.close()
    for e in errors:
        print("ERR", e[:300])
    print("errors:", len(errors))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
