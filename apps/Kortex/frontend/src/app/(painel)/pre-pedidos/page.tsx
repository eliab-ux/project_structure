'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/PageHeader';
import preOrderService from 'src/services/preOrderService';
import { apiErrorMessage } from 'src/services/api';
import {
  LAYOUT_TYPE_LABELS,
  PRE_ORDER_STATUS_LABELS,
  PreOrder,
  formatDateTime,
} from 'src/types/preOrder';
import { numericSx } from 'src/theme/theme';

/**
 * Pré-pedidos no painel do Administrativo.
 *
 * **Somente leitura.** As horas chegam prontas e não há campo para editá-las aqui — nem
 * desabilitado: o backend responde 403, e mostrar um campo que sempre falha seria convidar ao
 * erro. Quem avalia é o Modelista (regra 6.1).
 */
export default function PreOrdersPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [scope, setScope] = useState<'open' | 'all'>('open');

  const load = useCallback(async () => {
    try {
      setPreOrders(
        scope === 'open'
          ? await preOrderService.listOpenPreOrders()
          : await preOrderService.listAllPreOrders(),
      );
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar os pré-pedidos.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Pré-pedidos"
        description="A avaliação do Modelista, com as horas já definidas. Reservar e cobrar é com você."
        action={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={scope}
            onChange={(_e, value) => value && setScope(value)}
          >
            <ToggleButton value="open">Abertos</ToggleButton>
            <ToggleButton value="all">Todos</ToggleButton>
          </ToggleButtonGroup>
        }
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        As horas são definidas pelo Modelista e não podem ser alteradas aqui — ele é quem avaliou o
        tecido, a metragem e a quantidade.
      </Alert>

      {loading ? (
        <Box
          role="status"
          aria-label="Carregando"
          sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <Paper variant="outlined" component="section" aria-label="Pré-pedidos" sx={{ p: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Cliente</TableCell>
                <TableCell>Tecido / produto</TableCell>
                <TableCell align="right">Peças</TableCell>
                <TableCell align="right">Camadas</TableCell>
                <TableCell>Enfesto</TableCell>
                <TableCell align="right">Horas</TableCell>
                <TableCell>Avaliado por</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {preOrders.map((preOrder) => (
                <TableRow key={preOrder.id}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {preOrder.customer.name}
                    {preOrder.notes && (
                      <Typography variant="body2" color="text.secondary">
                        {preOrder.notes}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {preOrder.fabric.name}
                    <Typography variant="body2" color="text.secondary">
                      {preOrder.productType.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={numericSx}>
                    {preOrder.estimatedPieces}
                  </TableCell>
                  <TableCell align="right" sx={numericSx}>
                    {preOrder.estimatedLayers ?? '—'}
                  </TableCell>
                  <TableCell>
                    {preOrder.estimatedLayoutType
                      ? LAYOUT_TYPE_LABELS[preOrder.estimatedLayoutType]
                      : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ ...numericSx, fontWeight: 600 }}>
                    {preOrder.estimatedHours}h
                  </TableCell>
                  <TableCell>
                    {preOrder.createdBy.name}
                    <Typography variant="body2" color="text.secondary" sx={numericSx}>
                      {formatDateTime(preOrder.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant={preOrder.status === 'open' ? 'filled' : 'outlined'}
                      color={preOrder.status === 'open' ? 'info' : 'default'}
                      label={PRE_ORDER_STATUS_LABELS[preOrder.status]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {preOrders.length === 0 && (
            <Stack sx={{ p: 3 }} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Nenhum pré-pedido {scope === 'open' ? 'aberto' : 'registrado'}.
              </Typography>
            </Stack>
          )}
        </Paper>
      )}
    </>
  );
}
