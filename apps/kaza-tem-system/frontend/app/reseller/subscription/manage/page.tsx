'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useCheckout } from '@/hooks/useCheckout';
import {
  cancelSubscription,
  getSubscription,
  SubscriptionDetails,
} from '@/services/subscriptionService';

export default function ResellerSubscriptionManagePage() {
  const { resellerId } = useCheckout();
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<'idle' | 'processing' | 'error' | 'success'>(
    'idle',
  );
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!resellerId) {
      setLoading(false);
      return;
    }

    const activeReseller = resellerId;

    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const data = await getSubscription(activeReseller);
        if (mounted) {
          setSubscription(data);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [resellerId]);

  const handleCancel = async () => {
    if (!subscription) return;
    setActionState('processing');
    try {
      await cancelSubscription(subscription.id);
      setActionState('success');
      setMessage('Assinatura cancelada. Verifique seu e-mail para confirmação.');
      setSubscription(null);
    } catch (error) {
      setActionState('error');
      setMessage(error instanceof Error ? error.message : 'Erro ao cancelar assinatura');
    }
  };

  if (!resellerId) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h5">
          Informe seu cadastro de revendedor para ver a assinatura.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 3, md: 6 } }}>
      <Typography variant="h4" gutterBottom>
        Minha assinatura
      </Typography>
      {message && (
        <Alert severity={actionState === 'error' ? 'error' : 'success'} sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}
      {loading ? (
        <CircularProgress />
      ) : subscription ? (
        <Stack spacing={2} sx={{ maxWidth: 560 }}>
          <Typography>
            Status: <strong>{subscription.status.toUpperCase()}</strong>
          </Typography>
          <Typography>Valor: R$ {subscription.amount.toFixed(2)}</Typography>
          <Typography>
            Próxima cobrança: {new Date(subscription.nextBillingDate).toLocaleDateString()}
          </Typography>
          <Typography>Início: {new Date(subscription.startedAt).toLocaleDateString()}</Typography>
          {subscription.canceledAt && (
            <Typography>
              Cancelemnto: {new Date(subscription.canceledAt).toLocaleDateString()}
            </Typography>
          )}
          <Button
            variant="contained"
            color="error"
            disabled={actionState === 'processing'}
            onClick={handleCancel}
          >
            {actionState === 'processing' ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              'Cancelar assinatura'
            )}
          </Button>
        </Stack>
      ) : (
        <Typography>
          Nenhuma assinatura ativa encontrada.
          <br />
          Vá para criar assinatura para manter a recorrência ativa.
        </Typography>
      )}
    </Box>
  );
}
