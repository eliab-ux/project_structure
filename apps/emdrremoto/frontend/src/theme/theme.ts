'use client';

import { createTheme } from '@mui/material/styles';

/**
 * EMDR Remoto theme — calmo e clínico, adequado a um contexto terapêutico.
 * Azul-esverdeado sereno como marca; contraste alto para legibilidade durante a sessão.
 * Nunca usar cor hardcoded nas telas — sempre via theme.palette.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2C7A7B', light: '#4FA3A4', dark: '#1D5253', contrastText: '#ffffff' },
    secondary: { main: '#5A67D8', contrastText: '#ffffff' },
    success: { main: '#2F9E44' },
    error: { main: '#E03131' },
    warning: { main: '#F08C00' },
    info: { main: '#1C7ED6' },
    background: { default: '#F5F8F8', paper: '#FFFFFF' },
    text: { primary: '#1A2B2B', secondary: '#5B6B6B' },
    divider: 'rgba(26, 43, 43, 0.08)',
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontSize: '1.3rem', fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 14 },
});
