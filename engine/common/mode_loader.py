import json
from pathlib import Path
from engine.common.models import ModeConfig

ROOT = Path(__file__).parent.parent.parent
MODE_PACKS_DIR = ROOT / "mode_packs"

def get_mode_config(mode: str) -> ModeConfig:
    mode_dir = MODE_PACKS_DIR / mode
    config_file = mode_dir / "config.json"
    
    if not mode_dir.exists() or not config_file.exists():
        raise ValueError(f"Unknown mode pack or missing config for: {mode}")
        
    with open(config_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    dims = data.get("dimensions", {})
    limits = data.get("slideLimits", {})
    outputs = data.get("outputs", {})
    
    return ModeConfig(
        mode=data["mode"],
        name=data["name"],
        width=dims.get("width"),
        height=dims.get("height"),
        scale_factor=dims.get("scaleFactor"),
        min_slides=limits.get("min"),
        max_slides=limits.get("max"),
        supports_pdf=outputs.get("pdf", False),
        outputs=outputs,
        pdf_name_template=data.get("pdfNameTemplate"),
        plan_prompt_file=data.get("plan_prompt_file"),
        generate_prompt_file=data.get("generate_prompt_file"),
        html_template_file=data.get("html_template_file"),
        slide_spec=data.get("slide_spec")
    )
