'use client';

import Link from 'next/link';
import { Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useCheckout } from '@/hooks/useCheckout';

export default function CheckoutSuccessPage() {
  const { orderId, shippingOption } = useCheckout();

  return (
    <Stack spacing={3} sx={{ p: { xs: 3, md: 6 } }}>
      <Typography variant="h4">Pedido confirmado</Typography>
      <Typography>
        Obrigado por comprar com a Kaza Tem. O número do pedido é {orderId ?? '—'}.
      </Typography>
      {shippingOption && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1">Frete escolhido</Typography>
            <Typography>
              {shippingOption.name} · R$ {shippingOption.price.toFixed(2)} ·{' '}
              {shippingOption.deliveryDays} dias úteis
            </Typography>
          </CardContent>
        </Card>
      )}
      <Button component={Link} href="/products" variant="contained" size="large">
        Voltar ao catálogo
      </Button>
    </Stack>
  );
}
