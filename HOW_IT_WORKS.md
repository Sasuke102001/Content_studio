# Polynovea Carousel Generator — How It Works

## What This System Does

The Kimi Carousel Generator takes two prompt files — one for content, one for design — 
sends them to the Kimi AI model via NVIDIA's API, receives a complete HTML file back, 
and then exports each slide as a high-resolution PNG using a headless browser.

For LinkedIn, it also assembles the PNGs into a zero-margin PDF ready for upload.

The pipeline is:

```
Prompt files → Kimi AI (NVIDIA API) → carousel.html → PNGs → PDF (LinkedIn only)
```

---

## Directory Structure

```
Carousel/
│
├── run.py                        ← Single entry point for everything
├── .env                          ← NVIDIA API key
│
├── biz/                          ← Polynovea company page (@polynovea)
│   ├── generate.py               ← (legacy — use run.py instead)
│   ├── export.py                 ← (legacy — use run.py instead)
│   ├── make_pdf.py               ← (legacy — use run.py instead)
│   └── prompts/
│       └── post_01/
│           ├── instagram/
│           │   ├── carousel_request.txt   ← content brief
│           │   └── html_request.txt       ← design system
│           └── linkedin/
│               ├── carousel_request.txt
│               └── html_request.txt
│
├── personal/                     ← Subrojit's personal page (@subrojitroy)
│   ├── generate.py               ← (legacy — use run.py instead)
│   ├── export.py                 ← (legacy — use run.py instead)
│   └── prompts/
│       └── post_01/
│           ├── carousel_request.txt
│           └── html_request.txt
│
├── context/                      ← Shared context fed into every generation
│   ├── polynovea_brand_visual_and_content_system_v_1.md
│   ├── Polynovea_Master_Operating_Document_FINAL.md
│   ├── carousel-content-context.md    ← personal page carousel style rules
│   ├── roys-personal-voice.md         ← personal page voice
│   ├── brand-palette-context.md
│   └── POST-CONTEXT-MAP.md
│
├── assets/
│   └── fonts/                    ← Local Clash Display font files
│
├── outputs/
│   ├── biz/
│   │   └── post_01/
│   │       ├── instagram/
│   │       │   ├── carousel.html
│   │       │   └── slides/       ← slide-01.png … slide-06.png (1080×1350px)
│   │       └── linkedin/
│   │           ├── carousel.html
│   │           ├── slides/       ← slide-01.png … slide-07.png (1080×1080px)
│   │           └── Polynovea — What This Company Actually Is.pdf
│   └── personal/
│       └── post_01/
│           ├── carousel.html
│           └── slides/           ← slide-01.png … slide-0N.png (1080×1350px)
│
└── templates/                    ← Reference PDFs for capability documents
```

---

## The Two Prompt Files

Every post requires exactly two prompt files saved in its folder.

### 1. `carousel_request.txt` — The Content Brief

Tells Kimi WHAT to put in the carousel:
- What the post is about
- How many slides
- Slide-by-slide breakdown (eyebrow, headline, body copy)
- Voice and tone rules
- What must NOT appear
- Brand markers (handle, tagline)

Think of this as the creative brief you'd give a copywriter.

### 2. `html_request.txt` — The Design System

Tells Kimi HOW to visually render the carousel:
- Slide format and dimensions
- Color system (hex values, roles)
- Typography (fonts, sizes, hierarchy)
- Layout rules per slide
- Visual detail system (cards, borders, flow diagrams)
- Output format rules (class="slide", complete HTML)

Think of this as the design spec you'd give a developer.

Both files are concatenated into a single prompt and sent to Kimi together with the 
brand visual system context file. Kimi returns a complete HTML document.

---

## The AI Model

**Model:** `moonshotai/kimi-k2.6`  
**Provider:** NVIDIA NIM API (`https://integrate.api.nvidia.com/v1/chat/completions`)  
**API Key:** Stored in `.env` as `NVIDIA_API_KEY`  
**Streaming:** Yes — output streams token by token, printed to terminal in real time  
**Max tokens:** 8,000 per generation  
**Temperature:** 0.6 (balanced between creative and consistent)

The model is called kimi-k2.6 as of May 2026. If it stops working with a 410 error, 
check `build.nvidia.com/moonshotai` for the latest available version and update the 
model name in `run.py`.

---

## The Export Process

After generation, `run.py` launches a headless Chromium browser via Playwright.

The browser:
1. Loads the carousel.html file
2. Waits 3 seconds for fonts to load from the Fontshare CDN
3. Finds all elements with `class="slide"`
4. Screenshots each one individually as a PNG

