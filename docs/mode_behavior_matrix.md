# PolyNovea Content Desktop App: Mode Behavior Matrix

This matrix maps out the visual layouts, generation rules, brand voice contexts, and output configurations for each mode in the PolyNovea Content Desktop App.

| Mode / Platform | Layout Size | Scale Factor | Output Resolution | Output Formats | Brand Context Files | System Role & Guidelines | Slide/Count Limits |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Biz Instagram** | 420 × 525 px (4:5 Ratio) | 2.571 (1080 / 420) | 1080 × 1350 px | HTML, PNG Slides | `context/polynovea_brand_visual_and_content_system_v_1.md` | "You are an elite Instagram carousel designer for the Polynovea company page. Institutional voice. Premium editorial. No startup aesthetics." | Exactly 6 slides |
| **Biz LinkedIn** | 540 × 540 px (1:1 Ratio) | 2.0 (1080 / 540) | 1080 × 1080 px | HTML, PNG Slides, PDF | `context/polynovea_brand_visual_and_content_system_v_1.md` | "You are an elite LinkedIn carousel designer for the Polynovea company page. Institutional, analytical, premium. No startup aesthetics." | Exactly 7 slides |
| **Personal Instagram** | 420 × 525 px (4:5 Ratio) | 2.571 (1080 / 420) | 1080 × 1350 px | HTML, PNG Slides | `context/polynovea_brand_visual_and_content_system_v_1.md`, `context/roys-personal-voice.md`, `context/carousel-content-context.md` | "You are an elite Instagram carousel designer for a founder's personal brand (@subrojitroy). Operator voice. Structured argument. No hype. No motivation content." | 5 to 7 slides |
| **Threads (V1 target)** | 420 × 525 px (4:5 Ratio) | 2.571 (1080 / 420) | 1080 × 1350 px | HTML, PNG Slides, Text blocks | `context/polynovea_brand_visual_and_content_system_v_1.md` | To be defined (usually aligns with Instagram visual styling, but with shorter copy/faster pacing). | 3 to 8 slides |
| **Blog (V1 target)** | N/A | N/A | N/A | HTML, Markdown | `context/polynovea_brand_visual_and_content_system_v_1.md`, `context/Polynovea_Master_Operating_Document_FINAL.md` | To be defined (long-form narrative draft, structured subheadings, image concepts/prompts). | Dynamic section count |

---

## Technical Specifications per Platform

### LinkedIn (Biz)
- **PDF Construction**: Strict zero-margin PDF. Playwright screenshots must be assembled via `img2pdf` to avoid the white spaces added by online converters.
- **Design Tokens**: Gold highlights are specifically restricted to slides 3 and 7. Violet is limited to flow arrows and 1 eyebrow element maximum.

### Instagram (Biz)
- **Visuals**: Dark mode, glassmorphism card panels. Violet is limited to 1 element maximum per slide.
- **Pacing**: Short paragraphs, large bold titles, clear indicator dots at the bottom.

### Instagram (Personal)
- **Visuals**: Aligns with Subrojit Roy's personal operator style. More technical, diagrams, and direct operator tones.
- **Palette**: Dark background, white headlines, custom highlight accents as instructed in `carousel-content-context.md`.
