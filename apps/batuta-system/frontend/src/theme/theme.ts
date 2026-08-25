'use client';

import { createTheme } from '@mui/material/styles';

/**
 * Batuta theme. Never hardcode a colour in a screen — always go through theme.palette.
 * Semantics reserved for the domain: success = chip saudável, warning = degradado,
 * error = falha/banido, info = em aquecimento.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1F3A5F', light: '#3C5C87', dark: '#132741', contrastText: '#FFFFFF' },
    secondary: { main: '#C9A227', contrastText: '#1A1A1A' },
    success: { main: '#2E7D5B' },
    error: { main: '#C0392B' },
    warning: { main: '#D98324' },
    info: { main: '#2C7BB6' },
    background: { default: '#F5F6F8', paper: '#FFFFFF' },
    text: { primary: '#1B1F27', secondary: '#5C6470' },
    divider: 'rgba(27, 31, 39, 0.10)',
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
  shape: { borderRadius: 12 },
  components: {
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid rgba(27, 31, 39, 0.10)', borderRadius: 14 },
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
