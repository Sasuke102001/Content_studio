from playwright.sync_api import sync_playwright
import os

POST_ID = "post_01"

HTML_FILE = f"outputs/html/biz_page/{POST_ID}_linkedin_carousel.html"
OUTPUT_DIR = f"outputs/exported/biz_page/{POST_ID}_linkedin"

os.makedirs(OUTPUT_DIR, exist_ok=True)

if not os.path.exists(HTML_FILE):
    raise FileNotFoundError(
        f"HTML file not found: {HTML_FILE}\n"
        f"Run generate_biz_linkedin.py first."
    )

# LinkedIn square slides: 540px design width → 1080px output
# device_scale_factor = 1080 / 540 = 2.0
SCALE = 1080 / 540

with sync_playwright() as p:

    browser = p.chromium.launch()

    page = browser.new_page(
        viewport={"width": 540, "height": 540},
        device_scale_factor=SCALE
    )

    file_url = f"file:///{os.path.abspath(HTML_FILE).replace(os.sep, '/')}"

    page.goto(file_url)
    page.wait_for_timeout(3000)

    slides = page.query_selector_all(".slide")

    print(f"Found {len(slides)} slides")

    if len(slides) == 0:
        raise Exception("No .slide elements found in HTML")

    for i, slide in enumerate(slides):
        slide.screenshot(path=f"{OUTPUT_DIR}/slide-{i+1}.png")
        print(f"Exported: slide-{i+1}.png  →  1080×1080px")

    browser.close()

print(f"\nExport complete. Saved to: {OUTPUT_DIR}/")
