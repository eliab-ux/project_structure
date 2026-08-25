import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Plano Diário — envio automático do plano de leitura',
  description:
    'Envia todos os dias, no horário escolhido, o link do vídeo do plano de leitura bíblica no seu grupo de WhatsApp.',
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
