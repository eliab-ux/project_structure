'use client';

import { useState } from 'react';
import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { CheckoutStepper } from '@/components/checkout/CheckoutStepper';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { ShippingOptions } from '@/components/checkout/ShippingOptions';
import { useCart } from '@/hooks/useCart';
import { useCheckout } from '@/hooks/useCheckout';
import { createOrder, processPayment } from '@/services/orderService';
import { useAuth } from '@/hooks/useAuth';

function formatExpiration(value: string) {
  if (value.includes('/')) {
    const [month, year] = value.split('/');
    if (year.length === 2) {
      return `${month}/20${year}`;
    }
  }
  return value;
}

export default function CheckoutReviewPage() {
  const { items, clearCart } = useCart();
  const { shippingAddress, shippingOption, paymentMethod, setOrderId, resellerId } = useCheckout();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | undefined>();
  const { user, reseller } = useAuth();

  async function handleConfirm() {
    if (!shippingAddress) {
      setStatus('error');
      setMessage('Informe o endereço antes de confirmar o pedido.');
      return;
    }
    if (!paymentMethod) {
      setStatus('error');
      setMessage('Informe o pagamento antes de confirmar o pedido.');
      return;
    }
    if (items.length === 0) {
      setStatus('error');
      setMessage('Adicione itens ao carrinho antes de confirmar.');
      return;
    }

    if (!user) {
      setStatus('error');
      setMessage('Faça login para concluir a compra.');
      return;
    }

    setStatus('processing');
    setMessage('Processando pedido...');

    try {
      const payload = {
        userId: user.id,
        resellerId: resellerId ?? reseller?.id ?? null,
        items: items.map((item) => ({
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        shippingAddress,
        shippingMethod: shippingOption?.name ?? null,
        shippingCost: shippingOption?.price ?? 0,
        discount: 0,
      };

      const order = await createOrder(payload);

      await processPayment(order.id, {
        installments: paymentMethod.installments,
        card: {
          number: paymentMethod.cardNumber.replace(/\s+/g, ''),
          holder: paymentMethod.holder,
          expirationDate: formatExpiration(paymentMethod.expiration),
          securityCode: paymentMethod.securityCode,
          brand: paymentMethod.brand,
        },
        customer: {
          name: user.name,
          email: user.email,
          document: '00000000000',
        },
        amount: Math.round(order.total * 100),
      });

      setOrderId(order.id);
      clearCart();
      setStatus('success');
      setMessage('Pagamento confirmado! Redirecionando...');
      setTimeout(() => router.push('/checkout/success'), 1200);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Erro ao processar o pedido.');
    }
  }

  const isProcessing = status === 'processing';

  return (
    <Stack spacing={3} sx={{ p: { xs: 3, md: 6 } }}>
      <CheckoutStepper activeStep={2} />
      {message && <Alert severity={status === 'error' ? 'error' : 'success'}>{message}</Alert>}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems="flex-start">
        <Stack spacing={2} flex={2}>
          <Typography variant="h5">Revisão</Typography>
          <OrderSummary />
          <ShippingOptions />
        </Stack>
        <Stack spacing={2}>
          <Typography variant="h6">Resumo rápido</Typography>
          <OrderSummary hideItems />
        </Stack>
      </Stack>
      <Button
        variant="contained"
        size="large"
        onClick={handleConfirm}
        disabled={items.length === 0 || isProcessing}
      >
        {isProcessing ? <CircularProgress size={20} color="inherit" /> : 'Confirmar pedido'}
      </Button>
    </Stack>
  );
}
