"""
Polynovea Carousel Runner
=========================

Usage:

  Biz page (Instagram — default):
    python run.py --biz --post 01

  Biz page (LinkedIn):
    python run.py --biz --post 01 --linkedin

  Personal page:
    python run.py --personal --post 01

  Run only one step:
    python run.py --biz --post 01 --linkedin --generate
    python run.py --biz --post 01 --linkedin --export
    python run.py --biz --post 01 --linkedin --pdf

"""

import argparse
import sys
import os
import json
import requests
import img2pdf
from pathlib import Path
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

# =========================================================
# ARGS
# =========================================================

parser = argparse.ArgumentParser()

group = parser.add_mutually_exclusive_group(required=True)
group.add_argument("--biz",      action="store_true")
group.add_argument("--personal", action="store_true")

parser.add_argument("--post",     required=True, help="Post number e.g. 01, 02")
parser.add_argument("--linkedin", action="store_true", help="LinkedIn platform (biz only, default: instagram)")

parser.add_argument("--generate", action="store_true", help="Run generate step only")
parser.add_argument("--export",   action="store_true", help="Run export step only")
parser.add_argument("--pdf",      action="store_true", help="Run PDF step only (linkedin only)")

args = parser.parse_args()

# =========================================================
# RESOLVE CONFIG
# =========================================================

POST_ID  = f"post_{args.post.zfill(2)}"
SECTION  = "biz" if args.biz else "personal"
PLATFORM = "linkedin" if (args.biz and args.linkedin) else "instagram"

# If no step flags set, run full pipeline
step_flags = [args.generate, args.export, args.pdf]
run_all = not any(step_flags)

RUN_GENERATE = run_all or args.generate
RUN_EXPORT   = run_all or args.export
RUN_PDF      = (run_all or args.pdf) and PLATFORM == "linkedin"

ROOT = Path(__file__).parent
load_dotenv(dotenv_path=ROOT / ".env")

api_key = os.getenv("NVIDIA_API_KEY")
if not api_key:
    raise ValueError("NVIDIA_API_KEY not found in .env")

print(f"\n{'='*50}")
print(f"  POLYNOVEA CAROUSEL RUNNER")
print(f"  Section  : {SECTION.upper()}")
print(f"  Post     : {POST_ID}")
if SECTION == "biz":
    print(f"  Platform : {PLATFORM.upper()}")
print(f"{'='*50}\n")

# =========================================================
# PATHS
# =========================================================

if SECTION == "biz":
    PROMPTS_DIR = ROOT / "biz"  / "prompts" / POST_ID / PLATFORM
    OUTPUT_DIR  = ROOT / "outputs" / "biz" / POST_ID / PLATFORM
else:
    PROMPTS_DIR = ROOT / "personal" / "prompts" / POST_ID
    OUTPUT_DIR  = ROOT / "outputs" / "personal" / POST_ID

HTML_FILE  = OUTPUT_DIR / "carousel.html"
SLIDES_DIR = OUTPUT_DIR / "slides"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SLIDES_DIR.mkdir(parents=True, exist_ok=True)

# =========================================================
# HELPERS
# =========================================================

def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()

def check_prompts():
    missing = []
    for f in ["carousel_request.txt", "html_request.txt"]:
        if not (PROMPTS_DIR / f).exists():
            missing.append(str(PROMPTS_DIR / f))
    if missing:
        print("ERROR: Missing prompt files:")
        for m in missing:
            print(f"  {m}")
        sys.exit(1)

# =========================================================
# STEP 1 — GENERATE
# =========================================================

