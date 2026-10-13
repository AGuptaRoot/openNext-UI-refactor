import { createTheme } from '@mui/material/styles';

/**
 * OpenNext CMS Theme — Modern High-Contrast Black & White Design System
 * Inspired by shadcn / Radix / Vercel style clean enterprise UI.
 */
export const openNextTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#09090b', // Solid Deep Black
      dark: '#000000',
      light: '#27272a',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#18181b',
      dark: '#09090b',
      light: '#3f3f46',
      contrastText: '#ffffff',
    },
    background: {
      default: '#fafafa', // Clean muted canvas
      paper: '#ffffff',   // Pure white surfaces
    },
    text: {
      primary: '#09090b',
      secondary: '#71717a',
    },
    divider: '#e4e4e7',
    success: {
      main: '#16a34a',
      light: '#f0fdf4',
    },
    warning: {
      main: '#d97706',
      light: '#fffbeb',
    },
    error: {
      main: '#dc2626',
      light: '#fef2f2',
    },
    info: {
      main: '#09090b',
      light: '#f4f4f5',
    },
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    h1: {
      fontSize: '26px',
      fontWeight: 700,
      color: '#09090b',
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '20px',
      fontWeight: 600,
      color: '#09090b',
      letterSpacing: '-0.015em',
    },
    h3: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#09090b',
      letterSpacing: '-0.01em',
    },
    h6: {
      fontSize: '15px',
      fontWeight: 600,
      color: '#09090b',
    },
    body1: {
      fontSize: '14px',
      color: '#09090b',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '13px',
      color: '#71717a',
      lineHeight: 1.45,
    },
    caption: {
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: '#71717a',
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
          backgroundColor: '#09090b',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#27272a',
          },
        },
        outlined: {
          borderColor: '#e4e4e7',
          color: '#09090b',
          backgroundColor: '#ffffff',
          '&:hover': {
            borderColor: '#09090b',
            backgroundColor: '#f4f4f5',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          border: '1px solid #e4e4e7',
          borderRadius: 12,
          boxShadow: 'none !important',
          transition: 'border-color 0.15s ease-in-out',
          '&:hover': {
            borderColor: '#a1a1aa',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: 'none !important',
        },
        outlined: {
          borderColor: '#e4e4e7',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: '1px solid #e4e4e7',
          boxShadow: 'none !important',
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
            color: '#09090b',
            '& + .MuiSwitch-track': {
              backgroundColor: '#09090b',
              opacity: 1,
            },
          },
        },
        track: {
          backgroundColor: '#e4e4e7',
          opacity: 1,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: '#e4e4e7',
          borderRadius: 4,
        },
        bar: {
          backgroundColor: '#09090b',
          borderRadius: 4,
        },
      },
    },
  },
});
