import argparse
import sys
import json
import os
from pathlib import Path
from dotenv import load_dotenv

# Add engine directory to path to allow absolute imports
ROOT = Path(__file__).parent.parent
sys.path.append(str(ROOT))

from engine.common.logging import log_info, log_error, emit_progress
from engine.common.mode_loader import get_mode_config
from engine.common.reel_schema import validate_reel_script
from engine.api_clients.kimi_client import KimiClient
from engine.api_clients.sarvam_client import SarvamClient
from engine.planner import Planner
from engine.generator import Generator
from engine.exporter import Exporter
from engine.pdf_builder import PDFBuilder
from engine.blob_uploader import upload_training_artifact
import re

from bs4 import BeautifulSoup, NavigableString

def translate_element_text(element, sarvam_client, target_lang, style, custom_directives):
    for node in list(element.descendants):
        if isinstance(node, NavigableString):
            if node.parent and node.parent.name in ['style', 'script']:
                continue
            text = node.strip()
            # Only translate if it contains letters and is not just numbers/whitespace
            if text and any(c.isalpha() for c in text):
                # Skip social handles, links, or very short punctuation
                if text.startswith('@') or text.isdigit() or len(text) < 2:
                    continue
                
                # Translate text
                translated = sarvam_client.translate_text(text, target_lang, style, custom_directives)
                node.replace_with(translated)

def translate_html_carousel(html_content, sarvam_client, target_lang, style, cta_style, custom_directives):
    soup = BeautifulSoup(html_content, 'html.parser')
    # Find all divs containing 'slide' class
    slides = soup.find_all(class_=lambda x: x and 'slide' in x.split())
    
    if not slides:
        # No slide containers found, translate everything
        translate_element_text(soup, sarvam_client, target_lang, style, custom_directives)
    else:
        total_slides = len(slides)
        for idx, slide in enumerate(slides):
            # Determine language style for this slide
            is_last = (idx == total_slides - 1)
            slide_lang = target_lang
            # Apply CTA override if set and it's the last slide
            slide_style = cta_style if (is_last and cta_style != 'formal') else style
            
            # Translate this slide content
            translate_element_text(slide, sarvam_client, slide_lang, slide_style, custom_directives)
            
    return str(soup)


def strip_empty_placeholders(html_content: str) -> tuple:
    """Remove leaf <div>/<span> elements that have no text, no <img>/<svg>
    descendants, and no background-image/gradient/color in their inline style.
    Thin (<=3px) rule/line divs are treated as intentional structural elements
    (section separators, accent rules) and are left alone.
    Returns (cleaned_html, removed_count)."""
    soup = BeautifulSoup(html_content, 'html.parser')

    def is_thin_rule(style: str) -> bool:
        for prop in ('height', 'width'):
            match = re.search(rf'{prop}\s*:\s*([\d.]+)px', style)
            if match and float(match.group(1)) <= 3:
                return True
        return False

    def has_visual_background(style: str) -> bool:
        match = re.search(r'background(?:-image|-color)?\s*:\s*([^;]+)', style)
        if not match:
            return False
        value = match.group(1).strip().lower()
        return value not in ('', 'none', 'transparent', 'inherit')

    removed_count = 0
    changed = True
    while changed:
        changed = False
        for el in soup.find_all(['div', 'span']):
            if el.decomposed:
                # Already removed as a descendant of an element decomposed
                # earlier in this pass.
                continue
            if el.find(['svg', 'img']):
                continue
            if el.get_text(strip=True):
                continue
            style = el.get('style', '')
            if has_visual_background(style) or is_thin_rule(style):
                continue
            el.decompose()
            removed_count += 1
            changed = True

    return str(soup), removed_count


def parse_args():
    parser = argparse.ArgumentParser(description="PolyNovea Content Engine Sidecar")
    parser.add_argument("--action", required=True, choices=["plan", "generate", "export", "correct"], help="Action to execute")
    parser.add_argument("--mode", required=True, choices=["linkedin", "instagram", "threads", "blog", "personal", "reel"], help="Target platform mode")
    parser.add_argument("--project-dir", required=True, help="Absolute path to target output folder")
    parser.add_argument("--revision-id", required=True, help="UUID for the revision")
    parser.add_argument("--params-file", help="JSON file containing inputs and parameters")
    
    # Parity testing fallbacks
    parser.add_argument("--legacy-post-id", help="Post ID (e.g. post_01) for legacy folder lookup")
    parser.add_argument("--legacy-section", choices=["biz", "personal"], help="Legacy section (biz or personal)")

    return parser.parse_args()

