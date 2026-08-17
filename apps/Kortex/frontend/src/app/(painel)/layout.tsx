'use client';

import { AppShell } from 'src/components/AppShell';
import { RequireAuth } from 'src/components/RequireAuth';

/**
 * Painel do Administrativo (spec §8). O Modelista não entra aqui — o app dele é `/m`.
 *
 * A restrição real está nos guards do backend; esta só evita mostrar ao Modelista uma tela que
 * lhe devolveria 403 em toda requisição.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allow={['admin', 'owner']}>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
