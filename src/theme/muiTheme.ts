import { createTheme, type Theme } from '@mui/material/styles';

export type CmsThemeMode = 'light' | 'dark';

/**
 * OpenNext CMS Theme — Modern High-Contrast Black & White Design System
 * Light and dark palettes mirror the CMS dashboard toggle.
 */
export function createOpenNextTheme(mode: CmsThemeMode = 'light'): Theme {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#fafafa' : '#09090b',
        dark: isDark ? '#e4e4e7' : '#000000',
        light: isDark ? '#ffffff' : '#27272a',
        contrastText: isDark ? '#09090b' : '#ffffff',
      },
      secondary: {
        main: isDark ? '#a1a1aa' : '#18181b',
        dark: isDark ? '#71717a' : '#09090b',
        light: isDark ? '#d4d4d8' : '#3f3f46',
        contrastText: isDark ? '#09090b' : '#ffffff',
      },
      background: {
        default: isDark ? '#09090b' : '#fafafa',
        paper: isDark ? '#18181b' : '#ffffff',
      },
      text: {
        primary: isDark ? '#fafafa' : '#09090b',
        secondary: isDark ? '#a1a1aa' : '#71717a',
      },
      divider: isDark ? '#27272a' : '#e4e4e7',
      success: {
        main: '#16a34a',
        light: isDark ? '#14532d' : '#f0fdf4',
      },
      warning: {
        main: '#d97706',
        light: isDark ? '#78350f' : '#fffbeb',
      },
      error: {
        main: '#dc2626',
        light: isDark ? '#7f1d1d' : '#fef2f2',
      },
      info: {
        main: isDark ? '#fafafa' : '#09090b',
        light: isDark ? '#27272a' : '#f4f4f5',
      },
    },
    typography: {
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      h1: {
        fontSize: '26px',
        fontWeight: 700,
        color: isDark ? '#fafafa' : '#09090b',
        letterSpacing: '-0.025em',
      },
      h2: {
        fontSize: '20px',
        fontWeight: 600,
        color: isDark ? '#fafafa' : '#09090b',
        letterSpacing: '-0.015em',
      },
      h3: {
        fontSize: '18px',
        fontWeight: 600,
        color: isDark ? '#fafafa' : '#09090b',
        letterSpacing: '-0.01em',
      },
      h6: {
        fontSize: '15px',
        fontWeight: 600,
        color: isDark ? '#fafafa' : '#09090b',
      },
      body1: {
        fontSize: '14px',
        color: isDark ? '#fafafa' : '#09090b',
        lineHeight: 1.5,
      },
      body2: {
        fontSize: '13px',
        color: isDark ? '#a1a1aa' : '#71717a',
        lineHeight: 1.45,
      },
      caption: {
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: isDark ? '#a1a1aa' : '#71717a',
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
            boxShadow: 'none !important',
            transition: 'all 0.15s ease-in-out',
            '&:hover': {
              boxShadow: 'none !important',
            },
          },
          containedPrimary: {
            backgroundColor: isDark ? '#fafafa' : '#09090b',
            color: isDark ? '#09090b' : '#ffffff',
            '&:hover': {
              backgroundColor: isDark ? '#e4e4e7' : '#27272a',
            },
          },
          outlined: {
            borderColor: isDark ? '#3f3f46' : '#e4e4e7',
            color: isDark ? '#fafafa' : '#09090b',
            backgroundColor: isDark ? '#18181b' : '#ffffff',
            '&:hover': {
              borderColor: isDark ? '#fafafa' : '#09090b',
              backgroundColor: isDark ? '#27272a' : '#f4f4f5',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#18181b' : '#ffffff',
            border: isDark ? '1px solid #27272a' : '1px solid #e4e4e7',
            borderRadius: 12,
            boxShadow: 'none !important',
            transition: 'border-color 0.15s ease-in-out',
            '&:hover': {
              borderColor: isDark ? '#52525b' : '#a1a1aa',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: 'none !important',
            backgroundImage: 'none',
          },
          outlined: {
            borderColor: isDark ? '#27272a' : '#e4e4e7',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: isDark ? '1px solid #27272a' : '1px solid #e4e4e7',
            boxShadow: 'none !important',
            backgroundColor: isDark ? '#18181b' : '#ffffff',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            borderRadius: 6,
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            '&.Mui-checked': {
              color: isDark ? '#fafafa' : '#09090b',
              '& + .MuiSwitch-track': {
                backgroundColor: isDark ? '#fafafa' : '#09090b',
                opacity: 1,
              },
            },
          },
          track: {
            backgroundColor: isDark ? '#3f3f46' : '#e4e4e7',
            opacity: 1,
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#27272a' : '#e4e4e7',
            borderRadius: 4,
          },
          bar: {
            backgroundColor: isDark ? '#fafafa' : '#09090b',
            borderRadius: 4,
          },
        },
      },
    },
  });
}

/** @deprecated Prefer createOpenNextTheme(mode) — kept for static imports. */
export const openNextTheme = createOpenNextTheme('light');
