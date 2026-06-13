import requests
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# =========================================================
# CONFIG — change this per post
# =========================================================

POST_ID = "post_01"

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

PROMPTS_DIR = Path(__file__).parent / "prompts" / POST_ID
OUTPUT_DIR  = ROOT / "outputs" / "personal" / POST_ID
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

carousel_request  = load(PROMPTS_DIR / "carousel_request.txt")
html_request      = load(PROMPTS_DIR / "html_request.txt")
visual_system     = load(ROOT / "context" / "polynovea_brand_visual_and_content_system_v_1.md")
personal_voice    = load(ROOT / "context" / "roys-personal-voice.md")
carousel_context  = load(ROOT / "context" / "carousel-content-context.md")

# =========================================================
# PROMPTS
# =========================================================

system_prompt = """
You are an elite Instagram and LinkedIn carousel designer for a founder's personal brand.

The founder is Subrojit Roy — systems thinker, operator, builder.

Your carousels must feel:
- analytically sharp and direct
- operator voice — not startup hype, not motivation content
- visually premium and editorial
- structured argument, not storytelling
- readable at mobile size

Avoid:
- generic founder advice ("10 lessons I learned")
- emotional storytelling ("here's my journey")
- hype language
- decorative clutter
- startup clichés

Every slide should make one point clearly and connect logically to the next.
"""

user_prompt = f"""
==================================================
BRAND VISUAL SYSTEM
==================================================

{visual_system}

==================================================
PERSONAL VOICE AND CAROUSEL STYLE
==================================================

{personal_voice}

{carousel_context}

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

Platform: INSTAGRAM (personal account @subrojitroy)
Format: 5–7 slides, 420×525px per slide (4:5 ratio)

- All slides use class="slide"
- All slides stacked vertically in one HTML document
- HTML must be fully complete
- No truncation

Return ONLY production-ready HTML.
No markdown. No code fences. No commentary.
"""

# =========================================================
# REQUEST
# =========================================================

print(f"\nGENERATING: Personal | @subrojitroy | {POST_ID}")
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