def load_params(params_file_path: str) -> dict:
    if not params_file_path:
        return {}
    path = Path(params_file_path)
    if not path.exists():
        raise FileNotFoundError(f"Params file not found at: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def get_legacy_inputs(section: str, post_id: str, mode: str) -> tuple:
    if section == "biz":
        platform = "linkedin" if mode == "linkedin" else "instagram"
        prompts_dir = ROOT / "biz" / "prompts" / post_id / platform
    else:
        prompts_dir = ROOT / "personal" / "prompts" / post_id

    direction_file = prompts_dir / "carousel_request.txt"
    html_file = prompts_dir / "html_request.txt"

    if not direction_file.exists():
        raise FileNotFoundError(f"Legacy direction file not found at: {direction_file}")
    if not html_file.exists() and mode != "blog":
         raise FileNotFoundError(f"Legacy HTML rules file not found at: {html_file}")

    direction = direction_file.read_text(encoding="utf-8").strip()
    html_rules = html_file.read_text(encoding="utf-8").strip() if html_file.exists() else ""
    return direction, html_rules

def build_style_context(style_overrides: dict) -> str:
    if not style_overrides:
        return ""

    palette_preset = style_overrides.get("palette_preset", "brand_dark")
    font_pairing_preset = style_overrides.get("font_pairing_preset", "polynovea_default")
    heading_font = style_overrides.get("heading_font", "Clash Display")
    body_font = style_overrides.get("body_font", "Inter")
    layout_direction = style_overrides.get("layout_direction", "editorial")
    style_strength = style_overrides.get("style_strength", "balanced")
    art_direction_notes = style_overrides.get("art_direction_notes", "").strip()
    custom_palette = style_overrides.get("custom_palette")

    preset_tokens = {
        "brand_dark": {
            "bgPrimary": "#0A0A0A",
            "bgSecondary": "#121212",
            "surface": "#18181B",
            "border": "#27272A",
            "textPrimary": "#F5F5F5",
            "textSecondary": "#A1A1AA",
            "accentPrimary": "#E6D3A3",
            "accentSecondary": "#9A8F6A",
            "accentDepth": "#7C3AED"
        },
        "presentation_light": {
            "bgPrimary": "#F8F6F2",
            "bgSecondary": "#EFEAE2",
            "surface": "#FFFFFF",
            "border": "#D8D0C4",
            "textPrimary": "#0A0A0A",
            "textSecondary": "#6B7280",
            "accentPrimary": "#E6D3A3",
            "accentSecondary": "#9A8F6A",
            "accentDepth": "#7C3AED"
        }
    }

    tokens = preset_tokens.get(palette_preset, preset_tokens["brand_dark"]).copy()
    if palette_preset == "custom" and custom_palette:
        tokens.update(custom_palette)

    lines = [
        f"Palette preset: {palette_preset}.",
        f"Font pairing preset: {font_pairing_preset}.",
        f"Headings font: {heading_font}.",
        f"Body font: {body_font}.",
        f"Layout direction preset: {layout_direction}.",
        f"Style strength preset: {style_strength}.",
        "Mandatory color tokens:"
    ]
    for key, value in tokens.items():
        lines.append(f"- {key}: {value}")
    lines.extend([
        "Mandatory output rule: use these palette tokens and fonts directly in the final rendered HTML/CSS.",
        "Mandatory output rule: do not substitute different fonts or ad-hoc colors."
    ])

    if custom_palette:
        lines.append("Custom palette override was explicitly selected by the user.")
    if art_direction_notes:
        lines.append(f"Freeform art direction from user: {art_direction_notes}")
        lines.append("Mandatory output rule: honor the user's freeform art direction unless it conflicts with structural export safety.")

    return "\n".join(lines)

def build_blog_template(style_overrides: dict) -> str:
    palette_preset = style_overrides.get("palette_preset", "brand_dark")
    heading_font = style_overrides.get("heading_font", "Clash Display")
    body_font = style_overrides.get("body_font", "Inter")
    custom_palette = style_overrides.get("custom_palette") or {}

    preset_tokens = {
        "brand_dark": {
            "bgPrimary": "#0A0A0A",
            "surface": "#18181B",
            "border": "#27272A",
            "textPrimary": "#F5F5F5",
            "textSecondary": "#A1A1AA",
            "accentPrimary": "#E6D3A3",
            "accentSecondary": "#9A8F6A",
            "accentDepth": "#7C3AED"
        },
        "presentation_light": {
            "bgPrimary": "#F8F6F2",
            "surface": "#FFFFFF",
            "border": "#D8D0C4",
            "textPrimary": "#0A0A0A",
            "textSecondary": "#6B7280",
            "accentPrimary": "#E6D3A3",
            "accentSecondary": "#9A8F6A",
            "accentDepth": "#7C3AED"
        }
    }
    tokens = preset_tokens.get(palette_preset, preset_tokens["brand_dark"]).copy()
    if palette_preset == "custom":
        tokens.update(custom_palette)

    font_links_map = {
        "Inter": "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
        "Clash Display": "https://api.fontshare.com/v2/css?f[]=clash-display@300,400,500,600,700&display=swap",
        "Playfair Display": "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap",
        "Space Grotesk": "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap",
        "Cormorant Garamond": "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&display=swap",
        "Sora": "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap",
        "Manrope": "https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap"
    }
    heading_color = tokens["textPrimary"] if palette_preset == "presentation_light" else "#FFFFFF"
    font_links = []
    for font_name in [heading_font, body_font]:
        href = font_links_map.get(font_name)
        if href and href not in font_links:
            font_links.append(href)
    font_link_tags = "\n  ".join([f'<link href="{href}" rel="stylesheet">' for href in font_links])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog Post Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  {font_link_tags}
  <style>
    :root {{
      --bg-color: {tokens["bgPrimary"]};
      --text-color: {tokens["textPrimary"]};
      --accent-color: {tokens["accentDepth"]};
      --muted-color: {tokens["textSecondary"]};
      --card-bg: {tokens["surface"]};
      --border-color: {tokens["border"]};
      --gold-color: {tokens["accentPrimary"]};
      --gold-muted: {tokens["accentSecondary"]};
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background-color: var(--bg-color);
      color: var(--text-color);
      font-family: '{body_font}', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.75;
      font-size: 1.125rem;
      padding: 2rem 1rem;
      display: flex;
      justify-content: center;
    }}
    .blog-container {{ width: 100%; max-width: 760px; margin: 0 auto; }}
    h1, h2, h3, h4, h5, h6 {{
      font-family: '{heading_font}', Georgia, serif;
      font-weight: 700;
      color: {heading_color};
      line-height: 1.3;
      margin-top: 2.5rem;
      margin-bottom: 1rem;
    }}
    h1 {{ font-size: 2.5rem; margin-top: 1rem; margin-bottom: 1.5rem; letter-spacing: -0.02em; }}
    h2 {{ font-size: 1.875rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }}
    h3 {{ font-size: 1.5rem; }}
    p {{ margin-bottom: 1.5rem; font-weight: 400; }}
    a {{ color: var(--accent-color); text-decoration: none; border-bottom: 1px dashed var(--accent-color); transition: color 0.2s ease; }}
    a:hover {{ color: var(--gold-muted); border-bottom-style: solid; }}
    blockquote {{
      border-left: 4px solid var(--gold-color);
      padding: 0.5rem 0 0.5rem 1.5rem;
      margin: 2rem 0;
      font-style: italic;
      color: var(--text-color);
      background-color: var(--card-bg);
      border-top-right-radius: 6px;
      border-bottom-right-radius: 6px;
    }}
    blockquote p:last-child {{ margin-bottom: 0; }}
    pre, code {{ font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; font-size: 0.95rem; background-color: var(--card-bg); border-radius: 6px; }}
    code {{ padding: 0.2rem 0.4rem; color: var(--accent-color); }}
    pre {{ padding: 1.25rem; overflow-x: auto; border: 1px solid var(--border-color); margin: 1.5rem 0; }}
    pre code {{ padding: 0; color: inherit; background-color: transparent; border-radius: 0; }}
    ul, ol {{ margin-bottom: 1.5rem; padding-left: 1.75rem; }}
    li {{ margin-bottom: 0.5rem; }}
    img {{ max-width: 100%; height: auto; border-radius: 8px; margin: 2rem 0; border: 1px solid var(--border-color); }}
    hr {{ border: 0; border-top: 1px solid var(--border-color); margin: 3rem 0; }}
  </style>
</head>
<body>
  <article class="blog-container">
    {{blog_content}}
  </article>
</body>
</html>"""

def main():
    args = parse_args()
    
    # Initialize environment
    load_dotenv(dotenv_path=ROOT / ".env")
    
    # Ensure project directories exist
    project_dir = Path(args.project_dir)
    project_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Load parameters
        params = load_params(args.params_file)
        
        # Load API keys or Supabase proxy context
        api_keys = params.get("api_keys", {})
        nvidia_key = api_keys.get("NVIDIA_API_KEY") or os.getenv("NVIDIA_API_KEY")
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_access_token = os.getenv("SUPABASE_ACCESS_TOKEN")

        if not nvidia_key and not (supabase_url and supabase_access_token):
            log_error("AI provider access is not configured. Connect Supabase or provide a local NVIDIA_API_KEY.")
            sys.exit(2)
            
        # Initialize Kimi Client
        client = KimiClient(api_key=nvidia_key)
        
        # Load language overrides
        language_overrides = params.get("language_overrides", {})
        style_overrides = params.get("style_overrides", {})
        default_lang = language_overrides.get("default_lang", "en")
        default_style = language_overrides.get("default_style", "formal")
        cta_style = language_overrides.get("cta_style", "formal")
        custom_directives = language_overrides.get("custom_directives", "")
        style_context = build_style_context(style_overrides)
        
        sarvam_client = None
        if default_lang != "en":
            sarvam_key = api_keys.get("SARVAM_API_KEY") or os.getenv("SARVAM_API_KEY")
            if sarvam_key:
                try:
                    sarvam_client = SarvamClient(api_key=sarvam_key)
                except Exception as e:
                    log_error(f"Failed to initialize SarvamClient: {str(e)}")
            else:
                log_info("Sarvam AI translation disabled (SARVAM_API_KEY is not set). Falling back to English primary generation.")

        
        # Load dynamic Mode Configuration from mode_packs
        mode_cfg = get_mode_config(args.mode)
        mode_dir = ROOT / "mode_packs" / args.mode
        
        # Read plan prompt instructions from mode pack
        plan_prompt_path = mode_dir / mode_cfg.plan_prompt_file
        plan_system_prompt = plan_prompt_path.read_text(encoding="utf-8").strip()
        
        # Read generate prompt instructions from mode pack (if defined)
        gen_system_prompt = ""
        if mode_cfg.generate_prompt_file:
            gen_prompt_path = mode_dir / mode_cfg.generate_prompt_file
            gen_system_prompt = gen_prompt_path.read_text(encoding="utf-8").strip()

        # Determine slide specification string from configuration pack
        slide_spec = mode_cfg.slide_spec or "Long-form editorial post"

        # Resolve Inputs
        direction = params.get("input_direction", "")
        context = params.get("input_context", "")
        html_rules = params.get("html_rules", "")
        plan_content = params.get("plan_content", "")

        # Fallback to default HTML template rules if none provided
        if mode_cfg.html_template_file and not html_rules:
            html_template_path = mode_dir / mode_cfg.html_template_file
            html_rules = html_template_path.read_text(encoding="utf-8").strip()

        # Fallback to legacy folders if requested (useful for dev parity testing)
        if args.legacy_post_id and args.legacy_section:
            legacy_direction, legacy_html_rules = get_legacy_inputs(
                args.legacy_section, args.legacy_post_id, args.mode
            )
            if not direction:
                direction = legacy_direction
            if not html_rules:
                html_rules = legacy_html_rules
            # If generating directly without separate plan, treat direction as the plan
            if not plan_content:
                plan_content = legacy_direction

        # ----------------------------------------------------
        # ACTION: PLAN
        # ----------------------------------------------------
        if args.action == "plan":
            emit_progress("planning", 10, "Initializing planner...")
            planner = Planner(client)
            
            def on_stream(delta):
                emit_progress("planning", 50, "Generating content outline...", delta=delta)
                
            plan_markdown = planner.generate_plan(
                system_prompt=plan_system_prompt,
                mode=args.mode,
                direction=direction,
                context=context,
                slide_spec=slide_spec,
                style_context=style_context,
                stream_callback=on_stream
            )
            
            # Save plan to workspace
            plan_file = project_dir / "plan.md"
            plan_file.write_text(plan_markdown, encoding="utf-8")
            emit_progress("completed", 100, f"Plan created successfully at: {plan_file}")

        # ----------------------------------------------------
        # ACTION: GENERATE
        # ----------------------------------------------------
        elif args.action == "generate":
            if not plan_content:
                log_error("Cannot generate content without plan_content parameter.")
                sys.exit(1)
                
            emit_progress("generating", 10, "Initializing content generator...")
            generator = Generator(client, ROOT)
            
            def on_stream(delta):
                emit_progress("generating", 60, "Generating final content...", delta=delta)

            final_output = generator.generate_content(
                system_prompt=gen_system_prompt,
                mode=args.mode,
                approved_plan=plan_content,
                html_rules=html_rules,
                slide_spec=slide_spec,
                style_context=style_context,
                stream_callback=on_stream
            )

            if sarvam_client and args.mode != "reel":
                emit_progress("generating", 80, "Translating generated assets via Sarvam AI...")
                if args.mode == "blog":
                    final_output = sarvam_client.translate_text(
                        final_output,
                        target_lang=default_lang,
                        style=default_style,
                        custom_directives=custom_directives
                    )
                else:
                    final_output = translate_html_carousel(
                        final_output,
                        sarvam_client,
                        target_lang=default_lang,
                        style=default_style,
                        cta_style=cta_style,
                        custom_directives=custom_directives
                    )

            # Save generated code / text
            if args.mode == "blog":
                output_file = project_dir / "blog.md"
                output_file.write_text(final_output, encoding="utf-8")
                
                # Double-faceted generation: compile to HTML
                emit_progress("generating", 90, "Compiling Blog Markdown to premium HTML...")
                try:
                    from markdown_it import MarkdownIt
                    md = MarkdownIt()
                    html_body = md.render(final_output)
                    
                    html_template = build_blog_template(style_overrides)
                    html_content = html_template.replace("{blog_content}", html_body)
                    html_file = project_dir / "blog.html"
                    html_file.write_text(html_content, encoding="utf-8")
                except Exception as e:
                    log_error(f"Failed to compile markdown to html: {str(e)}")
            elif args.mode == "reel":
                try:
                    reel_script = json.loads(final_output)
                except json.JSONDecodeError:
                    # Model may have wrapped the JSON object with stray commentary
                    # that the code-fence stripper didn't catch. Try to recover the
                    # outermost JSON object before giving up.
                    start = final_output.find('{')
                    end = final_output.rfind('}')
                    if start == -1 or end == -1 or end <= start:
                        log_error(
                            "Generated reel script is not valid JSON. "
                            f"Output preview: {final_output[:300]!r}"
                        )
                        sys.exit(1)
                    try:
                        reel_script = json.loads(final_output[start:end + 1])
                    except json.JSONDecodeError as e:
                        log_error(
                            f"Generated reel script is not valid JSON: {str(e)}. "
                            f"Output preview: {final_output[:300]!r}"
                        )
                        sys.exit(1)

                validation_errors = validate_reel_script(reel_script)
                if validation_errors:
                    log_error("Generated reel script failed validation: " + "; ".join(validation_errors))
                    sys.exit(1)

                output_file = project_dir / "reel_script.json"
                output_file.write_text(json.dumps(reel_script, indent=2), encoding="utf-8")
            else:
                final_output, removed_count = strip_empty_placeholders(final_output)
                if removed_count:
                    emit_progress("generating", 85, f"Removed {removed_count} empty placeholder element(s).")

                output_file = project_dir / "carousel.html"
                output_file.write_text(final_output, encoding="utf-8")

            emit_progress("completed", 100, f"Content generated successfully at: {output_file}")

        # ----------------------------------------------------
        # ACTION: EXPORT
        # ----------------------------------------------------
        elif args.action == "export":
            if mode_cfg.outputs.get("png"):
                html_file = project_dir / "carousel.html"
                if not html_file.exists():
                    log_error(f"carousel.html not found in {project_dir}. Run generate first.")
                    sys.exit(1)
                    
                emit_progress("exporting", 20, "Launching rendering browser...")
                exporter = Exporter()
                slides_dir = project_dir / "slides"
                
                png_slides = exporter.export_slides(
                    html_file=html_file,
                    output_dir=slides_dir,
                    width=mode_cfg.width,
                    height=mode_cfg.height,
                    scale=mode_cfg.scale_factor
                )
                
                emit_progress("exporting", 70, f"Exported {len(png_slides)} slides. Assembling outputs...")

                # LinkedIn-only PDF Export — gated by both mode config and per-revision flag
                if mode_cfg.outputs.get("pdf") and params.get("export_pdf", True):
                    emit_progress("exporting", 85, "Compiling PDF...")
                    pdf_builder = PDFBuilder()
                    
                    pdf_name = params.get("pdf_name", f"Polynovea_{args.mode}_post.pdf")
                    output_pdf = project_dir / pdf_name
                    
                    pdf_path = pdf_builder.build_pdf(png_slides, output_pdf)
                    emit_progress("completed", 100, f"LinkedIn PDF created successfully at: {pdf_path}")
                else:
                    emit_progress("completed", 100, f"Export complete. Slides saved at: {slides_dir}")

                # Upload training artifacts to Azure Blob (fire-and-forget)
                upload_training_artifact(
                    project_dir=str(project_dir),
                    revision_id=args.revision_id,
                    mode=args.mode,
                    params=params
                )
            else:
                emit_progress("completed", 100, f"Export complete. No image artifacts required for mode: {args.mode}")

        # ----------------------------------------------------
        # ACTION: CORRECT
        # ----------------------------------------------------
        elif args.action == "correct":
            slide_number = params.get("slide_number")
            correction_instruction = params.get("correction_instruction", "").strip()

            if not slide_number or not correction_instruction:
                log_error("slide_number and correction_instruction are required for correct action.")
                sys.exit(1)

            html_file = project_dir / "carousel.html"
            if not html_file.exists():
                log_error(f"carousel.html not found in {project_dir}. Run generate first.")
                sys.exit(1)

            carousel_html = html_file.read_text(encoding="utf-8")
            soup = BeautifulSoup(carousel_html, 'html.parser')
            slide_els = soup.find_all(class_=lambda x: x and 'slide' in x.split())

            slide_idx = int(slide_number) - 1
            if slide_idx < 0 or slide_idx >= len(slide_els):
                log_error(f"Slide {slide_number} out of range (carousel has {len(slide_els)} slides).")
                sys.exit(1)

            target_slide_html = str(slide_els[slide_idx])
            emit_progress("correcting", 10, f"Preparing correction for slide {slide_number} of {len(slide_els)}...")

            correction_system = gen_system_prompt or "You are an expert HTML/CSS carousel slide designer."
            correction_user = f"""You are correcting a single slide in a visual carousel.

Current HTML for slide {slide_number} of {len(slide_els)}:

{target_slide_html}

Style context for this carousel:
{style_context}

User correction instruction:
{correction_instruction}

CRITICAL RULES:
- Return ONLY the corrected slide HTML — the single element with class="slide" and its entire inner contents
- Do NOT return the full carousel, wrapper HTML, <head>, <body>, or any other slides
- Preserve class="slide" on the root element
- Apply exactly the requested correction — do not redesign the whole slide
- No markdown fences, no commentary — raw HTML only
"""

            def on_correct_stream(delta):
                emit_progress("correcting", 55, f"Regenerating slide {slide_number}...", delta=delta)

            corrected_html = client.generate_completion(
                system_msg=correction_system,
                user_msg=correction_user,
                stream_callback=on_correct_stream
            )

            # Strip accidental code fences
            corrected_html = corrected_html.replace("```html", "").replace("```", "").strip()

            corrected_frag = BeautifulSoup(corrected_html, 'html.parser')
            corrected_slide_el = corrected_frag.find(class_=lambda x: x and 'slide' in x.split())
            if corrected_slide_el is None:
                log_error("Corrected output does not contain a .slide element. Aborting to avoid corrupting the carousel.")
                sys.exit(1)

            # Patch the slide in-place and write back
            emit_progress("correcting", 80, "Patching carousel HTML...")
            slide_els[slide_idx].replace_with(corrected_frag)
            html_file.write_text(str(soup), encoding="utf-8")

            # Re-render just that slide
            emit_progress("correcting", 85, f"Re-rendering slide {slide_number}...")
            exporter = Exporter()
            slide_png_path = project_dir / "slides" / f"slide-{int(slide_number):02d}.png"
            exporter.export_single_slide(
                html_file=html_file,
                slide_index=slide_idx,
                output_path=slide_png_path,
                width=mode_cfg.width,
                height=mode_cfg.height,
                scale=mode_cfg.scale_factor
            )

            emit_progress("completed", 100, f"Slide {slide_number} corrected and re-rendered successfully.")

    except Exception as e:
        log_error(f"Execution failed: {str(e)}")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
