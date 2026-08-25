'use client';

import { createTheme } from '@mui/material/styles';

/**
 * Tema do Plano Diário — sóbrio e legível. Toda cor de tela sai daqui (theme.palette);
 * nunca hardcodar hex/rgb nos componentes.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1E6F5C', light: '#38907B', dark: '#134A3D', contrastText: '#ffffff' },
    secondary: { main: '#C6803D', contrastText: '#ffffff' },
    success: { main: '#2E9E5B' },
    error: { main: '#C64444' },
    warning: { main: '#D99A2B' },
    info: { main: '#2E7DA8' },
    background: { default: '#F6F7F5', paper: '#FFFFFF' },
    text: { primary: '#1C2622', secondary: '#5E6B66' },
    divider: 'rgba(28, 38, 34, 0.10)',
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
        root: { border: '1px solid rgba(28, 38, 34, 0.10)', borderRadius: 14 },
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
