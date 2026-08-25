'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';

interface RejectResellerDialogProps {
  open: boolean;
  resellerName: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function RejectResellerDialog({
  open,
  resellerName,
  onClose,
  onConfirm,
}: RejectResellerDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('Informe um motivo para a rejeição');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Erro ao rejeitar'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Rejeitar cadastro</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>
            Você está prestes a rejeitar o cadastro de <strong>{resellerName}</strong>. Informe o
            motivo para continuar.
          </DialogContentText>
          <TextField
            label="Motivo da rejeição"
            multiline
            minRows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={loading}
            error={!!error}
            helperText={error}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} variant="contained" disabled={loading}>
          {loading ? 'Enviando...' : 'Rejeitar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
