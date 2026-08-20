'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/PageHeader';
import preOrderService from 'src/services/preOrderService';
import customerService from 'src/services/customerService';
import catalogService from 'src/services/catalogService';
import cutService from 'src/services/cutService';
import { apiErrorMessage } from 'src/services/api';
import { CustomerListItem, Fabric, ProductType } from 'src/types/customer';
import {
  LAYOUT_TYPE_LABELS,
  PRE_ORDER_STATUS_LABELS,
  PreOrder,
  formatDateTime,
} from 'src/types/preOrder';
import { numericSx } from 'src/theme/theme';

/**
 * Pedidos no painel do Administrativo.
 *
 * A rota e o domínio continuam `pre-order`/`pre_order` — o rótulo é de tela, e mexer no nome do
 * agregado por causa de uma palavra na interface renomearia tabela, migration e spec junto.
 * "Pré-pedido" continua sendo o nome do lado do Modelista, que é quem o cria.
 *
 * **Não edita horas.** As horas chegam prontas e não há campo para alterá-las aqui — nem
 * desabilitado: o backend responde 403, e mostrar um campo que sempre falha seria convidar ao
 * erro. Alterar `estimated_hours` é exclusivo do Modelista (§4.7).
 *
 * **Criar, sim — para tecido com histórico** (regra 6.1). A primeira estimativa de um tecido é do
 * Modelista, porque só existe na cabeça de quem está na máquina. A partir do segundo corte ela
 * está no sistema, e o formulário mostra a mediana medida ao lado do campo de horas: o
 * Administrativo não digita um palpite, ele confirma um número.
 */
