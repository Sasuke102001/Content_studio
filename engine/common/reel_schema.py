"""Python-side mirror of the Zod schema in src/shared/reelSchema.ts.

Used to validate LLM-generated reel scene scripts before they are written to
disk, so invalid output is caught at generation time with a clear error
message rather than later when the Remotion renderer parses the same schema.
"""

import re

HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
ACCENTS = {"violet", "gold"}


def _is_int(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _require_number(props: dict, key: str, path: str, errors: list) -> None:
    if not _is_number(props.get(key)):
        errors.append(f"{path}.{key} must be a number.")


def _require_non_negative_int(props: dict, key: str, path: str, errors: list) -> None:
    value = props.get(key)
    if not _is_int(value) or value < 0:
        errors.append(f"{path}.{key} must be a non-negative integer.")


def _require_hex_color(props: dict, key: str, path: str, errors: list) -> None:
    value = props.get(key)
    if not isinstance(value, str) or not HEX_COLOR_RE.match(value):
        errors.append(f"{path}.{key} must be a 6-digit hex color (e.g. #7C3AED).")


def _check_optional_accent(props: dict, path: str, errors: list) -> None:
    if "accent" in props and props["accent"] is not None and props["accent"] not in ACCENTS:
        errors.append(f"{path}.accent must be 'violet' or 'gold' if present.")


def _validate_panel_props(props: dict, path: str, errors: list) -> None:
    for key in ("x", "y", "w", "h"):
        _require_number(props, key, path, errors)
    _require_non_negative_int(props, "start", path, errors)
    _check_optional_accent(props, path, errors)
    for key in ("title", "body"):
        if key in props and props[key] is not None and not isinstance(props[key], str):
            errors.append(f"{path}.{key} must be a string if present.")


def _validate_metric_card_props(props: dict, path: str, errors: list) -> None:
    for key in ("x", "y", "w", "h"):
        _require_number(props, key, path, errors)
    _require_non_negative_int(props, "start", path, errors)
    _check_optional_accent(props, path, errors)
    for key in ("label", "value"):
        if not isinstance(props.get(key), str):
            errors.append(f"{path}.{key} must be a string.")


def _validate_signal_bars_props(props: dict, path: str, errors: list) -> None:
    for key in ("x", "y", "w", "h"):
        _require_number(props, key, path, errors)
    _require_non_negative_int(props, "start", path, errors)
    _require_hex_color(props, "color", path, errors)
    values = props.get("values")
    if not isinstance(values, list) or not (3 <= len(values) <= 12):
        errors.append(f"{path}.values must be an array with 3 to 12 entries.")
    elif not all(_is_number(v) and 0 <= v <= 100 for v in values):
        errors.append(f"{path}.values entries must be numbers between 0 and 100.")


def _validate_signal_flow_row_props(props: dict, path: str, errors: list) -> None:
    for key in ("x", "y", "w"):
        _require_number(props, key, path, errors)
    _require_non_negative_int(props, "start", path, errors)
    _require_hex_color(props, "color", path, errors)
    if not isinstance(props.get("label"), str):
        errors.append(f"{path}.label must be a string.")
    if "frameOffset" in props and props["frameOffset"] is not None:
        value = props["frameOffset"]
        if not _is_int(value) or value < 0:
            errors.append(f"{path}.frameOffset must be a non-negative integer if present.")


def _validate_metric_wave_bar_props(props: dict, path: str, errors: list) -> None:
    for key in ("x", "y", "w", "h"):
        _require_number(props, key, path, errors)
    _require_non_negative_int(props, "start", path, errors)
    _require_hex_color(props, "color", path, errors)
    value = props.get("value")
    if not _is_number(value) or not (0 <= value <= 100):
        errors.append(f"{path}.value must be a number between 0 and 100.")
    _require_non_negative_int(props, "index", path, errors)


_SCENE_PROP_VALIDATORS = {
    "panel": _validate_panel_props,
    "metricCard": _validate_metric_card_props,
    "signalBars": _validate_signal_bars_props,
    "signalFlowRow": _validate_signal_flow_row_props,
    "metricWaveBar": _validate_metric_wave_bar_props,
}


def validate_reel_script(reel_script) -> list:
    """Validate a reel scene script against reelScriptSchema. Returns a list of
    human-readable error messages (empty if the script is valid)."""
    errors = []

    if not isinstance(reel_script, dict):
        return ["Reel script must be a JSON object."]

    if not isinstance(reel_script.get("title"), str) or not reel_script["title"].strip():
        errors.append("'title' must be a non-empty string.")

    eyebrow = reel_script.get("eyebrow")
    if eyebrow is not None and not isinstance(eyebrow, str):
        errors.append("'eyebrow' must be a string if present.")

    if reel_script.get("fps") != 30:
        errors.append("'fps' must be exactly 30.")

    if reel_script.get("width") != 1080:
        errors.append("'width' must be exactly 1080.")

    if reel_script.get("height") != 1920:
        errors.append("'height' must be exactly 1920.")

    duration = reel_script.get("durationInFrames")
    if not _is_int(duration) or not (150 <= duration <= 600):
        errors.append("'durationInFrames' must be an integer between 150 and 600.")

    scenes = reel_script.get("scenes")
    if not isinstance(scenes, list) or not (1 <= len(scenes) <= 40):
        errors.append("'scenes' must be an array with 1 to 40 entries.")
        scenes = []

    for i, scene in enumerate(scenes):
        path = f"scenes[{i}]"
        if not isinstance(scene, dict):
            errors.append(f"{path} must be an object.")
            continue

        scene_type = scene.get("type")
        validator = _SCENE_PROP_VALIDATORS.get(scene_type)
        if validator is None:
            errors.append(f"{path}.type must be one of {sorted(_SCENE_PROP_VALIDATORS)}.")
            continue

        _require_non_negative_int(scene, "from", path, errors)
        scene_duration = scene.get("durationInFrames")
        if not _is_int(scene_duration) or scene_duration < 1:
            errors.append(f"{path}.durationInFrames must be a positive integer.")

        props = scene.get("props")
        if not isinstance(props, dict):
            errors.append(f"{path}.props must be an object.")
            continue

        validator(props, f"{path}.props", errors)

    return errors
