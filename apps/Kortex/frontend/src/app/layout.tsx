import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, Inter } from 'next/font/google';
import { Providers } from './providers';

/**
 * As três famílias do protótipo. Via `next/font`, os arquivos são baixados no build e servidos
 * pelo próprio domínio — o navegador do usuário nunca fala com o Google, o que evita tanto o
 * request externo quanto o salto de layout do webfont.
 *
 * Archivo → títulos e rótulos · Inter → corpo · IBM Plex Mono → todo número.
 */
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kortex',
  description: 'Venda de hora de máquina de corte de tecido: agenda, reserva e apontamento.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // O app do Modelista é usado de pé, ao lado da máquina; a cor pinta a barra do navegador
  // quando instalado como PWA (spec §8).
  themeColor: '#10233A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${archivo.variable} ${plexMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
