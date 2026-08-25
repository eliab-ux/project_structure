'use client';

import { Stack, Typography, Card, CardContent } from '@mui/material';
import { ShippingCalculator } from '@/components/shipping/ShippingCalculator';
import { useCheckout } from '@/hooks/useCheckout';

export function ShippingOptions() {
  const { shippingOption, setShippingOption } = useCheckout();

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Frete</Typography>
      <ShippingCalculator onSelectOption={(option) => setShippingOption(option)} />
      {shippingOption && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600}>
              {shippingOption.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {shippingOption.company} · {shippingOption.deliveryDays} dias úteis
            </Typography>
            <Typography variant="h6" mt={1}>
              R$ {shippingOption.price.toFixed(2)}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
