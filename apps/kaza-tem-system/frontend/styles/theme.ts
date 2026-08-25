import { createTheme } from '@mui/material/styles';
import { DefaultTheme } from 'styled-components';

export const muiTheme = createTheme({
  palette: {
    primary: {
      main: '#FFE600',
      dark: '#F2C94C',
      contrastText: '#000',
    },
    secondary: {
      main: '#3483FA',
      contrastText: '#fff',
    },
    success: {
      main: '#00A650',
    },
    error: {
      main: '#F23D4F',
    },
    background: {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: "'Roboto', 'Segoe UI', sans-serif",
    h1: {
      fontSize: 28,
      fontWeight: 700,
    },
    h2: {
      fontSize: 24,
      fontWeight: 700,
    },
    body1: {
      fontSize: 14,
    },
  },
  shape: {
    borderRadius: 6,
  },
});

export const styledTheme: DefaultTheme = {
  palette: muiTheme.palette,
};
