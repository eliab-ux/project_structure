import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'EMDR Remoto — Sessões de terapia à distância',
  description:
    'Plataforma de telemedicina para sessões de EMDR remotas: vídeo, estímulo bilateral sincronizado e chat entre psicólogo e paciente.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
