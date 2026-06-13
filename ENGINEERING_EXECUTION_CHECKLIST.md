# PolyNovea Content Desktop App: Engineering Execution Checklist

This document converts the product plan into an implementation checklist with dependency order, concrete file targets, and execution notes.

Use this as the working engineering plan.

---

## 0. Delivery Rules

These rules apply to every phase.

- Preserve current generator behavior before abstracting it.
- Do not remove the current scripts until parity is verified.
- Treat `LinkedIn PDF` as a mode-specific export, not a generic carousel export.
- Treat `Sarvam` as optional and scoped in V1.
- Do not overbuild Threads before the product decision is settled.
- Prefer additive refactor over replacement.

---

## 1. Baseline And Audit

Goal: document exactly what the current generator does before any refactor starts.

### Tasks

- Read and annotate current engine entrypoints:
  - [run.py](D:\PolyNovea\Carousel\run.py)
  - [biz\generate.py](D:\PolyNovea\Carousel\biz\generate.py)
  - [biz\export.py](D:\PolyNovea\Carousel\biz\export.py)
  - [biz\make_pdf.py](D:\PolyNovea\Carousel\biz\make_pdf.py)
  - [personal\generate.py](D:\PolyNovea\Carousel\personal\generate.py)
  - [personal\export.py](D:\PolyNovea\Carousel\personal\export.py)

- Record current mode behaviors:
  - LinkedIn
  - Instagram
  - Personal Instagram

- Record current source assets:
  - [context](D:\PolyNovea\Carousel\context)
  - [templates](D:\PolyNovea\Carousel\templates)
  - [prompts](D:\PolyNovea\Carousel\prompts)
  - [biz\prompts](D:\PolyNovea\Carousel\biz\prompts)

- Record current output paths:
  - [outputs](D:\PolyNovea\Carousel\outputs)

### Deliverables

- `docs/current_engine_behavior.md`
- `docs/mode_behavior_matrix.md`
- `docs/output_artifact_map.md`

### Exit criteria

- Current LinkedIn pipeline documented as `HTML -> PNG -> PDF`
- Current Instagram pipeline documented as `HTML -> PNG`
- Current file and prompt dependencies mapped

---

## 2. Create Refactor Skeleton

Goal: introduce the future folder structure without breaking current behavior.

### Tasks

- Create new folders:
  - `engine/`
  - `engine/api_clients/`
  - `engine/common/`
  - `mode_packs/`
  - `src/main/`
  - `src/preload/`
  - `src/renderer/`
  - `docs/`

- Do not move current legacy files yet.

- Add placeholder runtime contract docs:
  - `docs/engine_cli_contract.md`
  - `docs/app_data_model.md`
  - `docs/runtime_packaging_notes.md`

### Deliverables

- folder structure created
- docs placeholders added

### Exit criteria

- repo can contain old and new structures side by side
- no current script path is broken

---

## 3. Stabilize Python Engine With Parity

Goal: build a modular engine wrapper around current logic.

### New files

- `engine/run_engine.py`
- `engine/planner.py`
- `engine/generator.py`
- `engine/exporter.py`
- `engine/pdf_builder.py`
- `engine/common/mode_loader.py`
- `engine/common/models.py`
- `engine/common/logging.py`
- `engine/api_clients/kimi_client.py`

### Tasks

- Extract environment and API request logic from [run.py](D:\PolyNovea\Carousel\run.py) into `engine/api_clients/kimi_client.py`
- Extract prompt loading and shared context loading into `engine/generator.py`
- Extract export behavior into `engine/exporter.py`
- Extract LinkedIn-only PDF behavior into `engine/pdf_builder.py`
- Create `engine/run_engine.py` as the new CLI entrypoint with:
  - `--action plan`
  - `--action generate`
  - `--action export`
  - `--mode linkedin|instagram|personal|blog|threads`
  - `--params-file ...`

- Keep current logic intact while extracting.

### Do not do yet

- do not redesign prompt packs
- do not add Sarvam yet
- do not delete [run.py](D:\PolyNovea\Carousel\run.py)

### Deliverables

- engine CLI runs the same LinkedIn and Instagram flows as current scripts

### Exit criteria

- new engine wrapper can generate and export existing modes
- output parity checked against current `outputs/` structure

---

## 4. Add Structured Progress And Error Contract

Goal: make the engine usable from Electron.

### Files to update

- `engine/run_engine.py`
- `engine/common/logging.py`

### Tasks

- Emit JSON lines to stdout for progress:
  - planning started
  - planning complete
  - generating started
  - export started
  - export complete
  - failure

