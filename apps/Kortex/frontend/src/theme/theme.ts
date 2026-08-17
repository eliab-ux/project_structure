'use client';

import { createTheme } from '@mui/material/styles';

/**
 * Tema do Kortex — tokens extraídos do `:root` dos protótipos
 * (`Requisitos/kortex_prototipo_admin.html` e `kortex_prototipo_modelista.html`, idênticos nos
 * dois). Nunca hardcode cor numa tela: sempre via `theme.palette`.
 *
 * Mapa token → palette, para conferência contra o protótipo:
 *
 *   --ink     #10233A → primary.main + text.primary   (o botão primário `.b` é ink, não azul)
 *   --ink-2   #1D3A5C → primary.light
 *   --cut     #1E63D0 → info.main       (azul de reserva: eyebrow, legend, card de hora vendida)
 *   --live    #F04E23 → error + warning (ver nota abaixo)
 *   --ok      #17876B → success.main
 *   --slate   #6B7A8C → text.secondary
 *   --paper   #F1F3EF → background.default
 *   --paper-2 #FFFFFF → background.paper
 *   --line    #CFD6D0 → divider
 *
 * `error` e `warning` compartilham `--live` de propósito: a paleta do protótipo tem UMA cor de
 * alerta, usada tanto para o urgente ("ao vivo", excedente, pagamento em risco) quanto para o
 * erro. Inventar um segundo tom aqui faria as telas divergirem do protótipo já na primeira.
 */

/** Fontes carregadas em `app/layout.tsx` via next/font (self-hosted, sem request externo). */
const FONT_SANS = 'var(--font-inter), Inter, system-ui, sans-serif';
const FONT_DISPLAY = 'var(--font-archivo), Archivo, system-ui, sans-serif';
export const FONT_MONO = 'var(--font-mono), "IBM Plex Mono", ui-monospace, monospace';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#10233A', light: '#1D3A5C', dark: '#0A1727', contrastText: '#FFFFFF' },
    secondary: { main: '#6B7A8C', contrastText: '#FFFFFF' },
    info: { main: '#1E63D0', light: '#E8EFFB', contrastText: '#FFFFFF' },
    success: { main: '#17876B', light: '#E6F2EE', contrastText: '#FFFFFF' },
    error: { main: '#F04E23', light: '#FDEEE9', contrastText: '#FFFFFF' },
    warning: { main: '#F04E23', light: '#FDEEE9', contrastText: '#FFFFFF' },
    background: { default: '#F1F3EF', paper: '#FFFFFF' },
    text: { primary: '#10233A', secondary: '#6B7A8C' },
    divider: '#CFD6D0',
  },
  typography: {
    fontFamily: FONT_SANS,
    // Títulos em Archivo, com o letter-spacing negativo do protótipo — é o que dá a compressão
    // característica dos cabeçalhos.
    h1: {
      fontFamily: FONT_DISPLAY,
      fontWeight: 800,
      fontSize: '2.5rem',
      letterSpacing: '-0.03em',
      lineHeight: 1,
    },
    h2: {
      fontFamily: FONT_DISPLAY,
      fontWeight: 700,
      fontSize: '1.375rem',
      letterSpacing: '-0.02em',
    },
    h3: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '1.1875rem' },
    h4: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '0.9375rem' },
    h5: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '0.875rem' },
    h6: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '0.8125rem' },
    // `overline` é o "eyebrow" do protótipo: rótulo de seção e de campo de formulário.
    overline: {
      fontFamily: FONT_DISPLAY,
      fontWeight: 700,
      fontSize: '0.625rem',
      letterSpacing: '0.11em',
      textTransform: 'uppercase',
      lineHeight: 1.6,
    },
    button: { fontFamily: FONT_DISPLAY, textTransform: 'none', fontWeight: 700 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: 'antialiased' },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { border: '1px solid #CFD6D0', borderRadius: 12 } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, variant: 'contained' },
      styleOverrides: {
        root: {
          borderRadius: 9,
          // O app do Modelista é usado de pé, ao lado da máquina: alvo de toque ≥ 56 px na
          // superfície /m (spec §8). 44 é o piso do painel desktop; as telas do Modelista sobem
          // isso no próprio componente.
          minHeight: 44,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        // Cabeçalho de tabela do protótipo: Archivo minúsculo, caixa alta, régua grossa embaixo.
        head: {
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: '0.625rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#6B7A8C',
          borderBottom: '2px solid #10233A',
        },
      },
    },
  },
});

/**
 * Estilo de todo número que o usuário lê como número: cronômetro, valor em dinheiro, contagem de
 * peças, horário na grade. `tabular-nums` não é preferência — sem ele o cronômetro da tela de
 * matriz treme a cada segundo, porque cada dígito tem largura própria (spec §8).
 */
export const numericSx = {
  fontFamily: FONT_MONO,
  fontVariantNumeric: 'tabular-nums',
} as const;
