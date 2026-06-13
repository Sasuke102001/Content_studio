import img2pdf
from pathlib import Path

# =========================================================
# CONFIG
# =========================================================

POST_ID  = "post_01"
PLATFORM = "linkedin"

PDF_NAME = "Polynovea — What This Company Actually Is.pdf"

# =========================================================
# PATHS
# =========================================================

ROOT       = Path(__file__).parent.parent
SLIDES_DIR = ROOT / "outputs" / "biz" / POST_ID / PLATFORM / "slides"
OUTPUT_PDF = ROOT / "outputs" / "biz" / POST_ID / PLATFORM / PDF_NAME

slides = sorted(SLIDES_DIR.glob("slide-*.png"))

if not slides:
    raise FileNotFoundError(
        f"No slides found in: {SLIDES_DIR}\n"
        f"Run export.py first."
    )

# =========================================================
# BUILD PDF — zero margins, exact image dimensions
# =========================================================

print(f"\nBuilding PDF from {len(slides)} slides...")

for s in slides:
    print(f"  {s.name}")

with open(OUTPUT_PDF, "wb") as f:
    f.write(img2pdf.convert([str(s) for s in slides]))

print(f"\nPDF saved to: {OUTPUT_PDF}")