- Standardize stderr and file logging.

- Define payload shape in:
  - `docs/engine_cli_contract.md`

### Deliverables

- JSON progress stream format documented and implemented

### Exit criteria

- Electron can later read engine progress without parsing human console text

---

## 5. Design Mode-Pack Layer

Goal: move toward configuration-driven modes only after engine parity exists.

### New files

- `mode_packs/linkedin/config.json`
- `mode_packs/instagram/config.json`
- `mode_packs/blog/config.json`
- `mode_packs/threads/config.json`

- `mode_packs/linkedin/plan_prompt.txt`
- `mode_packs/linkedin/generate_prompt.txt`
- `mode_packs/instagram/plan_prompt.txt`
- `mode_packs/instagram/generate_prompt.txt`
- `mode_packs/blog/plan_prompt.txt`
- `mode_packs/blog/generate_prompt.txt`

### Tasks

- Convert existing prompt behavior into config-backed loading
- Map current dimensions and export rules into config
- Keep Threads minimal until product decision is final
- Keep Blog independent of PNG/PDF export assumptions

### Suggested config fields

- `mode`
- `name`
- `dimensions`
- `outputs`
- `plan_prompt`
- `generate_prompt`
- `context_files`
- `supports_language_overrides`

### Deliverables

- `engine/common/mode_loader.py` loads mode definitions from `mode_packs/`

### Exit criteria

- LinkedIn and Instagram can run via mode configs with no behavior regression

---

## 6. Add SQLite Data Model

Goal: create local persistence for projects, revisions, plans, slide metadata, and artifacts.

### New files

- `src/main/db.ts`
- `docs/app_data_model.md`

### Tables to implement

- `projects`
- `revisions`
- `revision_plans`
- `revision_slides`
- `revision_outputs`
- `artifacts`
- `settings`

### Tasks

- Implement schema and migrations in `src/main/db.ts`
- Store:
  - project metadata
  - input direction
  - plan markdown
  - plan JSON
  - per-slide editable records
  - artifact file paths
  - status and errors

### Deliverables

- local DB schema in code
- schema docs in `docs/app_data_model.md`

### Exit criteria

- the app can persist structured plan state without relying on one markdown blob only

---

## 7. Define Artifact Storage Layout

Goal: standardize on-disk project and export storage.

### New doc

- `docs/local_storage_layout.md`

### Tasks

- Define default root, for example:
  - `%USERPROFILE%\\Documents\\PolyNovea Content\\`

- Define substructure:
  - `projects/<project-id>/revisions/<revision-id>/`
  - `html/`
  - `slides/`
  - `exports/`
  - `logs/`

- Ensure DB stores references to artifacts, not only raw output bodies

### Exit criteria

- every revision has deterministic artifact locations

---

## 8. Scaffold Electron App

Goal: create the desktop shell without yet building the whole product UX.

### New files

- `package.json`
- `vite.config.ts`
- `src/main/index.ts`
- `src/main/engine.ts`
- `src/main/settings.ts`
- `src/preload/index.ts`
- `src/renderer/main.tsx`

### Tasks

- Initialize Electron + React + TypeScript + Vite
- Implement BrowserWindow setup
- Implement preload bridge
- Implement IPC contract for:
  - project CRUD
  - revision load
  - start plan job
  - approve plan
  - generate final
  - export artifacts
  - settings save/load

### Deliverables

- Electron shell boots
- can call stub engine action through IPC

### Exit criteria

- desktop shell works before feature UI is layered on top

---

## 9. Wire Python Sidecar Into Electron

Goal: connect Electron to the modular Python engine.

### Files to update

- `src/main/engine.ts`
- `src/main/index.ts`
- `src/preload/index.ts`

### Tasks

- spawn `engine/run_engine.py` with structured args
- pass params via temp JSON file
- parse stdout JSON progress
- surface stderr and exit codes
- write engine logs into revision artifact folders

### Deliverables

- real engine execution from Electron

### Exit criteria

- can trigger plan/generate/export from the desktop shell

---

## 10. Build Product Workflow UI

Goal: implement the plan-first workflow for non-technical users.

### New renderer areas

- `src/renderer/views/DashboardView.tsx`
- `src/renderer/views/WorkspaceView.tsx`
- `src/renderer/views/SettingsView.tsx`
- `src/renderer/components/ProjectForm.tsx`
- `src/renderer/components/PlanEditor.tsx`
- `src/renderer/components/RevisionHistory.tsx`
- `src/renderer/components/ArtifactPreview.tsx`

### Tasks

- Dashboard:
  - list projects
  - create project
  - choose mode

