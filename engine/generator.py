import re
from pathlib import Path
from engine.api_clients.kimi_client import KimiClient

# Matches a fenced code block wrapping the entire response, e.g.
# ```html\n...\n``` or ```json\n...\n```
_FENCE_RE = re.compile(r"^```[a-zA-Z]*\n(.*)\n```$", re.DOTALL)


def _strip_code_fences(text: str) -> str:
    """Strip a single leading/trailing code fence wrapping the whole response,
    without touching fence-like text that may appear inside the content itself."""
    stripped = text.strip()
    match = _FENCE_RE.match(stripped)
    return match.group(1).strip() if match else stripped


class Generator:
    def __init__(self, client: KimiClient, root_dir: Path):
        self.client = client
        self.root = root_dir

    def generate_content(
        self,
        system_prompt: str,
        mode: str,
        approved_plan: str,
        html_rules: str,
        slide_spec: str,
        style_context: str = "",
        stream_callback=None
    ) -> str:
        # Load brand visual system context
        visual_system_path = self.root / "context" / "polynovea_brand_visual_and_content_system_v_1.md"
        visual_system = visual_system_path.read_text(encoding="utf-8").strip()

        # Load extra contexts depending on mode (e.g. personal voice guidelines)
        if mode == "personal":
            personal_voice = (self.root / "context" / "roys-personal-voice.md").read_text(encoding="utf-8").strip()
            carousel_context = (self.root / "context" / "carousel-content-context.md").read_text(encoding="utf-8").strip()
            extra_context = f"\n{personal_voice}\n\n{carousel_context}"
        else:
            extra_context = ""

        if mode == "blog":
            # Blog mode does not need HTML/slide rules
            user_prompt = f"""
==================================================
BRAND WRITING SYSTEM AND OPERATING CONTEXT
==================================================
{visual_system}

==================================================
APPROVED EDITORIAL PLAN / BRIEF
==================================================
{approved_plan}

==================================================
DESIGN SYSTEM SELECTION
==================================================
{style_context or "Use the default Polynovea brand system."}

==================================================
CRITICAL TASK
==================================================
Generate a complete, high-quality, professional blog draft based on the approved plan.
Include a headline, introduction (with a strong hook and thesis), subheaded sections matching the plan structure, and a clear call-to-action (CTA).
At the end of the post, propose 1-2 creative image descriptions/prompts for use in visual graphics.

Return ONLY the complete blog post draft. No code block fences. No conversational commentary.
"""
        elif mode == "reel":
            # Reel mode generates a JSON scene script for the Remotion motion renderer
            user_prompt = f"""
==================================================
BRAND VISUAL SYSTEM
==================================================
{visual_system}

==================================================
APPROVED REEL PLAN / BRIEF
==================================================
{approved_plan}

==================================================
CRITICAL TASK
==================================================
Generate a single JSON "scene script" object for the approved reel plan, following the
schema and rules provided in your system instructions exactly.

Return ONLY the JSON object. No markdown. No code fences. No commentary.
"""
        else:
            # Carousel modes generate HTML
            user_prompt = f"""
==================================================
BRAND VISUAL SYSTEM
==================================================
{visual_system}
{extra_context}

==================================================
APPROVED CAROUSEL CONTENT PLAN
==================================================
{approved_plan}

==================================================
DESIGN SYSTEM SELECTION
==================================================
{style_context or "Use the default Polynovea brand system."}

==================================================
HTML GENERATION RULES
==================================================
{html_rules}

==================================================
CRITICAL OUTPUT RULES
==================================================
Slides: {slide_spec}
- All slides use class="slide"
- All slides stacked vertically in one complete HTML document
- No truncation; all slides rendered

Return ONLY production-ready HTML. No markdown. No code fences. No commentary.
"""

        response = self.client.generate_completion(system_prompt, user_prompt, stream_callback)
        return _strip_code_fences(response)
