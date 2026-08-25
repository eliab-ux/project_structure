'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  LinearProgress,
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
import { useAdminAuthContext } from '@/contexts/AdminAuthContext';
import {
  AdminResellerDetail,
  reactivateReseller,
  getResellerDetail,
  suspendReseller,
} from '@/services/adminResellerService';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

export default function AdminResellerDetailPage() {
  const { id } = useParams();
  const { accessToken, user } = useAdminAuthContext();
  const [detail, setDetail] = useState<AdminResellerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [suspendReason, setSuspendReason] = useState('Infraestrutura manual');
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    try {
      const payload = await getResellerDetail(accessToken, id);
      setDetail(payload);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    [],
  );

  const handleSuspend = async () => {
    if (!accessToken || !id || !user) return;
    setActionLoading(true);
    try {
      await suspendReseller(accessToken, id, suspendReason);
      setFeedback('Revendedor suspenso');
      fetchDetail();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!accessToken || !id || !user) return;
    setActionLoading(true);
    try {
      await reactivateReseller(accessToken, id);
      setFeedback('Revendedor reativado');
      fetchDetail();
    } finally {
      setActionLoading(false);
    }
  };

  if (!accessToken) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="warning">Faça login como administrador para acessar os dados.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Detalhe do revendedor</Typography>
          <Typography color="text.secondary">
            Dados completos, métricas e histórico de saques para entender o contexto antes de agir.
          </Typography>
        </Box>

        {loading && <LinearProgress />}

        {detail && (
          <>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6">Dados pessoais</Typography>
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    <Typography>
                      <strong>Nome:</strong> {detail.reseller.fullName}
                    </Typography>
                    <Typography>
                      <strong>CPF:</strong> {detail.reseller.cpf}
                    </Typography>
                    <Typography>
                      <strong>Status:</strong>{' '}
                      <Chip label={detail.reseller.status} size="small" color="info" />
                    </Typography>
                    <Typography>
                      <strong>Nível:</strong>{' '}
                      <Chip label={detail.reseller.level} size="small" color="secondary" />
                    </Typography>
                    <Typography>
                      <strong>Telefone:</strong> {detail.reseller.phone ?? '—'}
                    </Typography>
                    <Typography>
                      <strong>Cadastro:</strong>{' '}
                      {new Date(detail.reseller.createdAt).toLocaleString('pt-BR')}
                    </Typography>
                    {detail.reseller.suspendedAt && (
                      <Typography>
                        <strong>Suspenso em:</strong>{' '}
                        {new Date(detail.reseller.suspendedAt).toLocaleString('pt-BR')}
                      </Typography>
                    )}
                    {detail.reseller.suspensionReason && (
                      <Typography>
                        <strong>Motivo da suspensão:</strong> {detail.reseller.suspensionReason}
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6">Dados bancários</Typography>
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    <Typography>
                      <strong>Banco:</strong> {detail.bank.bankName ?? '—'}
                    </Typography>
                    <Typography>
                      <strong>Agência:</strong> {detail.bank.bankAgency ?? '—'}
                    </Typography>
                    <Typography>
                      <strong>Conta:</strong> {detail.bank.bankAccount ?? '—'}
                    </Typography>
                    <Typography>
                      <strong>Tipo:</strong> {detail.bank.bankAccountType ?? '—'}
                    </Typography>
                    <Typography>
                      <strong>Titular:</strong> {detail.bank.bankHolderName ?? '—'}
                    </Typography>
                    <Typography>
                      <strong>CPF titular:</strong> {detail.bank.bankHolderCpf ?? '—'}
                    </Typography>
                    <Typography>
                      <strong>PIX:</strong> {detail.bank.pixKey ?? '—'}{' '}
                      {detail.bank.pixKeyType ? `(${detail.bank.pixKeyType})` : ''}
                    </Typography>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6">Assinatura</Typography>
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    <Typography>
                      <strong>Status:</strong>{' '}
                      {detail.subscription ? detail.subscription.status : 'Nenhuma assinatura'}
                    </Typography>
                    {detail.subscription && (
                      <Typography>
                        <strong>Próximo pagamento:</strong>{' '}
                        {detail.subscription.nextBillingDate
                          ? new Date(detail.subscription.nextBillingDate).toLocaleDateString('pt-BR')
                          : '—'}
                      </Typography>
                    )}
                    <Typography>
                      <strong>Valor:</strong>{' '}
                      {detail.subscription
                        ? currencyFormatter.format(detail.subscription.amount)
                        : '—'}
                    </Typography>
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6">Métricas</Typography>
                  <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Pedidos totais
                      </Typography>
                      <Typography variant="h6">{detail.metrics.totalOrders}</Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Pedidos (30 dias)
                      </Typography>
                      <Typography variant="h6">{detail.metrics.ordersLast30Days}</Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Vendas mensais
                      </Typography>
                      <Typography variant="h6">
                        {currencyFormatter.format(detail.metrics.monthlySales)}
                      </Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Comissões disponíveis
                      </Typography>
                      <Typography variant="h6">
                        {currencyFormatter.format(detail.metrics.balance.available)}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6">Histórico de saques</Typography>
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Valor</TableCell>
                      <TableCell>Solicitado em</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell>{withdrawal.id}</TableCell>
                        <TableCell>{withdrawal.status}</TableCell>
                        <TableCell>{currencyFormatter.format(withdrawal.amount)}</TableCell>
                        <TableCell>
                          {new Date(withdrawal.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!detail.withdrawals.length && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          Nenhum saque solicitado ainda
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Ações administrativas</Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Button
                variant="contained"
                color="error"
                onClick={handleSuspend}
                disabled={actionLoading || !detail || suspendReason.trim().length < 5}
              >
                Suspender
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleReactivate}
                disabled={actionLoading || detail?.reseller.status !== 'suspended'}
              >
                Reativar
              </Button>
            </Stack>
            <TextField
              label="Motivo da suspensão"
              value={suspendReason}
              onChange={(event) => setSuspendReason(event.target.value)}
              helperText="Ao suspender, informe um motivo com pelo menos 5 caracteres."
            />
            {feedback && <Alert severity="success">{feedback}</Alert>}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
