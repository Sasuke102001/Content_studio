# PolyNovea Content Desktop App: Output Artifact Map

This map outlines the file locations, directories, and naming conventions for inputs and outputs in the legacy engine, setting the baseline for standardizing paths in the desktop app.

---

## 1. Input Directories & Structure

Legacy inputs are grouped under separate platform folders and loaded via post folders matching `post_[ID]` (using zero-filled numbers, e.g., `post_01`).

### Business Page Inputs (`/biz`)
Inputs are categorized by subfolder based on post number and target platform:
- **Instagram**:
  - Content Brief: `biz/prompts/post_XX/instagram/carousel_request.txt`
  - Design Brief: `biz/prompts/post_XX/instagram/html_request.txt`
- **LinkedIn**:
  - Content Brief: `biz/prompts/post_XX/linkedin/carousel_request.txt`
  - Design Brief: `biz/prompts/post_XX/linkedin/html_request.txt`

### Personal Page Inputs (`/personal`)
Personal page inputs are platform-independent at the prompt level and exist directly under the post number:
- Content Brief: `personal/prompts/post_XX/carousel_request.txt`
- Design Brief: `personal/prompts/post_XX/html_request.txt`

---

## 2. Output Directories & Artifact Names

Generated outputs are placed in structured subdirectories matching the source structure.

### Business Page Outputs (`outputs/biz/`)
- **Instagram**:
  - Output Folder: `outputs/biz/post_XX/instagram/`
  - HTML file: `outputs/biz/post_XX/instagram/carousel.html`
  - PNG screenshots: `outputs/biz/post_XX/instagram/slides/slide-01.png` ... `slide-06.png`
- **LinkedIn**:
  - Output Folder: `outputs/biz/post_XX/linkedin/`
  - HTML file: `outputs/biz/post_XX/linkedin/carousel.html`
  - PNG screenshots: `outputs/biz/post_XX/linkedin/slides/slide-01.png` ... `slide-07.png`
  - Compiled PDF: `outputs/biz/post_XX/linkedin/Polynovea — What This Company Actually Is.pdf` (Note: Currently uses a hardcoded PDF filename in the legacy code).

### Personal Page Outputs (`outputs/personal/`)
- Output Folder: `outputs/personal/post_XX/`
- HTML file: `outputs/personal/post_XX/carousel.html`
- PNG screenshots: `outputs/personal/post_XX/slides/slide-01.png` ... `slide-0N.png`

---

## 3. Transition to Desktop Storage Layout

The Electron application will consolidate these paths under a clean local workspace configuration. Rather than referencing relative Python directories, the database will log absolute local paths in `revision_outputs` and `artifacts` tables:
- **Default Storage Dir**: `C:\Users\<username>\Documents\PolyNovea Content\projects\<project_uuid>\revisions\<revision_uuid>\`
- **Slide naming**: Standardized as `slide-01.png`, `slide-02.png` etc.
- **LinkedIn PDF naming**: Standardized configuration-driven naming, e.g., `{project_name}_LinkedIn_v{revision_version}.pdf`.
