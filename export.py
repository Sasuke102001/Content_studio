from playwright.sync_api import sync_playwright
import os

HTML_FILE = "outputs/html/polynovea_capability_document.html"
OUTPUT_DIR = "outputs/exported"

os.makedirs(OUTPUT_DIR, exist_ok=True)

with sync_playwright() as p:

    browser = p.chromium.launch()

    page = browser.new_page(
        viewport={
            "width": 1920,
            "height": 1080
        }
    )

    file_url = f"file:///{os.path.abspath(HTML_FILE).replace(os.sep, '/')}"

    page.goto(file_url)

    page.wait_for_timeout(3000)

    slides = page.query_selector_all(".slide")

    print(f"Found {len(slides)} slides")

    if len(slides) == 0:
        raise Exception(
            "No .slide elements found in HTML"
        )

    for i, slide in enumerate(slides):

        slide.screenshot(
            path=f"{OUTPUT_DIR}/slide-{i+1}.png"
        )

        print(f"Exported slide-{i+1}.png")

    browser.close()

print("PNG export complete.")