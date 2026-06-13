# PolyNovea Content Desktop App: Runtime Packaging & Browser Availability

This document outlines the packaging strategies, first-run initialization flows, executable path structures, and the long-term plan to converge the app's rendering components.

---

## 1. Local Runtime Packaging Strategies

To deliver a developer-free installation for non-technical team members, the application must bundle or orchestrate its dependencies locally.

### Python Environment
- **Packaging Strategy**: Package a minimal portable Python interpreter (e.g., Python embeddable zip for Windows or miniconda mini-environment) placed inside the Electron application package directory (`resources/bin/python`).
- **Dependencies**: The portable interpreter comes with a packaged `site-packages` directory containing all requirements (such as `requests`, `playwright`, `img2pdf`, and `python-dotenv`).

### Playwright Chromium Renderer
We evaluate two installation options for the Chromium engine used to render slide HTML:

* **Option A: Fully Bundled Installer (Offline-First)**
  - **Strategy**: Download the Playwright-compatible Chromium browser binary during the Electron build phase, and bundle it inside the app installer package.
  - **Pros**: Immediate rendering availability out-of-the-box. Works completely offline.
  - **Cons**: App installer size increases by ~150MB (total size ~400MB).
* **Option B: First-Run Downloader (Online-First)**
  - **Strategy**: Deliver a lightweight installer (~150MB). On the first run, the app checks if Chromium exists in its local AppData cache and launches a background thread to run `python -m playwright install chromium`.
  - **Pros**: Quick download and installation.
  - **Cons**: Requires active internet connection on first-run. Can fail if proxy or network filters block Playwright CDN.

---

## 2. Executable Path & Directory Management

The Electron Main process resolves path locations dynamically based on development or production states:

```
[Production App Folder]
├── app.exe                        (Electron main process)
└── resources/
    ├── app.asar                   (Packaged Electron UI)
    └── bin/
        └── python/                (Embedded portable Python runtime)
            ├── python.exe
            └── Lib/site-packages/ (Pre-installed requirements)
```

- **Environment variables**: At startup, Electron overrides path variables to route requests to the bundled Python binary folder instead of searching global environment variables.
- **Browser Cache Path**: Playwright is configured via the `PLAYWRIGHT_BROWSERS_PATH` environment variable to save/load Chromium inside the application's local user data folder (e.g. `%APPDATA%/PolyNovea Content/playwright-browsers/`) rather than the default user profile, ensuring clean uninstalls.

---

## 3. First-Run Diagnostics & Export Failures

To prevent silent failures in the export pipeline, the Electron UI will host a **Diagnostics Dashboard**:
1. **Verifications**:
   - Python executable detection.
   - Playwright library import check.
   - Chromium binary launch and version check.
   - NVIDIA & Sarvam AI API connectivity.
2. **Error Recovery**: If rendering fails, the user is prompted with an error stack trace and a "Repair Renderer" action. This invokes a clean re-download of browser dependencies into the local cache.

---

## 4. Long-Term Architectural Convergence

Maintaining two separate Chromium browser runtimes (Electron's own runtime and Playwright's Chromium instance) is redundant and memory-intensive.

* **Target Transition Plan (Post-V1)**:
  - Migrate slide rendering from the Python/Playwright process to the Electron Main process itself.
  - When the user triggers an export, Electron spawns an offline, hidden `BrowserWindow` loading the generated `carousel.html`.
  - Electron uses its native rendering APIs, such as `webContents.capturePage()` (for PNG slides) and `webContents.printToPDF()` (for LinkedIn PDF) to export assets.
  - This migration will eliminate the Playwright and PyPlaywright dependencies entirely, reducing runtime memory and dropping bundle sizes by 150MB.
