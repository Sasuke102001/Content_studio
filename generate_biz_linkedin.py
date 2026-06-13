import requests
import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

api_key = os.getenv("NVIDIA_API_KEY")
if not api_key:
    raise ValueError("NVIDIA_API_KEY not found")

def load_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()

POST_ID = "post_01"

visual_system = load_file(r"context\polynovea_brand_visual_and_content_system_v_1.md")
carousel_request = load_file(rf"prompts\biz_page\{POST_ID}_linkedin_carousel_request.txt")
html_request = load_file(rf"prompts\biz_page\{POST_ID}_linkedin_html_request.txt")

system_prompt = """
You are an elite LinkedIn carousel designer and institutional content architect.

You specialize in:
- premium company identity carousels for LinkedIn
- editorial visual systems for professional audiences
- structured argument carousels — not storytelling, not motivation
- high-signal, low-noise square-format slide design

Your carousels must feel:
- institutionally authoritative
- visually premium and editorial
- analytically structured
- readable at desktop and mobile size

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
IMPORTANT OUTPUT RULES
==================================================

Generate:
- exactly 7 LinkedIn carousel slides
- 540px wide × 540px tall per slide (1:1 square ratio)
- all slides in a single complete HTML document
- each slide uses class="slide"
- all slides visible simultaneously (stacked vertically for screenshot export)

Every slide MUST:
- be exactly 540px × 540px
- contain an eyebrow label (top-left) and slide counter (top-right)
- contain a headline
- contain body copy or a structural visual element
- have 40px padding on all sides

The HTML document MUST be fully complete:
- opening <html> and <body>
- all 7 slides rendered
- closing </body> and </html>
- no truncation

Return ONLY production-ready HTML. No markdown. No code fences. No commentary.
"""

print(f"\nGENERATING: Polynovea Biz LinkedIn — {POST_ID}")
print(f"PROMPT SIZE: {len(user_prompt)} chars")

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

payload = {
    "model": "moonshotai/kimi-k2.6",
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ],
    "temperature": 0.6,
    "max_tokens": 8000,
    "stream": True
}

response = requests.post(invoke_url, headers=headers, json=payload, timeout=600, stream=True)

print(f"\nSTATUS: {response.status_code}")

if response.status_code != 200:
    print(f"RESPONSE BODY: {response.text}")
    raise Exception(f"API request failed with status {response.status_code}")

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
                delta = json_data["choices"][0].get("delta", {}).get("content", "")
                if delta:
                    print(delta, end="", flush=True)
                    full_response += delta
            except Exception:
                pass

print("\n\nGENERATION COMPLETE")

html_output = full_response.replace("```html", "").replace("```", "").strip()

if not html_output:
    raise Exception("Model returned empty HTML output")
if "<body" not in html_output:
    raise Exception("HTML generation incomplete: missing <body>")
if "</body>" not in html_output:
    raise Exception("HTML generation incomplete: missing </body>")
if "</html>" not in html_output:
    raise Exception("HTML generation incomplete: missing </html>")

output_dir = Path("outputs/html/biz_page")
output_dir.mkdir(parents=True, exist_ok=True)
output_file = output_dir / f"{POST_ID}_linkedin_carousel.html"

with open(output_file, "w", encoding="utf-8") as f:
    f.write(html_output)

print(f"\nHTML GENERATED SUCCESSFULLY")
print(f"Saved to: {output_file}")
