'use client';

import { useState } from 'react';
import {
  TextField,
  Button,
  Stack,
  Radio,
  RadioGroup,
  FormControlLabel,
  Alert,
} from '@mui/material';
import { shippingService, ShippingOption } from '@/services/shippingService';

interface ShippingCalculatorProps {
  onSelectOption: (option: ShippingOption) => void;
}

export function ShippingCalculator({ onSelectOption }: ShippingCalculatorProps) {
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState<string | undefined>();

  async function handleCalculate() {
    setLoading(true);
    setError(undefined);
    try {
      const result = await shippingService.calculate(cep);
      setOptions(result);
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : 'Não foi possível calcular o frete no momento.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(optionId: string) {
    setSelected(optionId);
    const option = options.find((o) => o.id === optionId);
    if (option) {
      onSelectOption(option);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          label="CEP"
          value={cep}
          onChange={(e) => setCep(e.target.value)}
          size="small"
          placeholder="00000-000"
        />
        <Button variant="outlined" onClick={handleCalculate} disabled={loading || !cep.trim()}>
          {loading ? 'Calculando...' : 'Calcular'}
        </Button>
      </Stack>

      {options.length > 0 && (
        <RadioGroup value={selected} onChange={(e) => handleSelect(e.target.value)}>
          {options.map((option) => (
            <FormControlLabel
              key={option.id}
              value={option.id}
              control={<Radio />}
              label={`${option.name} · R$ ${option.price.toFixed(2)} · ${option.deliveryDays} dias úteis`}
            />
          ))}
        </RadioGroup>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}
