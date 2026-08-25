'use client';

import { Chip } from '@mui/material';

const STATUS_COLORS: Record<
  string,
  'default' | 'error' | 'info' | 'primary' | 'success' | 'warning'
> = {
  requested: 'warning',
  approved: 'info',
  paid: 'success',
  rejected: 'error',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Chip label={status.toUpperCase()} color={STATUS_COLORS[status] ?? 'default'} size="small" />
  );
}
