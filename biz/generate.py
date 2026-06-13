import requests
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# =========================================================
# CONFIG — change these two lines per post
# =========================================================

POST_ID  = "post_01"
PLATFORM = "linkedin"    # "instagram" or "linkedin"

# =========================================================
# SETUP
# =========================================================

ROOT = Path(__file__).parent.parent
load_dotenv(dotenv_path=ROOT / ".env")

api_key = os.getenv("NVIDIA_API_KEY")
if not api_key:
    raise ValueError("NVIDIA_API_KEY not found in .env")

def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()

# =========================================================
# PATHS
# =========================================================

PROMPTS_DIR = Path(__file__).parent / "prompts" / POST_ID / PLATFORM
OUTPUT_DIR  = ROOT / "outputs" / "biz" / POST_ID / PLATFORM
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

carousel_request = load(PROMPTS_DIR / "carousel_request.txt")
html_request     = load(PROMPTS_DIR / "html_request.txt")
visual_system    = load(ROOT / "context" / "polynovea_brand_visual_and_content_system_v_1.md")

# =========================================================
# PLATFORM SETTINGS
# =========================================================

if PLATFORM == "instagram":
    slide_spec = "6 slides, 420×525px per slide (4:5 ratio)"
elif PLATFORM == "linkedin":
    slide_spec = "7 slides, 540×540px per slide (1:1 square ratio)"
else:
    raise ValueError(f"Unknown platform: {PLATFORM}. Use 'instagram' or 'linkedin'.")

# =========================================================
# PROMPTS
# =========================================================

system_prompt = f"""
You are an elite {PLATFORM.capitalize()} carousel designer and institutional content architect
for premium company brand pages.

Your carousels must feel:
- institutionally authoritative
- visually premium and editorial
- analytically structured
- readable at mobile and desktop size

Avoid:
- startup aesthetics
- generic corporate templates
- decorative clutter
- weak typography hierarchy
- motivational or hype language

Every slide should feel designed with intent, not assembled from templates.
"""

user_prompt = f"""
==================================================
BRAND VISUAL SYSTEM
==================================================

{visual_system}

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

Platform: {PLATFORM.upper()}
Slides: {slide_spec}

- All slides use class="slide"
- All slides stacked vertically in one HTML document
- HTML must be fully complete (opening and closing html, head, body tags)
- No truncation — all slides must be rendered

Return ONLY production-ready HTML.
No markdown. No code fences. No commentary outside the HTML.
"""

# =========================================================
# REQUEST
# =========================================================

print(f"\nGENERATING: Polynovea Biz | {PLATFORM.upper()} | {POST_ID}")
print(f"PROMPT SIZE: {len(user_prompt)} chars")

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
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt}
        ],
        "temperature": 0.6,
        "max_tokens": 8000,
        "stream": True
    },
    timeout=600,
    stream=True
)

print(f"STATUS: {response.status_code}")

if response.status_code != 200:
    print(f"ERROR: {response.text}")
    raise Exception(f"API failed: {response.status_code}")

# =========================================================
# STREAM
# =========================================================

full_response = ""
print("\nGENERATING...\n")

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

print("\n\nGENERATION COMPLETE")

# =========================================================
# VALIDATE & SAVE
# =========================================================

html = full_response.replace("```html", "").replace("```", "").strip()

if not html:
    raise Exception("Model returned empty output")
for tag in ["<body", "</body>", "</html>"]:
    if tag not in html:
        raise Exception(f"HTML incomplete: missing {tag}")

output_file = OUTPUT_DIR / "carousel.html"
output_file.write_text(html, encoding="utf-8")

print(f"\nSaved to: {output_file}")
