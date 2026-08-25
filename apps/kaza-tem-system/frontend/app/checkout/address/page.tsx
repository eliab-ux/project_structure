'use client';

import { Box, Stack } from '@mui/material';
import { useRouter } from 'next/navigation';
import { CheckoutStepper } from '@/components/checkout/CheckoutStepper';
import { AddressForm } from '@/components/checkout/AddressForm';
import { AddressList } from '@/components/checkout/AddressList';
import { CartSummary } from '@/components/cart/CartSummary';

export default function CheckoutAddressPage() {
  const router = useRouter();

  return (
    <Box sx={{ p: { xs: 3, md: 6 } }}>
      <CheckoutStepper activeStep={0} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems="flex-start">
        <Stack spacing={3} flex={2}>
          <AddressForm onComplete={() => router.push('/checkout/payment')} />
          <AddressList />
        </Stack>
        <CartSummary />
      </Stack>
    </Box>
  );
}
