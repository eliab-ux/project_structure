'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  listWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
  AdminWithdrawal,
} from '@/services/adminWithdrawalService';
import { formatCurrency, formatDate } from '@/utils/format';
import { StatusBadge } from '@/components/admin/StatusBadge';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Check, Close } from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';

export default function AdminWithdrawalsPage() {
  const { user, accessToken, loading: authLoading } = useAdminAuth();
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [filter, setFilter] = useState<AdminWithdrawal['status']>('requested');
  const [loadingList, setLoadingList] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  const isReady = useMemo(() => !authLoading && !!accessToken, [authLoading, accessToken]);

  useEffect(() => {
    if (isReady) {
      loadWithdrawals();
    }
  }, [isReady, filter]);

  async function loadWithdrawals() {
    if (!accessToken) {
      return;
    }

    setLoadingList(true);
    setGlobalError(null);
    try {
      const data = await listWithdrawals(accessToken, { status: filter });
      setWithdrawals(data);
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao carregar saques');
    } finally {
      setLoadingList(false);
    }
  }

  async function handleApprove(withdrawal: AdminWithdrawal) {
    if (!confirm('Tem certeza que deseja aprovar este saque?') || !accessToken || !user?.id) {
      return;
    }
    setGlobalError(null);
    try {
      await approveWithdrawal(accessToken, withdrawal.id, user.id);
      setGlobalMessage('Saque aprovado! Realize a transferência manualmente e marque como pago.');
      loadWithdrawals();
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao aprovar saque');
    }
  }

  async function handleReject(withdrawal: AdminWithdrawal) {
    if (!confirm('Deseja rejeitar este saque?') || !accessToken || !user?.id) {
      return;
    }
    const reason = prompt('Informe o motivo da rejeição:');
    if (!reason) {
      return;
    }

    setGlobalError(null);
    try {
      await rejectWithdrawal(accessToken, withdrawal.id, user.id, reason);
      setGlobalMessage('Saque rejeitado');
      loadWithdrawals();
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao rejeitar saque');
    }
  }

  async function handleMarkAsPaid(withdrawal: AdminWithdrawal) {
    if (!confirm('Confirmar que o pagamento foi efetuado?') || !accessToken || !user?.id) {
      return;
    }

    setGlobalError(null);
    try {
      await markWithdrawalPaid(accessToken, withdrawal.id, user.id);
      setGlobalMessage('Saque marcado como pago');
      loadWithdrawals();
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : 'Erro ao marcar como pago');
    }
  }

  if (authLoading || !isReady) {
    return (
      <Box sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4">Gestão de Saques</Typography>

        {globalMessage && (
          <Alert severity="success" onClose={() => setGlobalMessage(null)}>
            {globalMessage}
          </Alert>
        )}
        {globalError && (
          <Alert severity="error" onClose={() => setGlobalError(null)}>
            {globalError}
          </Alert>
        )}

        <Tabs
          value={filter}
          onChange={(_, value) => setFilter(value)}
          aria-label="filtros de saques"
        >
          <Tab label="Pendentes" value="requested" />
          <Tab label="Aprovados" value="approved" />
          <Tab label="Pagos" value="paid" />
          <Tab label="Rejeitados" value="rejected" />
        </Tabs>

        {loadingList ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : withdrawals.length === 0 ? (
          <Alert severity="info">Nenhum saque com o filtro atual.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Revendedor</TableCell>
                  <TableCell>Valor</TableCell>
                  <TableCell>Dados bancários</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell>{withdrawal.resellerId}</TableCell>
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
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {withdrawal.status === 'requested' && (
                          <>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleApprove(withdrawal)}
                            >
                              <Check fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleReject(withdrawal)}
                            >
                              <Close fontSize="small" />
                            </IconButton>
                          </>
                        )}
                        {withdrawal.status === 'approved' && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleMarkAsPaid(withdrawal)}
                          >
                            Marcar como pago
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>
    </Container>
  );
}
