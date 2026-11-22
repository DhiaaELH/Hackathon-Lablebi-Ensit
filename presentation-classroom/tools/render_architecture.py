"""Render the full-screen sheets (tools/architecture.html, tools/business.html) to shots/<name>-fr.webp and -en.webp (headless)."""
import io
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    p = b.new_page(viewport={"width": 1600, "height": 1000})
    for name in ("architecture", "business"):
      for lang in ("fr", "en"):
        p.goto((HERE / f"{name}.html").as_uri() + f"?lang={lang}")
        p.wait_for_load_state("networkidle")
        p.evaluate("document.fonts.ready")
        p.wait_for_timeout(600)
        img = Image.open(io.BytesIO(p.screenshot())).convert("RGB")
        img.save(HERE.parent / "shots" / f"{name}-{lang}.webp", "WEBP", quality=88, method=6)
        print("rendered", name, lang)
    b.close()
