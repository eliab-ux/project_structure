'use client';

import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { shippingService, ShippingOption } from '@/services/shippingService';

export function ShippingCalculator() {
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    if (!cep) {
      setError('Informe um CEP válido.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await shippingService.calculate(cep.replace(/\D/g, ''));
      setOptions(result);
    } catch (err) {
      setOptions([]);
      setError(err instanceof Error ? err.message : 'Não foi possível calcular o frete.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2} sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2 }}>
      <Typography variant="subtitle1">Calcular frete</Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          label="CEP de entrega"
          value={cep}
          onChange={(event) => setCep(event.target.value)}
          fullWidth
        />
        <Button variant="contained" onClick={handleCalculate} disabled={loading}>
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Calcular'}
        </Button>
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {options.length > 0 ? (
        <Stack spacing={1}>
          {options.map((option) => (
            <Box key={option.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
              <Typography variant="subtitle2">{option.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {option.company} · {option.deliveryDays} dias úteis
              </Typography>
              <Typography variant="body2">
                {option.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
