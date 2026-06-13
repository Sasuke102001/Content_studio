export const PALETTE_PRESETS = [
  {
    id: 'brand_dark',
    label: 'Brand Dark',
    description: 'Primary Polynovea identity for premium, dark-system outputs.'
  },
  {
    id: 'presentation_light',
    label: 'Presentation Light',
    description: 'Readability-first palette for client decks, reports, and decision documents.'
  },
  {
    id: 'custom',
    label: 'Custom Palette',
    description: 'Override the default palette tokens with your own hex values.'
  }
] as const;

export const FONT_OPTIONS = [
  'Clash Display',
  'Inter',
  'Playfair Display',
  'Space Grotesk',
  'Cormorant Garamond',
  'Sora',
  'Manrope'
] as const;

export const DEFAULT_CUSTOM_PALETTE = {
  bgPrimary: '#0A0A0A',
  bgSecondary: '#121212',
  surface: '#18181B',
  border: '#27272A',
  textPrimary: '#F5F5F5',
  textSecondary: '#A1A1AA',
  accentPrimary: '#E6D3A3',
  accentSecondary: '#9A8F6A',
  accentDepth: '#7C3AED'
} as const;

export type PalettePresetId = (typeof PALETTE_PRESETS)[number]['id'];
export type FontOption = (typeof FONT_OPTIONS)[number];

export type CustomPalette = typeof DEFAULT_CUSTOM_PALETTE;

export const FONT_PAIRING_PRESETS = [
  {
    id: 'polynovea_default',
    label: 'Polynovea Default',
    headingFont: 'Clash Display',
    bodyFont: 'Inter',
    description: 'Primary brand pairing from the doctrine.'
  },
  {
    id: 'editorial',
    label: 'Editorial',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Space Grotesk',
    description: 'More magazine-like and presentation-led.'
  },
  {
    id: 'modern_clean',
    label: 'Modern Clean',
    headingFont: 'Sora',
    bodyFont: 'Inter',
    description: 'Clean, sharp, and highly readable.'
  },
  {
    id: 'sharp_minimal',
    label: 'Sharp Minimal',
    headingFont: 'Clash Display',
    bodyFont: 'Manrope',
    description: 'Tighter and more controlled than the default pairing.'
  },
  {
    id: 'custom',
    label: 'Custom Fonts',
    headingFont: 'Clash Display',
    bodyFont: 'Inter',
    description: 'Pick heading and body fonts manually.'
  }
] as const;

export const LAYOUT_DIRECTION_PRESETS = [
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Structured, spacious, magazine-like hierarchy.'
  },
  {
    id: 'framework',
    label: 'Framework',
    description: 'System diagrams, stacks, comparisons, and process logic.'
  },
  {
    id: 'comparison',
    label: 'Comparison',
    description: 'Before/after, versus, tradeoff, and contrast-led layouts.'
  },
  {
    id: 'narrative',
    label: 'Narrative',
    description: 'Progressive storytelling with stronger visual sequencing.'
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Reduced element count, more whitespace, stronger restraint.'
  },
  {
    id: 'custom',
    label: 'Custom Direction',
    description: 'Use your own layout direction instructions.'
  }
] as const;

export const STYLE_STRENGTH_PRESETS = [
  {
    id: 'strict_brand',
    label: 'Strict Brand',
    description: 'Stay tightly inside the Polynovea doctrine.'
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Keep brand guardrails while allowing compositional freedom.'
  },
  {
    id: 'exploratory',
    label: 'Exploratory',
    description: 'Push layout and visual variation while preserving core identity.'
  }
] as const;
