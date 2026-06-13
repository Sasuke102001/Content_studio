from dataclasses import dataclass, field
from typing import Optional, Dict

@dataclass
class ModeConfig:
    mode: str
    name: str
    width: Optional[int] = None
    height: Optional[int] = None
    scale_factor: Optional[float] = None
    min_slides: Optional[int] = None
    max_slides: Optional[int] = None
    supports_pdf: bool = False
    outputs: Dict[str, bool] = field(default_factory=dict)
    pdf_name_template: Optional[str] = None
    plan_prompt_file: Optional[str] = None
    generate_prompt_file: Optional[str] = None
    html_template_file: Optional[str] = None
    slide_spec: Optional[str] = None
