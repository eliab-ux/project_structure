import type { ReactNode } from 'react';
import { Providers } from './providers';

export const metadata = {
  title: 'Kaza Tem Imports',
  description: 'Catálogo e dashboard para revendedores do Kaza Tem System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
