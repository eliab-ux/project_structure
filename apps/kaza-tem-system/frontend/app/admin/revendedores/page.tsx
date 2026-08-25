'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Paper,
  Pagination,
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
  AdminResellerSummary,
  approveReseller,
  getResellerDetail,
  listResellers,
  rejectReseller,
} from '@/services/adminResellerService';

const statusOptions = [
  { label: 'Todos', value: undefined },
  { label: 'Aguardando', value: 'pending' },
  { label: 'Ativos', value: 'active' },
  { label: 'Suspensos', value: 'suspended' },
  { label: 'Rejeitados', value: 'rejected' },
];

const levelOptions = [
  { label: 'Todos', value: undefined },
  { label: 'Bronze', value: 'bronze' },
  { label: 'Prata', value: 'prata' },
  { label: 'Ouro', value: 'ouro' },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | Date | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusColor(status?: string) {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'active':
      return 'success';
    case 'suspended':
      return 'default';
    case 'rejected':
      return 'error';
    default:
      return 'default';
  }
}

export default function AdminResellersPage() {
  const { accessToken, user } = useAdminAuthContext();
  const [resellers, setResellers] = useState<AdminResellerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [levelFilter, setLevelFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [selectedReseller, setSelectedReseller] = useState<AdminResellerSummary | null>(null);
  const [resellerDetail, setResellerDetail] = useState<AdminResellerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ message: string; severity: 'success' | 'error' } | null>(
    null,
  );
  const [rejecting, setRejecting] = useState(false);

  const limit = 15;

  const pendingCount = useMemo(
    () => resellers.filter((reseller) => reseller.status === 'pending').length,
    [resellers],
  );

  const fetchData = useCallback(async () => {
    if (!accessToken) {
      setResellers([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const result = await listResellers(accessToken, {
        status: statusFilter,
        level: levelFilter,
        search: search.trim(),
        limit,
        offset: (page - 1) * limit,
      });
      setResellers(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter, levelFilter, search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!selectedReseller || !accessToken) {
      setResellerDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    getResellerDetail(accessToken, selectedReseller.id)
      .then((detail) => {
        if (active) {
          setResellerDetail(detail);
        }
      })
      .catch(() => {
        if (active) {
          setResellerDetail(null);
        }
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedReseller, accessToken]);

  const openAnalysisDialog = (reseller: AdminResellerSummary) => {
    setSelectedReseller(reseller);
    setRejectReason('');
  };

  const closeAnalysisDialog = () => {
    setSelectedReseller(null);
    setResellerDetail(null);
    setRejectReason('');
    setRejectDialogOpen(false);
  };

  const handleApprove = async () => {
    if (!accessToken || !user?.id || !selectedReseller) return;
    setAnalysisLoading(true);
    try {
      await approveReseller(accessToken, selectedReseller.id, user.id);
      setActionFeedback({ message: 'Cadastro aprovado com sucesso.', severity: 'success' });
      closeAnalysisDialog();
      fetchData();
    } catch (error: any) {
      setActionFeedback({ message: error?.message ?? 'Erro ao aprovar cadastro', severity: 'error' });
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleOpenReject = () => {
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!accessToken || !selectedReseller || rejectReason.trim().length < 10) return;
    setRejecting(true);
    try {
      await rejectReseller(accessToken, selectedReseller.id, rejectReason.trim());
      setActionFeedback({ message: 'Cadastro rejeitado com sucesso.', severity: 'success' });
      setRejectDialogOpen(false);
      closeAnalysisDialog();
      fetchData();
    } catch (error: any) {
      setActionFeedback({ message: error?.message ?? 'Erro ao rejeitar cadastro', severity: 'error' });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" spacing={1}>
          <Box>
            <Typography variant="h4">Revendedores</Typography>
            <Typography color="text.secondary">
              Lista completa com filtros de status, nível, busca e ações rápidas.
            </Typography>
          </Box>
          <Chip label={`Pendentes: ${pendingCount}`} color="warning" size="small" />
        </Stack>

        {actionFeedback && (
          <Alert severity={actionFeedback.severity} onClose={() => setActionFeedback(null)}>
            {actionFeedback.message}
          </Alert>
        )}

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {statusOptions.map((option) => (
                <Chip
                  key={option.label}
                  label={`${option.label}${option.value === 'pending' ? ` (${pendingCount})` : ''}`}
                  color={statusFilter === option.value ? 'primary' : option.value ? 'default' : 'primary'}
                  variant={statusFilter === option.value ? 'filled' : 'outlined'}
                  onClick={() => {
                    setStatusFilter(option.value);
                    setPage(1);
                  }}
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {levelOptions.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  variant={levelFilter === option.value ? 'filled' : 'outlined'}
                  onClick={() => {
                    setLevelFilter(option.value);
                    setPage(1);
                  }}
                />
              ))}
            </Stack>
            <TextField
              placeholder="Buscar por nome, CPF ou e-mail"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              size="small"
            />
          </Stack>
        </Paper>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>CPF</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Nível</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Total vendido</TableCell>
                <TableCell>Cadastro</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resellers.map((reseller) => (
                <TableRow key={reseller.id} hover>
                  <TableCell>{reseller.userName ?? reseller.uniqueLink}</TableCell>
                  <TableCell>{reseller.cpf}</TableCell>
                  <TableCell>{reseller.userEmail}</TableCell>
                  <TableCell>
                    <Chip label={reseller.level} size="small" color="secondary" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={reseller.status}
                      size="small"
                      color={getStatusColor(reseller.status)}
                    />
                  </TableCell>
                  <TableCell>{formatCurrency(reseller.totalSoldYear)}</TableCell>
                  <TableCell>{formatDate(reseller.createdAt)}</TableCell>
                  <TableCell align="right">
                    {reseller.status === 'pending' ? (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => openAnalysisDialog(reseller)}
                      >
                        Analisar
                      </Button>
                    ) : (
                      <Button
                        component={Link}
                        href={`/admin/revendedores/${reseller.id}`}
                        size="small"
                        variant="outlined"
                      >
                        Detalhes
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && resellers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    Nenhum revendedor encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="body2">
            Mostrando {resellers.length} de {total} revendedores
          </Typography>
          <Pagination
            count={Math.max(1, Math.ceil(total / limit))}
            page={page}
            onChange={(_, value) => setPage(value)}
          />
        </Stack>
      </Stack>

      <Dialog open={!!selectedReseller} onClose={closeAnalysisDialog} fullWidth maxWidth="lg">
        <DialogTitle>
          {selectedReseller?.userName ?? selectedReseller?.uniqueLink} — {selectedReseller?.status}
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : resellerDetail ? (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6">Dados pessoais</Typography>
                  <Divider />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    CPF
                  </Typography>
                  <Typography>{resellerDetail.reseller.cpf}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Telefone
                  </Typography>
                  <Typography>{resellerDetail.reseller.phone ?? '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Nível
                  </Typography>
                  <Typography>{resellerDetail.reseller.level}</Typography>
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6">Dados bancários</Typography>
                  <Divider />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Banco
                  </Typography>
                  <Typography>{resellerDetail.bank.bankName ?? '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Agência / Conta
                  </Typography>
                  <Typography>
                    {resellerDetail.bank.bankAgency ?? '—'} / {resellerDetail.bank.bankAccount ?? '—'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Titular
                  </Typography>
                  <Typography>{resellerDetail.bank.bankHolderName ?? '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Tipo de conta
                  </Typography>
                  <Typography>{resellerDetail.bank.bankAccountType ?? '—'}</Typography>
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6">Métricas</Typography>
                  <Divider />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Pedidos últimos 30 dias
                  </Typography>
                  <Typography>{resellerDetail.metrics.ordersLast30Days}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Vendas mensais
                  </Typography>
                  <Typography>{formatCurrency(resellerDetail.metrics.monthlySales)}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Saldo disponível
                  </Typography>
                  <Typography>{formatCurrency(resellerDetail.metrics.balance.available)}</Typography>
                </Grid>
              </Grid>
            </Stack>
          ) : (
            <Typography color="text.secondary">Detalhes indisponíveis.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ gap: 1 }}>
          <Button variant="outlined" onClick={handleOpenReject}>
            Rejeitar cadastro
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={closeAnalysisDialog}>Fechar</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleApprove}
            disabled={analysisLoading}
          >
            {analysisLoading ? <CircularProgress size={20} /> : 'Aprovar cadastro'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rejeitar cadastro</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            O revendedor receberá um email informado o motivo da rejeição.
          </Alert>
          <TextField
            label="Motivo da rejeição"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            multiline
            rows={4}
            fullWidth
            helperText="Mínimo 10 caracteres"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReject}
            disabled={rejectReason.trim().length < 10 || rejecting}
          >
            {rejecting ? <CircularProgress size={20} /> : 'Confirmar rejeição'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
