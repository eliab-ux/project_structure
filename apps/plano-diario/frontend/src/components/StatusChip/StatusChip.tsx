'use client';

import Chip from '@mui/material/Chip';

const LABELS: Record<
  string,
  { label: string; color: 'success' | 'warning' | 'error' | 'default' | 'info' }
> = {
  connected: { label: 'Conectado', color: 'success' },
  connecting: { label: 'Conectando', color: 'warning' },
  pending_qr: { label: 'Aguardando QR', color: 'warning' },
  disconnected: { label: 'Desconectado', color: 'error' },
  error: { label: 'Erro', color: 'error' },
  sent: { label: 'Enviado', color: 'success' },
  pending: { label: 'Pendente', color: 'info' },
  failed: { label: 'Falhou', color: 'error' },
  skipped: { label: 'Ignorado', color: 'default' },
};

/** Estado em forma e cor, não só texto — o que precisa de atenção se vê de relance. */
export function StatusChip({ status }: { status: string | null }) {
  if (!status) {
    return <Chip size="small" label="Não conectado" variant="outlined" />;
  }
  const config = LABELS[status] ?? { label: status, color: 'default' as const };
  return <Chip size="small" label={config.label} color={config.color} />;
}
