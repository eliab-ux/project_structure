'use client';

import { createTheme } from '@mui/material/styles';

/**
 * The single source of colour and spacing. Components read `theme.palette.*` and never hardcode a
 * hex value (CLAUDE.md, frontend §4) — otherwise a rebrand becomes a search-and-replace across
 * every file instead of an edit here.
 */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1B3A6B', light: '#395F98', dark: '#0F2547', contrastText: '#FFFFFF' },
    secondary: { main: '#F5A623', light: '#FFC155', dark: '#BC7A00', contrastText: '#1A1A1A' },
    background: { default: '#F4F6F8', paper: '#FFFFFF' },
    error: { main: '#C62828' },
    success: { main: '#2E7D32' },
    text: { primary: '#1A2027', secondary: '#5A6672' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    h1: { fontSize: '1.75rem', fontWeight: 700 },
    h2: { fontSize: '1.375rem', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

export default theme;
