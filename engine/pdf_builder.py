import img2pdf
from pathlib import Path

class PDFBuilder:
    def __init__(self):
        pass

    def build_pdf(self, png_slides: list, output_pdf_path: Path) -> Path:
        if not png_slides:
            raise ValueError("No slides provided to build PDF.")

        # Sort paths to guarantee sequential order (slide-01, slide-02...)
        sorted_slides = sorted(png_slides, key=lambda p: p.name)

        with open(output_pdf_path, "wb") as f:
            f.write(img2pdf.convert([str(s) for s in sorted_slides]))

        return output_pdf_path
