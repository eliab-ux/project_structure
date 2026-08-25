'use client';

import { Box, Stack, Typography } from '@mui/material';
import { CartItems } from '@/components/cart/CartItems';
import { CartSummary } from '@/components/cart/CartSummary';
import { CouponInput } from '@/components/cart/CouponInput';
import { ShippingCalculator } from '@/components/shipping/ShippingCalculator';
import { useCart } from '@/hooks/useCart';
import { useCheckout } from '@/hooks/useCheckout';

export default function CartPage() {
  const { items } = useCart();
  const { setShippingOption } = useCheckout();

  return (
    <Box sx={{ p: { xs: 3, md: 6 } }}>
      <Typography variant="h4" gutterBottom>
        Meu carrinho
      </Typography>
      <Typography color="text.secondary" gutterBottom>
        {items.length} item(s) selecionado(s)
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems="flex-start">
        <Stack spacing={3} flex={2}>
          <CartItems />
          <CouponInput />
          <ShippingCalculator onSelectOption={(option) => setShippingOption(option)} />
        </Stack>
        <CartSummary />
      </Stack>
    </Box>
  );
}
