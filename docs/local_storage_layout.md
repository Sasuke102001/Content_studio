# PolyNovea Content Desktop App: Local Storage Layout

This document defines the file system organization for the local-first storage used by the PolyNovea Content Desktop App to manage projects, versioned revision assets, and exports.

---

## 1. Root Directory

By default, the application organizes all user-facing data in a folder under the user's standard Documents directory. This path is configurable in the application settings:

* **Default Windows Root**: `C:\Users\<username>\Documents\PolyNovea Content\`
* **Default macOS Root**: `/Users/<username>/Documents/PolyNovea Content/`
* **Default Linux Root**: `/home/<username>/Documents/PolyNovea Content/`

---

## 2. Directory Tree Structure

All generated outputs, HTML sheets, slide screenshots, PDFs, and engine logs are stored under version-isolated revision subdirectories:

```
PolyNovea Content/
├── projects/
│   └── <project-uuid>/                     ← UUID v4 identifying the project
│       └── revisions/
│           └── <revision-uuid>/            ← UUID v4 identifying the version
│               ├── plan.md                 ← Planning outline (Markdown)
│               ├── params.json             ← Input parameters passed to Python CLI
│               │
│               │   -- Carousel Modes --
│               ├── carousel.html           ← Synthesized multi-slide HTML
│               ├── slides/                 ← Captured PNG screenshots
│               │   ├── slide-01.png
│               │   ├── slide-02.png
│               │   └── ...
│               │
│               │   -- Blog Mode --
│               ├── blog.md                 ← Generated Blog post (Markdown)
│               │
│               │   -- Final Exports --
│               ├── exports/
│               │   ├── ProjectName_LinkedIn_v2.pdf  ← Margin-free compiled PDF
│               │   └── ...
│               │
│               │   -- Diagnostics & Logs --
│               └── logs/
│                   ├── stdout.jsonl        ← JSON lines printed to stdout
│                   └── stderr.log          ← Python uncaught tracebacks
│
└── config/
    └── settings.json                       ← Flat configuration overrides backup
```

---

## 3. Storage Rules

1. **Isolation**: A revision directory is **write-once**. Once a revision changes state to `completed` or `failed`, its folder contents must not be altered. Any edit or new generation request triggers a new revision directory, incrementing the version counter.
2. **References in SQLite**: The database does not copy binary files (images, PDFs) inside SQL blobs. Instead, the `revision_outputs` and `artifacts` tables store absolute, local file system paths:
   - `revision_outputs.html_file_path` points to `.../carousel.html`
   - `artifacts.file_path` points to `.../slides/slide-01.png` or `.../exports/ProjectName_LinkedIn_v2.pdf`
3. **Automatic Cleanup**: If a project is deleted in the UI:
   - Electron runs a recursive deletion (`Remove-Item` / `rm -rf`) on the project folder `projects/<project-uuid>/`.
   - The SQLite database deletes records automatically via foreign key cascade (`ON DELETE CASCADE`).