- Workspace stage 1:
  - plain-English direction input
  - optional business context
  - generate plan action

- Workspace stage 2:
  - editable plan surface
  - approve plan action

- Workspace stage 3:
  - final preview
  - artifact list
  - export actions

### Exit criteria

- one user can complete the full flow without touching files or terminal

---

## 11. Add Revision History UX

Goal: make app-level version history usable.

### Files to update

- `src/renderer/components/RevisionHistory.tsx`
- `src/main/db.ts`

### Tasks

- show revision timeline
- mark statuses:
  - draft
  - plan pending
  - approved
  - generated
  - export complete
  - failed

- allow:
  - open revision
  - duplicate revision
  - restore prior revision into a new draft

### Exit criteria

- user-facing version history works without Git concepts

---

## 12. Add Export Preview And Actions

Goal: expose correct mode-specific exports.

### Tasks

- LinkedIn:
  - preview HTML
  - preview slide PNGs
  - expose PDF export artifact

- Instagram:
  - preview HTML
  - preview PNG slides only

- Blog:
  - preview final text/HTML
  - export markdown or HTML

- Threads:
  - keep aligned with final product decision

### Critical rule

- never show PDF export as a generic action for all carousel modes

---

## 13. Add Settings And Secret Handling

Goal: make key management and app config usable and explicit.

### Files to update

- `src/main/settings.ts`
- `src/renderer/views/SettingsView.tsx`

### Tasks

- add NVIDIA API key field
- reserve Sarvam key field for optional use
- add output directory setting
- document whether secrets are:
  - OS credential-backed, or
  - local DB stored for internal-use compromise

### Exit criteria

- secrets strategy is explicit and implemented, not implied

---

## 14. Add Sarvam V1 Integration

Goal: support optional language adaptation without destabilizing the core flow.

### New files

- `engine/api_clients/sarvam_client.py`

### Files to update

- `engine/generator.py`
- `src/renderer/components/PlanEditor.tsx`
- `src/renderer/views/WorkspaceView.tsx`

### V1 scope

- project-level language style
- per-slide override
- CTA override
- final-copy adaptation only

### Do not do yet

- do not localize planning output in V1 by default
- do not make Sarvam part of every generation

### Exit criteria

- English primary generation still works untouched
- selected slides can receive Hinglish/regional adaptation

---

## 15. Decide Threads Product Shape

Goal: avoid building the wrong mode.

### Decision options

- `carousel-like visual mode`
- `copy-first thread mode with optional cards`

### Tasks

- define user expectation
- define export expectation
- define whether HTML rendering is needed

### Exit criteria

- Threads is implemented only after its product behavior is locked

---

## 16. Packaging And Runtime Distribution

Goal: make the app usable on non-technical team machines.

### Tasks

- package Python runtime
- package Python dependencies
- decide renderer strategy:
  - bundle Playwright Chromium
  - or install Chromium on first launch

- verify engine path resolution inside packaged Electron app
- add renderer diagnostics and repair flow if browser runtime is missing

### Files/docs

- `docs/runtime_packaging_notes.md`
- installer config files

### Exit criteria

- app installs cleanly on a fresh Windows machine
- no manual Python or Playwright setup is needed

---

## 17. QA Checklist

### Engine parity

- LinkedIn output still produces PNGs and PDF
- Instagram output still produces PNGs only
- current prompt/context behavior remains intact

### Product flow

- user can create project
- generate plan
- edit plan
- approve plan
- generate final output
- export correct artifacts

### Data

- revisions persist correctly
- artifacts are recoverable from DB references
- prior revisions can be reopened or restored

### Language

- default English flow works with no Sarvam
- one-slide Hinglish override works
- CTA-only override works

### Packaging

- clean-machine install succeeds
- engine runs from Electron
- Playwright renderer available

---

## 18. Recommended Build Order Summary

Build in this order:

1. baseline current behavior
2. modular Python engine with parity
3. JSON progress contract
4. mode-pack layer
5. SQLite persistence
6. Electron shell
7. engine-to-app wiring
8. plan-first workspace UI
9. revision history
10. export UX
11. settings and secrets
12. Sarvam V1
13. Threads finalization
14. packaging and QA

This order matters. If you start with UI polish or broad abstraction first, you increase rewrite risk.

---

## 19. Immediate Next Step

The first actual engineering step should be:

- create `docs/current_engine_behavior.md`
- create `docs/mode_behavior_matrix.md`
- create `engine/run_engine.py` as a thin parity wrapper around current behavior

That keeps the current system alive while creating the first stable seam for the desktop app.
