'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  listWithdrawals,
  requestWithdrawal,
  ResellerWithdrawal,
  WithdrawalBankDataPayload,
} from '@/services/withdrawalService';
import api from '@/services/api';
import { useResellerAuth } from '@/hooks/useResellerAuth';

type WithdrawalFormState = WithdrawalBankDataPayload;

const INITIAL_FORM_STATE: WithdrawalFormState = {
  bankName: '',
  bankAgency: '',
  bankAccount: '',
  bankAccountType: '',
  pixKey: '',
};

export default function ResellerWithdrawalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<ResellerWithdrawal[]>([]);
  const [formState, setFormState] = useState<WithdrawalFormState>(INITIAL_FORM_STATE);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [balanceLabel, setBalanceLabel] = useState('R$ 0,00');
  const [submitting, setSubmitting] = useState(false);
  const { reseller, isInitialized } = useResellerAuth();

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!reseller?.id) {
      router.replace('/auth/login');
      return;
    }

    load();
  }, [isInitialized, reseller, router]);

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const [list, dashboard] = await Promise.all([listWithdrawals(), fetchResellerBalance()]);
      setWithdrawals(list);
      setBalanceLabel(dashboard);
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as informações de saque.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchResellerBalance() {
    const response = await api.get<{
      metrics: { commission: string };
    }>('/resellers/dashboard');
    return response.data.metrics.commission;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      await requestWithdrawal(formState);
      setMessage({ type: 'success', text: 'Solicitação registrada. Aguarde aprovação.' });
      setFormState(INITIAL_FORM_STATE);
      await load();
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao solicitar saque.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const hasWithdrawals = withdrawals.length > 0;

  return (
    <Box sx={{ minHeight: '100vh', background: '#F5F5F5', py: 6 }}>
      <Container maxWidth="lg">
        <Stack spacing={4}>
          <Stack spacing={1}>
            <Typography variant="h4">Meus Saques</Typography>
            <Typography color="text.secondary">
              Disponível para solicitar: <strong>{balanceLabel}</strong>
            </Typography>
          </Stack>

          {message && (
            <Alert
              severity={message.type === 'error' ? 'error' : 'success'}
              onClose={() => setMessage(null)}
            >
              {message.text}
            </Alert>
          )}

          <Paper elevation={2} sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={2}>
              <Typography variant="h6">Solicitar saque</Typography>
              <Typography color="text.secondary">
                O saque considera todas as comissões disponíveis e precisa ser aprovado pelo
                administrativo. Valor mínimo: R$ 50,00.
              </Typography>
              <Box component="form" onSubmit={handleSubmit} noValidate>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Banco"
                      value={formState.bankName}
                      fullWidth
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, bankName: event.target.value }))
                      }
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Agência"
                      value={formState.bankAgency}
                      fullWidth
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, bankAgency: event.target.value }))
                      }
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Conta"
                      value={formState.bankAccount}
                      fullWidth
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, bankAccount: event.target.value }))
                      }
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Tipo de conta"
                      value={formState.bankAccountType ?? ''}
                      fullWidth
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          bankAccountType: event.target.value || undefined,
                        }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Chave PIX (opcional)"
                      value={formState.pixKey ?? ''}
                      fullWidth
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          pixKey: event.target.value || undefined,
                        }))
                      }
                    />
                  </Grid>
                </Grid>
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
                  <Button type="submit" variant="contained" disabled={submitting}>
                    {submitting ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      'Solicitar saque'
                    )}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Paper>

          <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" mb={2}>
              Histórico de saques
            </Typography>

            {loading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : !hasWithdrawals ? (
              <Alert severity="info">Nenhum saque registrado até o momento.</Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Valor</TableCell>
                      <TableCell>Banco</TableCell>
                      <TableCell>Data</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell>
                          <strong>{formatCurrency(withdrawal.amount)}</strong>
                        </TableCell>
                        <TableCell>
                          {withdrawal.bankName} · Ag {withdrawal.bankAgency} · Cc{' '}
                          {withdrawal.bankAccount}
                        </TableCell>
                        <TableCell>{formatDate(withdrawal.createdAt)}</TableCell>
                        <TableCell>
                          <StatusBadge status={withdrawal.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
