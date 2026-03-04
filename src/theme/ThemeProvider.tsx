// ============================================================
// MUI Theme & Emotion Cache for Next.js App Router
// ============================================================

'use client';

import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ReactNode } from 'react';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7c3aed',
      light: '#a78bfa',
      dark: '#5b21b6',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    warning: {
      main: '#f59e0b',
    },
    info: {
      main: '#3b82f6',
    },
    success: {
      main: '#10b981',
    },
    background: {
      default: '#030712',
      paper: '#0f1117',
    },
    divider: 'rgba(55, 65, 81, 0.5)',
    text: {
      primary: '#f9fafb',
      secondary: '#9ca3af',
      disabled: '#4b5563',
    },
  },
  typography: {
    fontFamily: 'var(--font-inter), Inter, system-ui, -apple-system, sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontSize: '0.95rem', color: '#9ca3af' },
    subtitle2: { fontSize: '0.8rem', color: '#6b7280' },
    body2: { fontSize: '0.85rem', color: '#d1d5db' },
    caption: { color: '#6b7280' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
          padding: '10px 24px',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #10b981, #0d9488)',
          boxShadow: '0 4px 14px 0 rgba(16,185,129,0.25)',
          '&:hover': {
            background: 'linear-gradient(135deg, #059669, #0f766e)',
            boxShadow: '0 6px 20px 0 rgba(16,185,129,0.35)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          boxShadow: '0 4px 14px 0 rgba(124,58,237,0.25)',
          '&:hover': {
            background: 'linear-gradient(135deg, #6d28d9, #5b21b6)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#111827',
          borderColor: 'rgba(55, 65, 81, 0.5)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#111827',
          backgroundImage: 'none',
          border: '1px solid rgba(55, 65, 81, 0.5)',
          borderRadius: 20,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0f1117',
          backgroundImage: 'none',
          borderColor: 'rgba(55, 65, 81, 0.5)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          fontWeight: 500,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: 'rgba(17, 24, 39, 0.5)',
            '& fieldset': {
              borderColor: 'rgba(55, 65, 81, 0.7)',
            },
            '&:hover fieldset': {
              borderColor: '#4b5563',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#10b981',
            },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(55, 65, 81, 0.5)',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: 8,
          fontSize: '0.75rem',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: '#1f2937',
        },
        barColorPrimary: {
          background: 'linear-gradient(90deg, #10b981, #14b8a6)',
          borderRadius: 4,
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: 600,
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: '#10b981',
        },
        thumb: {
          boxShadow: '0 0 10px rgba(16,185,129,0.3)',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: '#10b981',
          },
          '&.Mui-checked + .MuiSwitch-track': {
            backgroundColor: '#10b981',
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 14px 0 rgba(0,0,0,0.3)',
        },
      },
    },
  },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: 'punk' }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </AppRouterCacheProvider>
  );
}
