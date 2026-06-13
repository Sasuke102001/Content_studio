import {
  DEFAULT_CUSTOM_PALETTE,
  type CustomPalette,
  type PalettePresetId
} from './designOptions';

const FONT_LINKS: Record<string, string> = {
  Inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'Clash Display':
    'https://api.fontshare.com/v2/css?f[]=clash-display@300,400,500,600,700&display=swap',
  'Playfair Display':
    'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap',
  'Space Grotesk':
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
  'Cormorant Garamond':
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&display=swap',
  Sora: 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap',
  Manrope:
    'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap'
};

export function resolvePaletteTokens(
  palettePreset: PalettePresetId | string,
  customPalette?: Partial<CustomPalette> | null
) {
  if (palettePreset === 'presentation_light') {
    return {
      bgPrimary: '#F8F6F2',
      bgSecondary: '#EFEAE2',
      surface: '#FFFFFF',
      border: '#D8D0C4',
      textPrimary: '#0A0A0A',
      textSecondary: '#6B7280',
      accentPrimary: '#E6D3A3',
      accentSecondary: '#9A8F6A',
      accentDepth: '#7C3AED'
    };
  }

  if (palettePreset === 'custom') {
    return { ...DEFAULT_CUSTOM_PALETTE, ...(customPalette || {}) };
  }

  return { ...DEFAULT_CUSTOM_PALETTE };
}

export function getFontCssStack(fontName: string, fallback: 'heading' | 'body') {
  const fallbackStacks = {
    heading: 'Georgia, serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  };

  return `'${fontName}', ${fallbackStacks[fallback]}`;
}

export function getFontLinks(fonts: string[]) {
  return Array.from(new Set(fonts))
    .map((font) => FONT_LINKS[font])
    .filter(Boolean);
}

export function buildBlogHtmlTemplate(options: {
  palettePreset: string;
  headingFont: string;
  bodyFont: string;
  customPalette?: Partial<CustomPalette> | null;
}) {
  const tokens = resolvePaletteTokens(options.palettePreset, options.customPalette);
  const fontLinks = getFontLinks([options.headingFont, options.bodyFont]);
  const headingFontStack = getFontCssStack(options.headingFont, 'heading');
  const bodyFontStack = getFontCssStack(options.bodyFont, 'body');
  const headingColor =
    options.palettePreset === 'presentation_light' ? tokens.textPrimary : '#FFFFFF';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog Post Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${fontLinks.map((href) => `<link href="${href}" rel="stylesheet">`).join('\n  ')}
  <style>
    :root {
      --bg-color: ${tokens.bgPrimary};
      --text-color: ${tokens.textPrimary};
      --accent-color: ${tokens.accentDepth};
      --muted-color: ${tokens.textSecondary};
      --card-bg: ${tokens.surface};
      --border-color: ${tokens.border};
      --gold-color: ${tokens.accentPrimary};
      --gold-muted: ${tokens.accentSecondary};
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-color);
      color: var(--text-color);
      font-family: ${bodyFontStack};
      line-height: 1.75;
      font-size: 1.125rem;
      padding: 2rem 1rem;
      display: flex;
      justify-content: center;
    }

    .blog-container {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: ${headingFontStack};
      font-weight: 700;
      color: ${headingColor};
      line-height: 1.3;
      margin-top: 2.5rem;
      margin-bottom: 1rem;
    }

    h1 {
      font-size: 2.5rem;
      margin-top: 1rem;
      margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
    }

    h2 {
      font-size: 1.875rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }

    h3 { font-size: 1.5rem; }

    p { margin-bottom: 1.5rem; font-weight: 400; }

    a {
      color: var(--accent-color);
      text-decoration: none;
      border-bottom: 1px dashed var(--accent-color);
      transition: color 0.2s ease;
    }

    a:hover {
      color: var(--gold-muted);
      border-bottom-style: solid;
    }

    blockquote {
      border-left: 4px solid var(--gold-color);
      padding: 0.5rem 0 0.5rem 1.5rem;
      margin: 2rem 0;
      font-style: italic;
      color: var(--text-color);
      background-color: var(--card-bg);
      border-top-right-radius: 6px;
      border-bottom-right-radius: 6px;
    }

    blockquote p:last-child { margin-bottom: 0; }

    pre, code {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.95rem;
      background-color: var(--card-bg);
      border-radius: 6px;
    }

    code {
      padding: 0.2rem 0.4rem;
      color: var(--accent-color);
    }

    pre {
      padding: 1.25rem;
      overflow-x: auto;
      border: 1px solid var(--border-color);
      margin: 1.5rem 0;
    }

    pre code {
      padding: 0;
      color: inherit;
      background-color: transparent;
      border-radius: 0;
    }

    ul, ol { margin-bottom: 1.5rem; padding-left: 1.75rem; }
    li { margin-bottom: 0.5rem; }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 2rem 0;
      border: 1px solid var(--border-color);
    }

    hr {
      border: 0;
      border-top: 1px solid var(--border-color);
      margin: 3rem 0;
    }
  </style>
</head>
<body>
  <article class="blog-container">
    {blog_content}
  </article>
</body>
</html>`;
}
