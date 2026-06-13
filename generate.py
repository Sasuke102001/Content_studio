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
# TEMPLATE PATH
# =========================================================

template_path = r"D:\PolyNovea\AI kimi\Carousel\templates\Polynovea_Client_Capability_Overview.pdf"

# =========================================================
# LOAD CONTEXT FILES
# =========================================================

master_context = load_file(
    r"context\Polynovea_Master_Operating_Document_FINAL.md"
)

visual_system = load_file(
    r"context\polynovea_brand_visual_and_content_system_v_1.md"
)

# =========================================================
# LOAD PROMPTS
# =========================================================

capability_prompt = load_file(
    r"prompts\capability_doc_prompt.txt"
)

html_request = load_file(
    r"prompts\html_request.txt"
)

# =========================================================
# SYSTEM PROMPT
# =========================================================

system_prompt = """
You are an elite editorial presentation designer and cinematic information architect.

You specialize in:
- premium intelligence systems
- editorial visual storytelling
- high-end strategic presentations
- cinematic operational documents
- asymmetrical layout systems
- advanced composition structures

Your layouts must feel:
- art directed
- compositionally intentional
- spatially balanced
- visually layered
- premium
- editorial
- cinematic

Avoid:
- generic slides
- top-heavy layouts
- empty lower canvas regions
- repetitive composition
- PowerPoint aesthetics
- startup deck visuals

Every scene should feel:
designed,
not generated.
"""

# =========================================================
# USER PROMPT
# =========================================================

user_prompt = f"""
==================================================
REFERENCE TEMPLATE
==================================================

REFERENCE TEMPLATE PATH:

{template_path}

Use this reference presentation as the PRIMARY structural and compositional guide.

Match:
- information density
- editorial pacing
- hierarchy rhythm
- layout sophistication
- typography balance
- annotation structure
- spacing behavior
- operational document feel
- page composition quality

The generated document should feel visually aligned with the reference presentation while adapting layouts dynamically to the new content.

Do NOT:
- duplicate layouts exactly
- create repetitive templates
- create identical pages

Use the template as:
a visual systems archetype.

==================================================
MASTER OPERATING CONTEXT
==================================================

{master_context}

==================================================
PRESENTATION VISUAL SYSTEM
==================================================

{visual_system}

==================================================
CAPABILITY DOCUMENT INSTRUCTIONS
==================================================

{capability_prompt}

==================================================
HTML GENERATION RULES
==================================================

{html_request}

==================================================
IMPORTANT OUTPUT RULES
==================================================

Generate:
- 14 to 18 vertical editorial pages
- 1080 × 1350 page layouts
- complete HTML document
- export-friendly structure
- layered operational layouts
- restrained premium compositions

Every page MUST:
- use class="slide"
- remain visible simultaneously
- support PNG export workflows

The layouts should feel:
- editorial
- operational
- behaviorally intelligent
- structured
- observational
- commercially mature

Avoid:
- startup aesthetics
- cinematic emptiness
- giant floating headlines
- sparse layouts
- dashboard grids
- repetitive equal-width cards
- keynote-style hero slides

IMPORTANT:

The HTML document MUST be fully complete.

Ensure:
- opening <body> exists
- closing </body> exists
- closing </html> exists
- all slides are properly closed
- no truncated output

Return ONLY production-ready HTML.

Do NOT:
- explain anything
- use markdown
- use code fences
- add commentary
"""

# =========================================================
# DEBUG
# =========================================================

print("\nPROMPT SIZE:")
print(len(user_prompt))

# =========================================================
# NVIDIA REQUEST
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

print("\nSTATUS:", response.status_code)
print("CONTENT TYPE:", response.headers.get("Content-Type"))

if response.status_code != 200:
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
    raise Exception(
        "HTML generation incomplete: missing <body>"
    )

if "</body>" not in html_output:
    raise Exception(
        "HTML generation incomplete: missing </body>"
    )

if "</html>" not in html_output:
    raise Exception(
        "HTML generation incomplete: missing </html>"
    )

# =========================================================
# SAVE OUTPUT
# =========================================================

output_dir = Path("outputs/html")
output_dir.mkdir(parents=True, exist_ok=True)

output_file = output_dir / "polynovea_capability_document.html"

with open(output_file, "w", encoding="utf-8") as f:
    f.write(html_output)

# =========================================================
# SUCCESS
# =========================================================

print("\nHTML GENERATED SUCCESSFULLY")
print(f"Saved to: {output_file}")