**Resolution scaling:**

The HTML is designed at a small layout width, and `device_scale_factor` scales it up 
to Instagram/LinkedIn resolution without changing the layout.

| Platform  | Layout size | Scale factor | Output size |
|-----------|-------------|--------------|-------------|
| Instagram | 420×525px   | 1080÷420 = 2.571 | 1080×1350px |
| LinkedIn  | 540×540px   | 1080÷540 = 2.0   | 1080×1080px |

This is why the slides look sharp. Setting the viewport to 1080px directly would 
reflow the layout and break everything. The scale factor is the correct approach.

---

## The PDF (LinkedIn only)

LinkedIn carousels are uploaded as PDFs, not image sequences.

The `make_pdf` step uses the `img2pdf` library to combine all PNG slides into a 
single PDF where each page is exactly the image size — zero margins, zero padding.

Do NOT use ilovepdf or any online tool for this. They add margins automatically 
and produce white space on every slide.

---

## How to Run

### Full pipeline — one command

**Biz page, Instagram:**
```
python run.py --biz --post 01
```

**Biz page, LinkedIn (generates + exports + builds PDF):**
```
python run.py --biz --post 01 --linkedin
```

**Personal page:**
```
python run.py --personal --post 01
```

### Individual steps

```
python run.py --biz --post 01 --linkedin --generate    # HTML only
python run.py --biz --post 01 --linkedin --export      # PNGs only
python run.py --biz --post 01 --linkedin --pdf         # PDF only
```

### Post numbering

`--post 01` maps to folder `post_01`.  
`--post 02` maps to folder `post_02`. And so on.

---

## How to Add a New Post

**For biz page:**

1. Create the prompt folder:
   ```
   biz/prompts/post_02/instagram/
   biz/prompts/post_02/linkedin/
   ```

2. Write two files in each platform folder:
   - `carousel_request.txt` — content brief for that specific post
   - `html_request.txt` — design spec (can copy from post_01 and adjust)

3. Run:
   ```
   python run.py --biz --post 02
   python run.py --biz --post 02 --linkedin
   ```

**For personal page:**

1. Create the prompt folder:
   ```
   personal/prompts/post_01/
   ```

2. Write two files:
   - `carousel_request.txt`
   - `html_request.txt`

3. Run:
   ```
   python run.py --personal --post 01
   ```

---

## Platform Differences

| | Biz Instagram | Biz LinkedIn | Personal Instagram |
|---|---|---|---|
| Slides | 6 | 7 | 5–7 |
| Format | 4:5 (420×525px) | Square (540×540px) | 4:5 (420×525px) |
| Output | 1080×1350px PNGs | 1080×1080px PNGs + PDF | 1080×1350px PNGs |
| Voice | Institutional | Institutional + analytical depth | Founder / operator |
| Context loaded | Brand visual system | Brand visual system | Brand visual system + personal voice + carousel context |
| Violet usage | 1 element max per slide | Flow arrows + 1 eyebrow | Per brand palette rules |
| Headline color | White (#F5F5F5) | Gold on slides 3 + 7 | Per prompt |

---

## What Gets Loaded Into Every Generation

`run.py` always loads `context/polynovea_brand_visual_and_content_system_v_1.md` 
as shared brand context. For personal posts it also loads `roys-personal-voice.md` 
and `carousel-content-context.md`.

The carousel_request and html_request for that specific post are loaded on top.

Everything is assembled into one large prompt and sent to Kimi as a single user message.

---

## Common Issues

**410 error from API**
The Kimi model version has been retired. Go to `build.nvidia.com/moonshotai`, 
find the latest available version, and update the model name in `run.py` 
(search for `moonshotai/kimi-k2`).

**Blurry PNGs**
`device_scale_factor` is missing or set to 1. It must be `1080 / layout_width`.

**White space in LinkedIn PDF**
The PDF was made with an external tool (ilovepdf etc.). Always use 
`python run.py --biz --post XX --linkedin --pdf` instead.

**Fonts not loading (headings in wrong font)**
The 3-second wait after page load (`wait_for_timeout(3000)`) is not enough 
if the connection is slow. Increase to 5000ms in `run.py` if this happens.

**No .slide elements found**
Kimi returned HTML but without `class="slide"` on the slide divs. 
Re-run generation — the model occasionally omits class attributes on the first try.

**HTML incomplete (missing body/html tags)**
The model hit the 8,000 token limit before finishing. The prompt may be too large. 
Reduce the length of either prompt file or increase `max_tokens` in `run.py`.
