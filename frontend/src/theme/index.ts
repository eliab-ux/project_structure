'use client';

import { createTheme } from '@mui/material/styles';

/**
 * A única fonte de cor, forma e tipografia. Componentes leem `theme.palette.*` e nunca escrevem hex
 * (CLAUDE.md, frontend §4) — senão trocar a identidade vira busca-e-substitui em cada arquivo.
 *
 * **Os valores vêm do PROTÓTIPO**, não da minha leitura do §9 da especificação, e a diferença
 * importa. O §9 listava três "neutros frios" e eu os tratei como a escala inteira; o protótipo tem
 * **nove** passos, do mais escuro (`#0d2137`) ao mais claro (`#eaf2fa`) — os três do documento são as
 * posições 400/500/600. O §9 também não trazia o token de texto nem o valor real do painel.
 *
 * ⚠️ **Correção de uma afirmação minha.** Uma versão anterior deste arquivo dizia, com números
 * medidos, que a paleta do §9 "não servia de texto primário" e acrescentava um branco frio inventado
 * (`#e8f1f8`) como conserto. A medição estava certa; a premissa, errada — eu havia suposto o painel
 * como `#103f5f` (que na verdade é `accent-200`), e sobre ele `#8aa3bd` media 4.24 e reprovava. O
 * painel real é `#0a2c4d`, e sobre ele `#8aa3bd` mede **5.44**: passa AA. A paleta do protótipo é
 * consistente, e o token de texto que eu "inventei" já existia nela como `#e6eef7`. Medir com o
 * valor errado dá um número certo sobre a coisa errada.
 *
 * Contraste medido contra os três fundos reais (`#061a30`, `#0b2440`, `#0a2c4d`), critério WCAG AA:
 *
 *   text `#e6eef7`      12.12 – 14.97   texto primário
 *   neutral-600 `#8aa3bd`  5.44 – 6.72   texto secundário — passa em todos
 *   neutral-500 `#5b7794`  3.05 – 3.77   só texto grande → é o `disabled`
 *   neutral-400 `#35506a`  1.69 – 2.09   não serve de texto → é divisória
 *   vx.warn `#f79a3c`      6.51 – 8.05   estado de atenção
 */

/**
 * Tokens que a paleta do MUI não tem lugar para: o painel da Mesa, o estado de atenção e as duas
 * escalas de nove passos.
 *
 * Entram por declaração de módulo, e não como hex solto no `sx`, para que "nunca cor hardcoded"
 * continue valendo para o que o desenho tem de próprio. As escalas ficam acessíveis porque a Mesa usa
 * mais de três tons — cartão sobre painel sobre fundo, com divisória entre eles.
 */
type Ramp = Record<100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;

declare module '@mui/material/styles' {
  interface Palette {
    vx: { panel: string; warn: string; accent: Ramp; neutral: Ramp };
  }
  interface PaletteOptions {
    vx?: { panel: string; warn: string; accent: Ramp; neutral: Ramp };
  }
}

// ── Tokens do protótipo (arquivo "Veertex Tela Inicial v2 -cores Veertex-") ──────────────────────
const BG = '#061a30';
const SURFACE = '#0b2440';
const TEXT = '#e6eef7';
const PANEL = '#0a2c4d';
const WARN = '#f79a3c';

/** Do azul-noite ao ciano claro. `500` é o acento principal. */
const ACCENT: Ramp = {
  100: '#0b2b45',
  200: '#103f5f',
  300: '#17567d',
  400: '#1c8bb4',
  500: '#22b5e0',
  600: '#3fc9f2',
  700: '#74dcf8',
  800: '#a6ebfb',
  900: '#d7f6ff',
};

/** Do fundo mais escuro ao quase-branco frio. `400` é divisória; `600` é texto secundário. */
const NEUTRAL: Ramp = {
  100: '#0d2137',
  200: '#12293f',
  300: '#1a344c',
  400: '#35506a',
  500: '#5b7794',
  600: '#8aa3bd',
  700: '#b3c6da',
  800: '#d2e0ee',
  900: '#eaf2fa',
};

const theme = createTheme({
  palette: {
    // `dark` não é preferência: com `light`, o MUI calcula texto escuro e sombras claras sobre um
    // fundo azul-noite, e cada componente precisaria de correção local.
    mode: 'dark',
    primary: {
      main: ACCENT[200],
      light: ACCENT[300],
      dark: ACCENT[100],
      contrastText: TEXT,
    },
    // O acento ciano é o que chama ação — botão de aprovação, foco, link.
    secondary: {
      main: ACCENT[500],
      light: ACCENT[600],
      dark: ACCENT[400],
      // Texto ESCURO sobre o ciano: ciano é claro, e branco sobre ele reprovaria.
      contrastText: BG,
    },
    background: { default: BG, paper: SURFACE },
    text: { primary: TEXT, secondary: NEUTRAL[600], disabled: NEUTRAL[500] },
    divider: NEUTRAL[400],
    error: { main: '#ff6b6b' },
    warning: { main: WARN },
    success: { main: '#4ecb8f' },
    info: { main: ACCENT[600] },
    vx: { panel: PANEL, warn: WARN, accent: ACCENT, neutral: NEUTRAL },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    // "Tipografia com peso": a hierarquia vem do peso e do tamanho, não de cor. Cor carregando
    // hierarquia sozinha é o que quebra em monocromático e para quem não distingue matiz.
    //
    // A saudação da Mesa é o elemento mais pesado da tela (o protótipo usa um display grande e
    // apertado), então `h1` é grande de verdade e com `letterSpacing` negativo.
    h1: { fontSize: '2.75rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 },
    h2: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontSize: '1.125rem', fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600, color: NEUTRAL[600] },
    // Os rótulos de seção do protótipo são caixa alta, pequenos e espaçados.
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: NEUTRAL[600],
    },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiButton: { defaultProps: { disableElevation: true } },
    // Superfícies sem gradiente: o MUI aplica um `background-image` translúcido em `Paper` no modo
    // escuro, que sobre azul-noite lava a cor e faz painéis vizinhos parecerem tons diferentes.
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'default' },
      styleOverrides: { root: { backgroundColor: SURFACE, backgroundImage: 'none' } },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, color: NEUTRAL[600] },
        root: { borderColor: NEUTRAL[300] },
      },
    },
    MuiChip: { styleOverrides: { outlined: { borderColor: ACCENT[300] } } },
    // Foco visível é requisito de navegação por teclado, e a especificação usa teclado a sério
    // (`⏎` aprova, `Esc` volta).
    MuiCssBaseline: {
      styleOverrides: {
        ':focus-visible': { outline: `2px solid ${ACCENT[500]}`, outlineOffset: 2 },
      },
    },
  },
});

export default theme;
