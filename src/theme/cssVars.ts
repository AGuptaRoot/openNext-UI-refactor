/**
 * Read CRM design tokens from CSS variables (set on :root / html.dark).
 * Used by charts and any non-Tailwind surfaces that need theme-aware colors.
 */

export type CssVarName =
  | '--background'
  | '--foreground'
  | '--card'
  | '--card-foreground'
  | '--muted'
  | '--muted-foreground'
  | '--border'
  | '--input'
  | '--primary'
  | '--primary-foreground'
  | '--secondary'
  | '--secondary-foreground'
  | '--success'
  | '--success-bg'
  | '--success-foreground'
  | '--success-border'
  | '--warning'
  | '--warning-bg'
  | '--warning-foreground'
  | '--warning-border'
  | '--danger'
  | '--danger-bg'
  | '--danger-foreground'
  | '--danger-border'
  | '--chart-grid'
  | '--chart-tick'
  | '--chart-axis'
  | '--chart-tooltip-bg'
  | '--chart-tooltip-fg'
  | '--chart-tooltip-border'
  | '--chart-series-1'
  | '--chart-series-2'
  | '--chart-series-3'
  | '--chart-series-4'
  | '--chart-series-5'
  | '--chart-series-6'
  | '--chart-cursor'
  | '--on-solid';

const FALLBACKS: Record<CssVarName, string> = {
  '--background': '#fafafa',
  '--foreground': '#09090b',
  '--card': '#ffffff',
  '--card-foreground': '#09090b',
  '--muted': '#f4f4f5',
  '--muted-foreground': '#71717a',
  '--border': '#e4e4e7',
  '--input': '#ffffff',
  '--primary': '#09090b',
  '--primary-foreground': '#fafafa',
  '--secondary': '#f4f4f5',
  '--secondary-foreground': '#18181b',
  '--success': '#166534',
  '--success-bg': '#f0fdf4',
  '--success-foreground': '#166534',
  '--success-border': '#bbf7d0',
  '--warning': '#b45309',
  '--warning-bg': '#fffbeb',
  '--warning-foreground': '#92400e',
  '--warning-border': '#fde68a',
  '--danger': '#b91c1c',
  '--danger-bg': '#fef2f2',
  '--danger-foreground': '#991b1b',
  '--danger-border': '#fecaca',
  '--chart-grid': '#f4f4f5',
  '--chart-tick': '#71717a',
  '--chart-axis': '#e4e4e7',
  '--chart-tooltip-bg': '#ffffff',
  '--chart-tooltip-fg': '#09090b',
  '--chart-tooltip-border': '#e4e4e7',
  '--chart-series-1': '#09090b',
  '--chart-series-2': '#52525b',
  '--chart-series-3': '#71717a',
  '--chart-series-4': '#a1a1aa',
  '--chart-series-5': '#d4d4d8',
  '--chart-series-6': '#3f3f46',
  '--chart-cursor': '#f4f4f5',
  '--on-solid': '#ffffff',
};

export function readCssVar(name: CssVarName, el?: Element | null): string {
  if (typeof window === 'undefined') return FALLBACKS[name];
  const target = el || document.documentElement;
  const value = getComputedStyle(target).getPropertyValue(name).trim();
  return value || FALLBACKS[name];
}

export function getChartThemeColors() {
  return {
    grid: readCssVar('--chart-grid'),
    tick: readCssVar('--chart-tick'),
    axis: readCssVar('--chart-axis'),
    tooltipBg: readCssVar('--chart-tooltip-bg'),
    tooltipFg: readCssVar('--chart-tooltip-fg'),
    tooltipBorder: readCssVar('--chart-tooltip-border'),
    cursor: readCssVar('--chart-cursor'),
    series: [
      readCssVar('--chart-series-1'),
      readCssVar('--chart-series-2'),
      readCssVar('--chart-series-3'),
      readCssVar('--chart-series-4'),
      readCssVar('--chart-series-5'),
      readCssVar('--chart-series-6'),
    ],
    foreground: readCssVar('--foreground'),
    mutedForeground: readCssVar('--muted-foreground'),
    card: readCssVar('--card'),
    border: readCssVar('--border'),
  };
}