if RUN_GENERATE:
    print(f"[1/3] GENERATING HTML...\n")
    check_prompts()

    carousel_request = load(PROMPTS_DIR / "carousel_request.txt")
    html_request     = load(PROMPTS_DIR / "html_request.txt")
    visual_system    = load(ROOT / "context" / "polynovea_brand_visual_and_content_system_v_1.md")

    if SECTION == "personal":
        personal_voice   = load(ROOT / "context" / "roys-personal-voice.md")
        carousel_context = load(ROOT / "context" / "carousel-content-context.md")
        extra_context    = f"\n{personal_voice}\n\n{carousel_context}"
        slide_spec       = "5–7 slides, 420×525px per slide (4:5 ratio)"
        system_msg       = "You are an elite Instagram carousel designer for a founder's personal brand (@subrojitroy). Operator voice. Structured argument. No hype. No motivation content."
    elif PLATFORM == "instagram":
        extra_context    = ""
        slide_spec       = "6 slides, 420×525px per slide (4:5 ratio)"
        system_msg       = "You are an elite Instagram carousel designer for the Polynovea company page. Institutional voice. Premium editorial. No startup aesthetics."
    else:
        extra_context    = ""
        slide_spec       = "7 slides, 540×540px per slide (1:1 square)"
        system_msg       = "You are an elite LinkedIn carousel designer for the Polynovea company page. Institutional, analytical, premium. No startup aesthetics."

    user_prompt = f"""
==================================================
BRAND VISUAL SYSTEM
==================================================
{visual_system}
{extra_context}
==================================================
CAROUSEL CONTENT REQUEST
==================================================
{carousel_request}
==================================================
HTML GENERATION RULES
==================================================
{html_request}
==================================================
CRITICAL OUTPUT RULES
==================================================
Slides: {slide_spec}
- All slides use class="slide"
- All slides stacked vertically in one complete HTML document
- No truncation — all slides rendered
Return ONLY production-ready HTML. No markdown. No code fences. No commentary.
"""

    response = requests.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        json={
            "model": "moonshotai/kimi-k2.6",
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user",   "content": user_prompt}
            ],
            "temperature": 0.6,
            "max_tokens": 8000,
            "stream": True
        },
        timeout=600,
        stream=True
    )

    if response.status_code != 200:
        print(f"API ERROR {response.status_code}: {response.text}")
        sys.exit(1)

    full_response = ""
    for line in response.iter_lines():
        if line:
            decoded = line.decode("utf-8")
            if decoded.startswith("data: "):
                data = decoded[6:]
                if data == "[DONE]":
                    break
                try:
                    delta = json.loads(data)["choices"][0].get("delta", {}).get("content", "")
                    if delta:
                        print(delta, end="", flush=True)
                        full_response += delta
                except Exception:
                    pass

    html = full_response.replace("```html", "").replace("```", "").strip()

    for tag in ["<body", "</body>", "</html>"]:
        if tag not in html:
            print(f"\nERROR: HTML incomplete — missing {tag}")
            sys.exit(1)

    HTML_FILE.write_text(html, encoding="utf-8")
    print(f"\n\nGenerated: {HTML_FILE}\n")

# =========================================================
# STEP 2 — EXPORT PNGs
# =========================================================

if RUN_EXPORT:
    print(f"[2/3] EXPORTING PNGs...\n")

    if not HTML_FILE.exists():
        print(f"ERROR: {HTML_FILE} not found. Run --generate first.")
        sys.exit(1)

    if PLATFORM == "linkedin":
        SLIDE_W, SLIDE_H, SCALE = 540, 540, 1080/540
    else:
        SLIDE_W, SLIDE_H, SCALE = 420, 525, 1080/420

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
            print("ERROR: No .slide elements found in HTML")
            sys.exit(1)

        for i, slide in enumerate(slides):
            out = SLIDES_DIR / f"slide-{i+1:02d}.png"
            slide.screenshot(path=str(out))
            print(f"  slide-{i+1:02d}.png  →  {int(SLIDE_W*SCALE)}×{int(SLIDE_H*SCALE)}px")

        browser.close()

    print(f"\nExported to: {SLIDES_DIR}\n")

# =========================================================
# STEP 3 — BUILD PDF (LinkedIn only)
# =========================================================

if RUN_PDF:
    print(f"[3/3] BUILDING PDF...\n")

    slides = sorted(SLIDES_DIR.glob("slide-*.png"))

    if not slides:
        print(f"ERROR: No slides found in {SLIDES_DIR}. Run --export first.")
        sys.exit(1)

    pdf_name = "Polynovea — What This Company Actually Is.pdf"
    pdf_path = OUTPUT_DIR / pdf_name

    for s in slides:
        print(f"  {s.name}")

    with open(pdf_path, "wb") as f:
        f.write(img2pdf.convert([str(s) for s in slides]))

    print(f"\nPDF saved: {pdf_path}\n")

# =========================================================
# DONE
# =========================================================

print(f"{'='*50}")
print(f"  DONE — outputs/{'biz' if args.biz else 'personal'}/{POST_ID}/")
if SECTION == "biz":
    print(f"         {PLATFORM}/")
print(f"{'='*50}\n")
