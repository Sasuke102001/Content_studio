from pathlib import Path
from playwright.sync_api import sync_playwright

class Exporter:
    def __init__(self):
        pass

    def export_slides(self, html_file: Path, output_dir: Path, width: int, height: int, scale: float) -> list:
        output_dir.mkdir(parents=True, exist_ok=True)
        slides_captured = []

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(
                viewport={"width": width, "height": height},
                device_scale_factor=scale
            )
            
            file_url = f"file:///{html_file.resolve().as_posix()}"
            page.goto(file_url)
            
            # Wait for CDN fonts and stylesheets to load
            page.wait_for_timeout(3000)

            slides = page.query_selector_all(".slide")
            if len(slides) == 0:
                raise Exception("No .slide elements found in the HTML. Cannot export.")

            for i, slide in enumerate(slides):
                out_path = output_dir / f"slide-{i+1:02d}.png"
                slide.screenshot(path=str(out_path))
                slides_captured.append(out_path)
                
            browser.close()
            
        return slides_captured

    def export_single_slide(self, html_file: Path, slide_index: int, output_path: Path, width: int, height: int, scale: float) -> Path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(
                viewport={"width": width, "height": height},
                device_scale_factor=scale
            )
            file_url = f"file:///{html_file.resolve().as_posix()}"
            page.goto(file_url)
            page.wait_for_timeout(3000)

            slides = page.query_selector_all(".slide")
            if slide_index >= len(slides):
                raise Exception(f"Slide index {slide_index} out of range (found {len(slides)} slides)")

            slides[slide_index].screenshot(path=str(output_path))
            browser.close()

        return output_path
