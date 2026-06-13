from playwright.sync_api import sync_playwright
from pathlib import Path

# =========================================================
# CONFIG — change this per post
# =========================================================

POST_ID = "post_01"

# =========================================================
# PATHS
# =========================================================

ROOT       = Path(__file__).parent.parent
OUTPUT_DIR = ROOT / "outputs" / "personal" / POST_ID
HTML_FILE  = OUTPUT_DIR / "carousel.html"
SLIDES_DIR = OUTPUT_DIR / "slides"
SLIDES_DIR.mkdir(parents=True, exist_ok=True)

if not HTML_FILE.exists():
    raise FileNotFoundError(
        f"carousel.html not found at: {HTML_FILE}\n"
        f"Run generate.py first with POST_ID='{POST_ID}'"
    )

# Instagram 4:5 → 1080×1350px output
SLIDE_W, SLIDE_H = 420, 525
SCALE = 1080 / 420

# =========================================================
# EXPORT
# =========================================================

print(f"\nEXPORTING: Personal | @subrojitroy | {POST_ID}")
print(f"Output resolution: 1080×1350px per slide")

with sync_playwright() as p:

    browser = p.chromium.launch()

    page = browser.new_page(
        viewport={"width": SLIDE_W, "height": SLIDE_H},
        device_scale_factor=SCALE
    )

    file_url = f"file:///{HTML_FILE.resolve().as_posix()}"
    page.goto(file_url)
    page.wait_for_timeout(3000)

    slides = page.query_selector_all(".slide")
    print(f"Found {len(slides)} slides\n")

    if len(slides) == 0:
        raise Exception("No .slide elements found — check the generated HTML")

    for i, slide in enumerate(slides):
        out = SLIDES_DIR / f"slide-{i+1:02d}.png"
        slide.screenshot(path=str(out))
        print(f"  slide-{i+1:02d}.png")

    browser.close()

print(f"\nExport complete.")
print(f"Saved to: {SLIDES_DIR}")
