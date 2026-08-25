'use client';

import { Box, Stack } from '@mui/material';
import { useRouter } from 'next/navigation';
import { CheckoutStepper } from '@/components/checkout/CheckoutStepper';
import { PaymentForm } from '@/components/checkout/PaymentForm';
import { OrderSummary } from '@/components/checkout/OrderSummary';

export default function CheckoutPaymentPage() {
  const router = useRouter();

  return (
    <Box sx={{ p: { xs: 3, md: 6 } }}>
      <CheckoutStepper activeStep={1} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems="flex-start">
        <PaymentForm onComplete={() => router.push('/checkout/review')} />
        <OrderSummary hideItems />
      </Stack>
    </Box>
  );
}
