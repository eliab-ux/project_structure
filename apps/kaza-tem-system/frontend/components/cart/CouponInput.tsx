'use client';

import { useState } from 'react';
import { Button, Stack, TextField, Typography, Alert } from '@mui/material';

export function CouponInput() {
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleApply() {
    if (!code.trim()) {
      setFeedback('Informe um cupom válido.');
      return;
    }

    setFeedback(`Cupom "${code.trim()}" aplicado com sucesso!`);
  }

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Cupom de desconto</Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          variant="outlined"
          placeholder="EXAMPLE10"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          fullWidth
        />
        <Button variant="outlined" onClick={handleApply}>
          Aplicar
        </Button>
      </Stack>
      {feedback && <Alert severity="success">{feedback}</Alert>}
    </Stack>
  );
}
