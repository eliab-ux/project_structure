'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { AdminOrderDetail, listAdminOrders, refundOrder } from '@/services/adminOrderService';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  processing: 'Em processamento',
  shipped: 'Enviado',
  delivered: 'Entregue',
  canceled: 'Cancelado',
};

export default function AdminOrdersPage() {
  const { accessToken } = useAdminAuthContext();
  const [orders, setOrders] = useState<AdminOrderDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminOrderDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number | undefined>(undefined);
  const [refundReason, setRefundReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    [],
  );

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    listAdminOrders(accessToken, { limit: 20 })
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [accessToken]);

  const openRefund = (order: AdminOrderDetail) => {
    setSelected(order);
    setRefundAmount(order.total);
    setRefundReason('Estorno solicitado pelo admin');
    setDialogOpen(true);
  };

  const handleRefund = async () => {
    if (!accessToken || !selected) return;
    try {
      await refundOrder(accessToken, selected.id, {
        amount: refundAmount,
        reason: refundReason,
      });
      setFeedback('Pedido estornado com sucesso');
      setDialogOpen(false);
    } catch (error) {
      setFeedback('Falha ao estornar o pedido');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Pedidos</Typography>
          <Typography color="text.secondary">
            Acompanhe os pedidos confirmados, adicione rastreio ou estorne quando necessário.
          </Typography>
        </Box>

        {loading && <LinearProgress />}

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Número</TableCell>
                <TableCell>Revendedor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Data</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>{order.id}</TableCell>
                  <TableCell>{order.resellerId ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={statusLabels[order.status] ?? order.status}
                      size="small"
                      color={order.status === 'paid' ? 'success' : 'warning'}
                    />
                  </TableCell>
                  <TableCell>{formatter.format(order.total)}</TableCell>
                  <TableCell>
                    {new Date(order.createdAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        size="small"
                        component={Link}
                        href={`/admin/pedidos/${order.id}`}
                      >
                        Ver
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        color="error"
                        onClick={() => openRefund(order)}
                      >
                        Estornar
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {feedback && <Alert severity="success">{feedback}</Alert>}
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Estornar pedido</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              label="Valor do estorno"
              type="number"
              value={refundAmount ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setRefundAmount(value === '' ? undefined : Number(value));
              }}
            />
            <TextField
              label="Motivo"
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleRefund}>
            Confirmar estorno
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
