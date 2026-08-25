import '@mui/material/styles';

declare module 'styled-components' {
  export interface DefaultTheme {
    palette: import('@mui/material/styles').Palette;
  }
}
