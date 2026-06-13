import requests
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# =========================================================
# LOAD ENV
# =========================================================

load_dotenv(dotenv_path=".env")

api_key = os.getenv("NVIDIA_API_KEY")

if not api_key:
    raise ValueError("NVIDIA_API_KEY not found")

# =========================================================
# HELPER FUNCTION
# =========================================================

def load_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()

# =========================================================
# CONFIG — change post number here to generate other posts
# =========================================================

POST_ID = "post_01"

# =========================================================
# LOAD CONTEXT FILES
# =========================================================

visual_system = load_file(
    r"context\polynovea_brand_visual_and_content_system_v_1.md"
)

# =========================================================
# LOAD PROMPTS
# =========================================================

carousel_request = load_file(
    rf"prompts\biz_page\{POST_ID}_carousel_request.txt"
)

html_request = load_file(
    rf"prompts\biz_page\{POST_ID}_html_request.txt"
)

# =========================================================
# SYSTEM PROMPT
# =========================================================

system_prompt = """
You are an elite Instagram carousel designer and editorial content architect.

You specialize in:
- premium brand identity carousels
- institutional company content
- editorial visual systems for social media
- structured argument carousels
- high-signal, low-noise slide design

Your carousels must feel:
- institutionally confident
- visually premium
- editorially structured
- compositionally intentional
- readable at phone size

Avoid:
- startup aesthetics
- generic social media templates
- decorative clutter
- weak typography hierarchy
- motivational or hype language

Every slide should feel:
designed with intent,
not assembled from templates.
"""

# =========================================================
# USER PROMPT
# =========================================================

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
IMPORTANT OUTPUT RULES
==================================================

Generate:
- exactly 6 Instagram carousel slides
- 420px wide × 525px tall per slide (4:5 ratio)
- all slides in a single complete HTML document
- each slide uses class="slide"
- all slides visible simultaneously (stacked vertically for screenshot export)

Every slide MUST:
- be 420px × 525px
- contain an eyebrow label
- contain a headline
- contain body copy or structural visual element
- contain progress dots at the bottom showing current slide position
- have 36px padding on all sides

The HTML document MUST be fully complete.

Ensure:
- opening <html> and <body> exist
- closing </body> and </html> exist
- all 6 slides are rendered
- no truncated output

Return ONLY production-ready HTML.

Do NOT:
- explain anything
- use markdown
- use code fences
- add any commentary outside the HTML
"""

# =========================================================
# DEBUG
# =========================================================

print(f"\nGENERATING: Polynovea Biz — {POST_ID}")
print(f"PROMPT SIZE: {len(user_prompt)} chars")

# =========================================================
# NVIDIA / KIMI REQUEST
# =========================================================

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

payload = {
    "model": "moonshotai/kimi-k2.6",
    "messages": [
        {
            "role": "system",
            "content": system_prompt
        },
        {
            "role": "user",
            "content": user_prompt
        }
    ],
    "temperature": 0.6,
    "max_tokens": 8000,
    "stream": True
}

# =========================================================
# SEND REQUEST
# =========================================================

response = requests.post(
    invoke_url,
    headers=headers,
    json=payload,
    timeout=600,
    stream=True
)

print(f"\nSTATUS: {response.status_code}")
print(f"CONTENT TYPE: {response.headers.get('Content-Type')}")

if response.status_code != 200:
    print(f"RESPONSE BODY: {response.text}")
    raise Exception(
        f"API request failed with status {response.status_code}"
    )

# =========================================================
# STREAM RESPONSE
# =========================================================

full_response = ""

print("\nGENERATING HTML...\n")

for line in response.iter_lines():

    if line:

        decoded_line = line.decode("utf-8")

        if decoded_line.startswith("data: "):

            data_str = decoded_line[6:]

            if data_str == "[DONE]":
                break

            try:

                json_data = json.loads(data_str)

                delta = (
                    json_data["choices"][0]
                    .get("delta", {})
                    .get("content", "")
                )

                if delta:
                    print(delta, end="", flush=True)
                    full_response += delta

            except Exception:
                pass

print("\n\nGENERATION COMPLETE")

# =========================================================
# CLEAN OUTPUT
# =========================================================

html_output = (
    full_response
    .replace("```html", "")
    .replace("```", "")
    .strip()
)

if not html_output:
    raise Exception("Model returned empty HTML output")

# =========================================================
# VALIDATE HTML
# =========================================================

if "<body" not in html_output:
    raise Exception("HTML generation incomplete: missing <body>")

if "</body>" not in html_output:
    raise Exception("HTML generation incomplete: missing </body>")

if "</html>" not in html_output:
    raise Exception("HTML generation incomplete: missing </html>")

# =========================================================
# SAVE OUTPUT
# =========================================================

output_dir = Path("outputs/html/biz_page")
output_dir.mkdir(parents=True, exist_ok=True)

output_file = output_dir / f"{POST_ID}_carousel.html"

with open(output_file, "w", encoding="utf-8") as f:
    f.write(html_output)

# =========================================================
# SUCCESS
# =========================================================

print(f"\nHTML GENERATED SUCCESSFULLY")
print(f"Saved to: {output_file}")
