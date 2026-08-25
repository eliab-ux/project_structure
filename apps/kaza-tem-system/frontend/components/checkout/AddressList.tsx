'use client';

import { Card, CardContent, Stack, Typography, Button } from '@mui/material';
import { useCheckout } from '@/hooks/useCheckout';

export function AddressList() {
  const { shippingAddress, setShippingAddress } = useCheckout();

  if (!shippingAddress) {
    return (
      <Stack spacing={1}>
        <Typography variant="subtitle1">Endereços</Typography>
        <Typography color="text.secondary">Nenhum endereço salvo ainda.</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Endereço atual</Typography>
      <Card>
        <CardContent>
          <Typography variant="body1" fontWeight={600}>
            {shippingAddress.street}, {shippingAddress.number}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {shippingAddress.city} · {shippingAddress.state} · CEP {shippingAddress.zipCode}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {shippingAddress.complement ?? 'Sem complemento'}
          </Typography>
          <Button
            size="small"
            sx={{ mt: 1 }}
            onClick={() => setShippingAddress({ ...shippingAddress })}
          >
            Usar este endereço
          </Button>
        </CardContent>
      </Card>
    </Stack>
  );
}
