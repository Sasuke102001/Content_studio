# PolyNovea Content Desktop App: Engine CLI Contract

This document defines the interface and data contract between the Electron Main process and the Python Sidecar execution wrapper (`run_engine.py`).

---

## 1. CLI Execution Command

The Electron main process spawns the Python engine using standard arguments:

```bash
python run_engine.py --action [plan|generate|export] --mode [linkedin|instagram|threads|blog] --project-dir "[absolute-project-dir]" --revision-id "[revision-uuid]" --params-file "[absolute-params-json-file]"
```

### Argument Parameters
* `--action`:
  - `plan`: Runs Kimi outlining. Generates initial slide breakdown structure.
  - `generate`: Synthesizes final HTML code (for carousels) or full markdown draft (for blog).
  - `export`: Spawns Playwright to screenshot HTML to PNGs, and packages to PDF (LinkedIn-only).
* `--mode`: The channel-specific configuration model (`linkedin`, `instagram`, `threads`, or `blog`).
* `--project-dir`: Local workspace folder path where output HTML, slides, and logs will be written.
* `--revision-id`: Unique identifier tracking the specific generation run.
* `--params-file`: Path to a JSON configuration file containing parameters:
  - `input_direction` (string)
  - `input_context` (string)
  - `plan_content` (string, required for `--action generate` and `--action export`)
  - `language_overrides` (JSON object defining translations/style overrides)
  - `secrets` (JSON containing API keys if not loaded from environment)

---

## 2. Stdout JSON Progress Stream

To support progress bars and status text in the desktop UI, the Python script streams structured JSON lines to standard output. Human-readable logging is suppressed or redirected to file logs.

Each line printed to stdout must follow this JSON schema:

```json
{
  "status": "planning" | "adapting_language" | "generating" | "exporting" | "completed" | "failed",
  "percentage": 45,
  "message": "Invoking NVIDIA NIM Kimi 2.6..."
}
```

### Status Descriptions
- `planning`: Generating outline structure.
- `adapting_language`: Invoking Sarvam AI for slide-level translation/adaptation.
- `generating`: Writing final HTML or long-form copy.
- `exporting`: Launching Playwright, waiting for fonts, and taking screenshots.
- `completed`: Pipeline step finished successfully.
- `failed`: Job crashed. Stderr contains traceback.

---

## 3. Exit Codes & Errors

- **Success**: Code `0`. The final line printed to stdout will be `{"status": "completed", "percentage": 100}`.
- **API Failure (NVIDIA / Sarvam)**: Code `2`. The stdout will emit `{"status": "failed", "message": "NVIDIA API rate limit error..."}`.
- **Playwright/Renderer Timeout**: Code `3`. The browser could not load the HTML or complete rendering.
- **General Exception**: Code `1`. Uncaught Python runtime tracebacks are printed to stderr and captured by Electron to populate log files.
