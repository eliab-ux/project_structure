'use client';

import { Card, CardContent, Divider, Stack, Typography } from '@mui/material';
import { useCart } from '@/hooks/useCart';
import { useCheckout } from '@/hooks/useCheckout';

interface OrderSummaryProps {
  hideItems?: boolean;
}

export function OrderSummary({ hideItems }: OrderSummaryProps) {
  const { items, subtotal } = useCart();
  const { shippingOption, paymentMethod } = useCheckout();
  const shippingPrice = shippingOption?.price ?? 0;
  const total = subtotal + shippingPrice;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Resumo do pedido
        </Typography>
        {!hideItems && (
          <Stack spacing={1} mb={2}>
            {items.map((item) => (
              <Typography key={item.productId} variant="body2">
                {item.quantity} x {item.name} · R$ {item.price.toFixed(2)}
              </Typography>
            ))}
          </Stack>
        )}

        <Divider sx={{ mb: 2 }} />

        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between">
            <Typography>Subtotal</Typography>
            <Typography>R$ {subtotal.toFixed(2)}</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography>Frete</Typography>
            <Typography>R$ {shippingPrice.toFixed(2)}</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle1">Total</Typography>
            <Typography variant="subtitle1">R$ {total.toFixed(2)}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Pagamento: {paymentMethod?.brand ?? 'Não definido'}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
