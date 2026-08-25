'use client';

import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useCheckout } from '@/hooks/useCheckout';

const EMPTY_ADDRESS = {
  street: '',
  number: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'Brasil',
  complement: '',
};

type AddressFormProps = {
  onComplete?: () => void;
};

export function AddressForm({ onComplete }: AddressFormProps) {
  const { shippingAddress, setShippingAddress } = useCheckout();
  const [address, setAddress] = useState(shippingAddress ?? EMPTY_ADDRESS);

  function handleChange(field: keyof typeof EMPTY_ADDRESS, value: string) {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setShippingAddress({
      street: address.street,
      number: address.number,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country,
      complement: address.complement,
    });
    onComplete?.();
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2, p: 3 }}
    >
      <Typography variant="h6" mb={2}>
        Dados de entrega
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="CEP"
          value={address.zipCode}
          required
          onChange={(event) => handleChange('zipCode', event.target.value)}
          fullWidth
        />
        <TextField
          label="Rua"
          value={address.street}
          required
          onChange={(event) => handleChange('street', event.target.value)}
          fullWidth
        />
        <Stack direction="row" spacing={2}>
          <TextField
            label="Número"
            value={address.number}
            required
            onChange={(event) => handleChange('number', event.target.value)}
            fullWidth
          />
          <TextField
            label="Complemento"
            value={address.complement}
            onChange={(event) => handleChange('complement', event.target.value)}
            fullWidth
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Cidade"
            value={address.city}
            required
            onChange={(event) => handleChange('city', event.target.value)}
            fullWidth
          />
          <TextField
            label="Estado"
            value={address.state}
            required
            onChange={(event) => handleChange('state', event.target.value)}
            fullWidth
          />
        </Stack>
        <TextField
          label="País"
          value={address.country}
          onChange={(event) => handleChange('country', event.target.value)}
          fullWidth
        />
        <Button type="submit" variant="contained">
          Salvar endereço
        </Button>
      </Stack>
    </Box>
  );
}
