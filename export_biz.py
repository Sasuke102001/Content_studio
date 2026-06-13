from playwright.sync_api import sync_playwright
import os

POST_ID = "post_01"

HTML_FILE = f"outputs/html/biz_page/{POST_ID}_carousel.html"
OUTPUT_DIR = f"outputs/exported/biz_page/{POST_ID}"

os.makedirs(OUTPUT_DIR, exist_ok=True)

if not os.path.exists(HTML_FILE):
    raise FileNotFoundError(
        f"HTML file not found: {HTML_FILE}\n"
        f"Run generate_biz.py first to generate the carousel."
    )

with sync_playwright() as p:

    browser = p.chromium.launch()

    # device_scale_factor scales 420px layout → 1080px output (Instagram resolution)
    page = browser.new_page(
        viewport={
            "width": 420,
            "height": 525
        },
        device_scale_factor=1080/420
    )

    file_url = f"file:///{os.path.abspath(HTML_FILE).replace(os.sep, '/')}"

    page.goto(file_url)

    page.wait_for_timeout(3000)

    slides = page.query_selector_all(".slide")

    print(f"Found {len(slides)} slides")

    if len(slides) == 0:
        raise Exception("No .slide elements found in HTML")

    for i, slide in enumerate(slides):

        slide.screenshot(
            path=f"{OUTPUT_DIR}/slide-{i+1}.png"
        )

        print(f"Exported: slide-{i+1}.png")

    browser.close()

print(f"\nPNG export complete.")
print(f"Saved to: {OUTPUT_DIR}/")
