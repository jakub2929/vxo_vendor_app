// Canonical color tokens — verified against assets/figma-refs/DESIGN.md §2.1,
// assets/figma-refs/tokens/tokens.ts, and Figma MCP on node 4:10411.
export const colors = {
  brand: {
    primary: '#246bfd',
    dark: '#003290',
    primaryGlow: '#246bfd40',
    surfaceTint: '#e9f0ff',
    headerGradient: ['#246BFD', '#5089FF'] as const,
  },
  accent: {
    orange: '#ff981f',
    teal: '#009689',
    purple: '#9d28ac',
    indigo: '#615efc',
  },
  status: {
    success: '#4aaf57',
    successAlt: '#34a853',
    danger: '#e31d1c',
    dangerAlt: '#ff0000',
    warning: '#fbbc05',
    warningAlt: '#ffc02d',
  },
  text: {
    primary: '#212121',
    secondary: '#757575',
    tertiary: '#9e9e9e',
    placeholder: '#bdbdbd',
  },
  surface: {
    base: '#ffffff',
    muted: '#f5f5f5',
    mutedAlt: '#fafafa',
  },
  divider: {
    base: '#e0e0e0',
    soft: '#eeeeee',
  },
} as const;
