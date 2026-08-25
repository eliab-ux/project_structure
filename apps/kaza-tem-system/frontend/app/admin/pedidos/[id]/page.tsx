'use client';

import {
  Box,
  Container,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useAdminAuthContext } from '@/contexts/AdminAuthContext';
import { AdminOrderDetail, getOrderDetail } from '@/services/adminOrderService';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const { accessToken } = useAdminAuthContext();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken || !id) return;
    setLoading(true);
    getOrderDetail(accessToken, id)
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    [],
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Detalhe do pedido</Typography>
        </Box>

        {loading && <LinearProgress />}

        {order && (
          <>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6">Resumo</Typography>
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Typography>
                  <strong>Status:</strong> {order.status}
                </Typography>
                <Typography>
                  <strong>Total:</strong> {formatter.format(order.total)}
                </Typography>
                <Typography>
                  <strong>Desconto:</strong> {formatter.format(order.discount)}
                </Typography>
                <Typography>
                  <strong>Frete:</strong> {formatter.format(order.shippingCost)}
                </Typography>
                <Typography>
                  <strong>Criado em:</strong>{' '}
                  {new Date(order.createdAt).toLocaleString('pt-BR')}
                </Typography>
                <Typography>
                  <strong>Pagamento:</strong> {order.paymentMethod ?? '—'}
                </Typography>
              </Stack>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6">Endereço de entrega</Typography>
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Typography>
                  {order.shippingAddress.street}, {order.shippingAddress.number}
                </Typography>
                <Typography>
                  {order.shippingAddress.city} - {order.shippingAddress.state} ·{' '}
                  {order.shippingAddress.zipCode}
                </Typography>
                <Typography>{order.shippingAddress.country}</Typography>
                {order.shippingAddress.complement && (
                  <Typography>
                    <strong>Complemento:</strong> {order.shippingAddress.complement}
                  </Typography>
                )}
              </Stack>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6">Itens</Typography>
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Produto</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell align="right">Quantidade</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatter.format(item.totalPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}
