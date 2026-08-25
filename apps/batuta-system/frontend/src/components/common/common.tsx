'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

/** Page title plus the actions that belong to the whole page. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        mb: 3,
      }}
    >
      <Box>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {actions ? (
        <Stack direction="row" spacing={1}>
          {actions}
        </Stack>
      ) : null}
    </Box>
  );
}

/** `role="status"` per the accessibility rules in the frontend guidelines. */
export function Loading({ label = 'Carregando' }: { label?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }} role="status" aria-label={label}>
      <CircularProgress />
    </Box>
  );
}

/** `role="alert"` so a screen reader announces a failure instead of leaving it silent. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      role="alert"
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Tentar de novo
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
}

/**
 * The empty state.
 *
 * It takes an action rather than only a sentence, because "nenhum canal cadastrado" with no way forward
 * is a dead end on a screen whose whole purpose is to create the first one.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
      <Typography variant="subtitle1">{title}</Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
          {description}
        </Typography>
      ) : null}
      {action}
    </Box>
  );
}

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  // Channels
  CONNECTED: 'success',
  AWAITING_QR: 'info',
  PROVISIONING: 'info',
  DISCONNECTED: 'warning',
  DEGRADED: 'warning',
  BANNED: 'error',
  RETIRED: 'default',
  // Content and approval
  DRAFT: 'default',
  PENDING_APPROVAL: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  ARCHIVED: 'default',
  PENDING: 'info',
  EXPIRED: 'default',
  INVALIDATED: 'warning',
  // Distribution and dispatch
  PLANNED: 'info',
  RUNNING: 'info',
  PAUSED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
  SENT: 'success',
  FAILED: 'error',
  BLOCKED: 'warning',
  // Inbox
  PENDING_REPLY: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  // Health
  HEALTHY: 'success',
  WATCH: 'warning',
  AT_RISK: 'error',
  STOPPED: 'default',
  // Grey on purpose: "not enough traffic to judge" must not read as good news OR bad news. Amber here
  // would send an operator chasing a chip that has simply not sent enough to be measured yet.
  UNKNOWN: 'default',
};

/**
 * A status, coloured from one table.
 *
 * Centralised so the same word never means two things across screens — an operator who learns that amber
 * is "needs attention" on the channels screen should not find it meaning something else on the inbox.
 * Colours come from the palette, never hardcoded (frontend guidelines §4).
 */
export function StatusChip({
  status,
  size = 'small',
}: {
  status: string;
  size?: 'small' | 'medium';
}) {
  return (
    <Chip
      label={status.replace(/_/g, ' ')}
      color={STATUS_COLORS[status] ?? 'default'}
      size={size}
      variant={STATUS_COLORS[status] ? 'filled' : 'outlined'}
    />
  );
}

/**
 * Confirmation for something irreversible.
 *
 * `confirmationWord` exists for the operations §6.4 and §4 call human-only and terminal — banning a chip,
 * migrating a base, cancelling a running campaign. Typing the word is friction on purpose: those are the
 * actions where "I clicked the wrong button" costs a chip or a mandate's reputation.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  confirmationWord,
  destructive,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmationWord?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');

  const canConfirm =
    !confirmationWord || typed.trim().toUpperCase() === confirmationWord.toUpperCase();

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{description}</DialogContentText>
        <TextField
          label="Motivo (fica na trilha de auditoria)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          fullWidth
          multiline
          minRows={2}
          sx={{ mb: confirmationWord ? 2 : 0 }}
        />
        {confirmationWord ? (
          <TextField
            label={`Digite ${confirmationWord} para confirmar`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            fullWidth
            autoComplete="off"
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button
          onClick={() => onConfirm(reason)}
          disabled={!canConfirm}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Minutes as something a person reads at a glance — the inbox lists ages constantly. */
export function formatAge(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h${minutes % 60 > 0 ? ` ${minutes % 60}min` : ''}`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d${hours % 24 > 0 ? ` ${hours % 24}h` : ''}`;
}

/** A rate as a percentage, or an em dash when there is no sample — "no data" is not "0%". */
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
