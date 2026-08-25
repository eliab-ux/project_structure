'use client';

import { Stack, TextField } from '@mui/material';

export interface CardData {
  cardNumber: string;
  holder: string;
  expiration: string;
  securityCode: string;
  brand: string;
}

interface CardFormProps {
  value: CardData;
  onChange: (value: CardData) => void;
}

export function CardForm({ value, onChange }: CardFormProps) {
  function handleChange(field: keyof CardData, fieldValue: string) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <Stack spacing={2}>
      <TextField
        label="Número do cartão"
        value={value.cardNumber}
        onChange={(event) => handleChange('cardNumber', event.target.value)}
        fullWidth
        required
      />
      <TextField
        label="Nome impresso"
        value={value.holder}
        onChange={(event) => handleChange('holder', event.target.value)}
        fullWidth
        required
      />
      <Stack direction="row" spacing={2}>
        <TextField
          label="Validade (MM/AA)"
          value={value.expiration}
          onChange={(event) => handleChange('expiration', event.target.value)}
          fullWidth
          required
        />
        <TextField
          label="CVV"
          value={value.securityCode}
          onChange={(event) => handleChange('securityCode', event.target.value)}
          fullWidth
          required
        />
      </Stack>
      <TextField
        label="Bandeira"
        value={value.brand}
        onChange={(event) => handleChange('brand', event.target.value)}
        fullWidth
        required
      />
    </Stack>
  );
}
