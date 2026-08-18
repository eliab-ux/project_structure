/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Empacota o servidor com apenas as dependências que ele realmente usa, em
   * `.next/standalone`. É o que permite a imagem de runtime não carregar o `node_modules` do
   * monorepo inteiro — que aqui inclui MUI, Emotion e o toolchain dos outros apps.
   */
  output: 'standalone',
  /** O `standalone` precisa saber onde é a raiz do monorepo para rastrear o que copiar. */
  outputFileTracingRoot: require('path').join(__dirname, '../../../'),
  /**
   * Lint NÃO roda no build de produção.
   *
   * O `next build` chama o ESLint por padrão, e o ESLint deste projeto carrega o Prettier — cuja
   * configuração (`.prettierrc`) vive na RAIZ do monorepo e não entra na imagem. Sem ela o
   * Prettier volta ao default (aspas duplas) e reprova o arquivo inteiro: um deploy quebrando por
   * causa de aspas.
   *
   * Copiar o `.prettierrc` resolveria o sintoma e manteria o problema de fundo: build de imagem
   * refazendo uma verificação de ESTILO. O gate de lint é `npm run lint` no repositório, com
   * `--max-warnings=0`, antes de publicar o espelho. **A checagem de tipos continua ligada** — ela
   * é do `tsc`, não do ESLint, e essa sim pode quebrar em produção.
   */
  eslint: { ignoreDuringBuilds: true },
  modularizeImports: {
    '@mui/icons-material': {
      transform: '@mui/icons-material/{{member}}',
    },
  },
};

module.exports = nextConfig;
