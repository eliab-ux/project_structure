'use client';

import { Stack, Typography, Divider, Button } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { useCheckout } from '@/hooks/useCheckout';

export function CartSummary() {
  const router = useRouter();
  const { subtotal, itemCount } = useCart();
  const { shippingOption } = useCheckout();
  const total = subtotal + (shippingOption?.price ?? 0);

  return (
    <Stack spacing={2} sx={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2, p: 3 }}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="subtitle2">Subtotal</Typography>
        <Typography variant="subtitle2">R$ {subtotal.toFixed(2)}</Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2">Frete</Typography>
        <Typography variant="body2">
          {shippingOption
            ? `${shippingOption.name} · R$ ${shippingOption.price.toFixed(2)}`
            : 'Pendente'}
        </Typography>
      </Stack>
      <Divider />
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="h6">Total</Typography>
        <Typography variant="h6">R$ {total.toFixed(2)}</Typography>
      </Stack>
      <Button
        variant="contained"
        size="large"
        fullWidth
        disabled={itemCount === 0}
        onClick={() => router.push('/checkout/address')}
      >
        Ir para checkout
      </Button>
    </Stack>
  );
}