export default function PreOrdersPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [scope, setScope] = useState<'open' | 'all'>('open');

  const [novoAberto, setNovoAberto] = useState(false);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  /** Mediana medida para o tecido escolhido. `null` = sem histórico, e aí o backend recusa. */
  const [historico, setHistorico] = useState<{
    samples: number;
    medianHours: number | null;
  } | null>(null);
  const [form, setForm] = useState({
    customerId: '',
    fabricId: '',
    productTypeId: '',
    estimatedPieces: '',
    estimatedHours: 1,
    notes: '',
  });

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

  async function abrirNovo() {
    setForm({
      customerId: '',
      fabricId: '',
      productTypeId: '',
      estimatedPieces: '',
      estimatedHours: 1,
      notes: '',
    });
    setHistorico(null);
    setNovoAberto(true);

    try {
      const [loadedCustomers, loadedFabrics, loadedTypes] = await Promise.all([
        customerService.list(),
        catalogService.listFabrics(),
        catalogService.listProductTypes(),
      ]);
      // Cliente inativo não recebe pedido novo, mas continua no histórico (§4.4).
      setCustomers(loadedCustomers.filter((customer) => customer.status === 'active'));
      setFabrics(loadedFabrics);
      setProductTypes(loadedTypes);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar os cadastros.'), {
        variant: 'error',
      });
    }
  }

  /**
   * Puxa a mediana medida do tecido escolhido.
   *
   * É o que autoriza o Administrativo a estimar (regra 6.1) e é o que ele vê antes de digitar. Sem
   * amostra, o aviso aparece na tela antes de o backend recusar — para ele não preencher o
   * formulário inteiro à toa.
   */
  async function carregarHistorico(fabricId: string, pieces: number | null) {
    if (!fabricId) {
      setHistorico(null);
      return;
    }
    try {
      const dados = await cutService.fabricHistory(fabricId, pieces);
      const medianHours =
        dados.medianDurationSeconds !== null
          ? Math.round((dados.medianDurationSeconds / 3600) * 10) / 10
          : null;
      setHistorico({ samples: dados.samples, medianHours });

      // Sugere as horas a partir do medido, arredondando para CIMA: hora de máquina é vendida
      // inteira, e faltar tempo é pior que sobrar.
      if (medianHours && medianHours > 0) {
        setForm((atual) => ({ ...atual, estimatedHours: Math.max(1, Math.ceil(medianHours)) }));
      }
    } catch {
      setHistorico(null);
    }
  }

  async function salvarNovo() {
    try {
      await preOrderService.createPreOrder({
        customerId: form.customerId,
        fabricId: form.fabricId,
        productTypeId: form.productTypeId,
        estimatedPieces: Number(form.estimatedPieces),
        estimatedHours: form.estimatedHours,
        notes: form.notes.trim() || null,
      });
      enqueueSnackbar('Pedido criado.', { variant: 'success' });
      setNovoAberto(false);
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível criar o pedido.'), {
        variant: 'error',
      });
    }
  }

  const prontoParaSalvar = Boolean(
    form.customerId && form.fabricId && form.productTypeId && Number(form.estimatedPieces) > 0,
  );

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="A avaliação do Modelista, com as horas já definidas. Reservar e cobrar é com você."
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ToggleButtonGroup
              exclusive
              size="small"
              value={scope}
              onChange={(_e, value) => value && setScope(value)}
            >
              <ToggleButton value="open">Abertos</ToggleButton>
              <ToggleButton value="all">Todos</ToggleButton>
            </ToggleButtonGroup>
            <Button onClick={abrirNovo}>+ Pedido</Button>
          </Stack>
        }
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        As horas de um pedido existente não podem ser alteradas aqui — quem avaliou o tecido, a
        metragem e a quantidade foi o Modelista. Você abre pedido novo para tecido que já tem corte
        registrado: aí a estimativa vem do histórico, não de palpite.
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
        <Paper variant="outlined" component="section" aria-label="Pedidos" sx={{ p: 1 }}>
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

      {/* ==== Novo pedido — só para tecido com histórico (regra 6.1) ==== */}
      <Dialog open={novoAberto} onClose={() => setNovoAberto(false)} fullWidth maxWidth="sm">
        <DialogTitle>Novo pedido</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              select
              label="Cliente"
              fullWidth
              required
              value={form.customerId}
              onChange={(event) => setForm({ ...form, customerId: event.target.value })}
              SelectProps={{ MenuProps: { PaperProps: { style: { maxHeight: 320 } } } }}
            >
              {customers.map((customer) => (
                <MenuItem key={customer.id} value={customer.id}>
                  {customer.tradeName} · {customer.city}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Tecido"
              fullWidth
              required
              value={form.fabricId}
              onChange={(event) => {
                setForm({ ...form, fabricId: event.target.value });
                void carregarHistorico(
                  event.target.value,
                  form.estimatedPieces ? Number(form.estimatedPieces) : null,
                );
              }}
            >
              {fabrics.map((fabric) => (
                <MenuItem key={fabric.id} value={fabric.id}>
                  {fabric.name}
                </MenuItem>
              ))}
            </TextField>

            {/* O histórico é a razão de este formulário existir aqui — então ele fica na frente,
                não escondido num rodapé. */}
            {form.fabricId && historico && historico.samples === 0 && (
              <Alert severity="warning">
                Este tecido ainda não tem corte concluído. A primeira estimativa é do Modelista — a
                partir do segundo corte você abre o pedido por aqui.
              </Alert>
            )}
            {historico && historico.samples > 0 && (
              <Alert severity="success">
                {historico.samples} corte{historico.samples > 1 ? 's' : ''} registrado
                {historico.samples > 1 ? 's' : ''} com este tecido
                {historico.medianHours
                  ? ` · mediana de ${historico.medianHours.toFixed(1).replace('.', ',')}h por matriz`
                  : ''}
                .
              </Alert>
            )}

            <TextField
              select
              label="Tipo de produto"
              fullWidth
              required
              value={form.productTypeId}
              onChange={(event) => setForm({ ...form, productTypeId: event.target.value })}
            >
              {productTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.name}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Peças estimadas"
                type="number"
                fullWidth
                required
                inputProps={{ min: 1 }}
                value={form.estimatedPieces}
                onChange={(event) => setForm({ ...form, estimatedPieces: event.target.value })}
                onBlur={() =>
                  void carregarHistorico(
                    form.fabricId,
                    form.estimatedPieces ? Number(form.estimatedPieces) : null,
                  )
                }
                helperText="O histórico é recortado por volume parecido."
              />
              <TextField
                label="Horas"
                type="number"
                sx={{ minWidth: 130 }}
                inputProps={{ min: 1, max: 24 }}
                value={form.estimatedHours}
                onChange={(event) =>
                  setForm({ ...form, estimatedHours: Number(event.target.value) })
                }
                helperText="Hora cheia"
              />
            </Stack>

            <TextField
              label="Observação"
              fullWidth
              multiline
              minRows={2}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setNovoAberto(false)}>
            Cancelar
          </Button>
          <Button onClick={salvarNovo} disabled={!prontoParaSalvar}>
            Criar pedido
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
