# PolyNovea Content Desktop App: SQLite Data Model

This document outlines the SQLite database schema for local persistence of app configuration, projects, revisions, slide-level copy, and output references.

---

## 1. Table Schemas

### `projects`
Stores the top-level details of user projects.
```sql
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,                  -- UUID v4
    name TEXT NOT NULL,                   -- User-supplied title
    mode TEXT NOT NULL,                   -- 'linkedin' | 'instagram' | 'threads' | 'blog'
    default_language TEXT DEFAULT 'en',   -- 'en', 'hi', 'hi-Latn' (Hinglish)
    default_language_style TEXT,          -- 'formal', 'colloquial', 'transliterated'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `revisions`
Tracks every draft version and generation attempt.
```sql
CREATE TABLE IF NOT EXISTS revisions (
    id TEXT PRIMARY KEY,                  -- UUID v4
    project_id TEXT NOT NULL,             -- Foreign Key -> projects(id)
    version INTEGER NOT NULL,             -- Incrementing integer (1, 2, 3...)
    input_direction TEXT NOT NULL,        -- English user prompt
    input_context TEXT,                   -- Optional target details / context
    language_overrides TEXT,              -- JSON string of multi-level style overrides
    status TEXT NOT NULL,                 -- 'draft' | 'planning' | 'plan_pending' | 'generating' | 'completed' | 'failed'
    error_message TEXT,                   -- Stacktrace if failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### `revision_plans`
Stores the generated planning brief (Hook, angle, slide structure) that the user reviews and edits.
```sql
CREATE TABLE IF NOT EXISTS revision_plans (
    id TEXT PRIMARY KEY,                  -- UUID v4
    revision_id TEXT NOT NULL,            -- Foreign Key -> revisions(id)
    raw_markdown TEXT NOT NULL,           -- Complete plan in Markdown
    approved_at DATETIME,                 -- Timestamp when approved
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(revision_id) REFERENCES revisions(id) ON DELETE CASCADE
);
```

### `revision_slides`
Stores structured slide-level contents for carousels, allowing direct UI editing of specific slides.
```sql
CREATE TABLE IF NOT EXISTS revision_slides (
    id TEXT PRIMARY KEY,                  -- UUID v4
    revision_id TEXT NOT NULL,            -- Foreign Key -> revisions(id)
    slide_number INTEGER NOT NULL,        -- 1-based index position
    eyebrow TEXT,                         -- Slide category label
    headline TEXT,                        -- Primary slide heading
    body TEXT,                            -- Core slide content
    language TEXT DEFAULT 'en',           -- e.g. 'hi-Latn' override
    language_style TEXT,                  -- override style
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(revision_id) REFERENCES revisions(id) ON DELETE CASCADE
);
```

### `revision_outputs`
Stores file system paths to the generated HTML page and textual blog drafts.
```sql
CREATE TABLE IF NOT EXISTS revision_outputs (
    id TEXT PRIMARY KEY,                  -- UUID v4
    revision_id TEXT NOT NULL,            -- Foreign Key -> revisions(id)
    html_file_path TEXT,                  -- Absolute path to carousel.html
    blog_text_content TEXT,               -- Blog post draft (Blog mode only)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(revision_id) REFERENCES revisions(id) ON DELETE CASCADE
);
```

### `artifacts`
Tracks individual files exported during compilation (PNGs, LinkedIn PDF).
```sql
CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,                  -- UUID v4
    revision_id TEXT NOT NULL,            -- Foreign Key -> revisions(id)
    type TEXT NOT NULL,                   -- 'png_slide' | 'linkedin_pdf' | 'blog_markdown'
    file_path TEXT NOT NULL,              -- Absolute path on user disk
    slide_number INTEGER,                 -- Nullable, references slide index if png_slide
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(revision_id) REFERENCES revisions(id) ON DELETE CASCADE
);
```

### `settings`
Local key-value store for app-wide configuration and API keys.
```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,                 -- config key
    value TEXT NOT NULL                   -- config value (API keys are encrypted in OS-backed Base64)
);
```

---

## 2. API Credentials & Encryption Policy

To align with security constraints for local desktop tools, API keys (specifically `NVIDIA_API_KEY` and `SARVAM_API_KEY`) are protected using OS-level security layers:

* **OS safeStorage Encryption**:
  The Electron app utilizes Electron's native `safeStorage` module. Before writing any key to the `settings` database table, the app encrypts the value (using DPAPI on Windows and Keychain on macOS) and stores the resulting buffer as a Base64 string.
* **Decryption at Runtime**:
  Upon starting a plan, generation, or export job, Electron decrypts the credential string on-the-fly and passes the key dynamically to the Python sidecar process in memory (inside the parsed `--params-file` JSON payload). The keys are never stored on disk in raw text or committed to prompts/repository files.
* **Fallback Security Compromise Statement**:
  If the target system does not support OS-level encryption (e.g. headless Linux servers or developer machines where the decryption key is unavailable), the IPC layer falls back to storing the API credentials in plain text. **This plain-text fallback is strictly an internal-tool development compromise for V1** and is not to be treated as a secure default. In production, OS-backed encryption is required.

