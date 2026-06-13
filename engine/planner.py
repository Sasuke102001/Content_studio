from engine.api_clients.kimi_client import KimiClient

class Planner:
    def __init__(self, client: KimiClient):
        self.client = client

    def generate_plan(
        self,
        system_prompt: str,
        mode: str,
        direction: str,
        context: str,
        slide_spec: str,
        style_context: str = "",
        stream_callback=None
    ) -> str:
        user_prompt = f"""
==================================================
TARGET PLATFORM MODE: {mode.upper()}
==================================================
SLIDE LIMIT RULES: {slide_spec}

==================================================
DESIGN SYSTEM SELECTION
==================================================
{style_context or "Use the default Polynovea brand system."}

==================================================
USER DIRECTION
==================================================
{direction}

==================================================
BUSINESS CONTEXT & TARGETS
==================================================
{context or "None provided."}

==================================================
CRITICAL TASK
==================================================
{self._task_instructions(mode)}
Return ONLY structured Markdown planning text. No commentary or markdown code block fences.
"""

        return self.client.generate_completion(system_prompt, user_prompt, stream_callback)

    @staticmethod
    def _task_instructions(mode: str) -> str:
        if mode == "reel":
            return (
                "Plan 3-7 scene beats for a short vertical motion reel, as described in your "
                "system instructions: an overall title, eyebrow label, total duration, and for "
                "each beat its argument, frame range, dominant surface, supporting surfaces, "
                "and key text content."
            )

        if mode == "blog":
            return (
                "Generate a strong proposed outline detailing a title, thesis, section outline, "
                "and image needs."
            )

        return (
            "Generate a strong proposed outline detailing:\n"
            "1. Hook (Slide 1)\n"
            "2. Angle & Core Thesis\n"
            "3. Audience profile\n"
            "4. Slide-by-slide layout & copy structure (Slides 1 to N)\n"
            "5. Tone guidelines\n"
            "6. Call-to-action (CTA)"
        )
