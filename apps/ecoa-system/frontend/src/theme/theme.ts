'use client';

import { createTheme } from '@mui/material/styles';

/**
 * Ecoa cockpit theme — clean, modern, data-driven. Cor com intenção: verde/vermelho para
 * variação, roxo (marca) para destaque das detecções da minha lista. Nunca usar cor hardcoded
 * nas telas — sempre via theme.palette.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6C5CE7', light: '#8577ED', dark: '#4B3FC4', contrastText: '#ffffff' },
    secondary: { main: '#00B894', contrastText: '#ffffff' },
    success: { main: '#00B894' },
    error: { main: '#E74C6B' },
    warning: { main: '#F39C12' },
    info: { main: '#3498DB' },
    background: { default: '#F4F5FB', paper: '#FFFFFF' },
    text: { primary: '#1A1B2E', secondary: '#6B6E82' },
    divider: 'rgba(26, 27, 46, 0.08)',
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontSize: '1.3rem', fontWeight: 700 },
    h4: { fontSize: '1.1rem', fontWeight: 700 },
    h5: { fontSize: '1rem', fontWeight: 700 },
    h6: { fontSize: '0.95rem', fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid rgba(26, 27, 46, 0.08)',
          borderRadius: 16,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
    },
  },
});
