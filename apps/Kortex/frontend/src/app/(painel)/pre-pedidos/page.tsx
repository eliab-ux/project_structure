'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
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
import {
  MatrizFormValue,
  MatrizList,
  emptyMatriz,
  matrizPreenchida,
} from 'src/components/MatrizList';
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
  fabricSummary,
  formatDateTime,
  totalPieces,
} from 'src/types/preOrder';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
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
  /**
   * Mediana medida **por tecido escolhido**, indexada pelo id.
   *
   * Por tecido e não um só: a regra 6.1 vale para cada matriz, e um pedido com dois materiais
   * pode ter um deles estreante. Guardar um histórico único mostraria o do último tecido clicado
   * ao lado de todos — e o aviso apareceria na matriz errada.
   */
  const [historicos, setHistoricos] = useState<
    Record<string, { samples: number; medianHours: number | null }>
  >({});
  const [expandido, setExpandido] = useState<string | null>(null);
  const [form, setForm] = useState<{
    customerId: string;
    matrizes: MatrizFormValue[];
    estimatedHours: number;
    notes: string;
  }>({ customerId: '', matrizes: [emptyMatriz()], estimatedHours: 1, notes: '' });

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
    setForm({ customerId: '', matrizes: [emptyMatriz()], estimatedHours: 1, notes: '' });
    setHistoricos({});
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
      return;
    }
    try {
      const dados = await cutService.fabricHistory(fabricId, pieces);
      const medianHours =
        dados.medianDurationSeconds !== null
          ? Math.round((dados.medianDurationSeconds / 3600) * 10) / 10
          : null;
      setHistoricos((atual) => ({ ...atual, [fabricId]: { samples: dados.samples, medianHours } }));
    } catch {
      setHistoricos((atual) => {
        const copia = { ...atual };
        delete copia[fabricId];
        return copia;
      });
    }
  }

  /**
   * Sugere as horas do pedido somando a mediana de cada matriz declarada.
   *
   * Soma e não média: as matrizes são cortadas em sequência na mesma máquina, então o bloco que o
   * cliente precisa comprar é o total. Arredonda para CIMA porque a hora de máquina é vendida
   * inteira e faltar tempo é pior que sobrar — e continua sendo **sugestão**: o campo fica
   * editável.
   */
  function sugerirHoras(matrizes: MatrizFormValue[]) {
    const total = matrizes.reduce(
      (soma, matriz) => soma + (historicos[matriz.fabricId]?.medianHours ?? 0),
      0,
    );
    if (total > 0) {
      setForm((atual) => ({ ...atual, estimatedHours: Math.max(1, Math.ceil(total)) }));
    }
  }

  async function salvarNovo() {
    try {
      await preOrderService.createPreOrder({
        customerId: form.customerId,
        matrizes: form.matrizes.map((matriz) => ({
          fabricId: matriz.fabricId,
          productTypeId: matriz.productTypeId,
          estimatedPieces: Number(matriz.estimatedPieces),
          rolls: matriz.rolls ? Number(matriz.rolls) : null,
        })),
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

  const prontoParaSalvar =
    Boolean(form.customerId) && form.matrizes.every(matrizPreenchida) && form.matrizes.length > 0;

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
                <TableCell sx={{ width: 44 }} />
                <TableCell>Cliente</TableCell>
                <TableCell>Tecido</TableCell>
                <TableCell align="right">Matrizes</TableCell>
                <TableCell align="right">Peças</TableCell>
                <TableCell align="right">Horas</TableCell>
                <TableCell>Avaliado por</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {preOrders.map((preOrder) => {
                const aberto = expandido === preOrder.id;
                return (
                  /* Fragment e não duas linhas soltas: a linha de detalhe pertence à de cima, e
                     separá-las faria o React perder o par ao reordenar a lista. */
                  <Fragment key={preOrder.id}>
                    <TableRow>
                      <TableCell sx={{ pr: 0 }}>
                        <IconButton
                          size="small"
                          aria-label={aberto ? 'Ocultar matrizes' : 'Ver matrizes'}
                          onClick={() => setExpandido(aberto ? null : preOrder.id)}
                        >
                          {aberto ? (
                            <KeyboardArrowDownIcon fontSize="small" />
                          ) : (
                            <KeyboardArrowRightIcon fontSize="small" />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {preOrder.customer.name}
                        {preOrder.notes && (
                          <Typography variant="body2" color="text.secondary">
                            {preOrder.notes}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{fabricSummary(preOrder)}</TableCell>
                      <TableCell align="right" sx={numericSx}>
                        {preOrder.matrizes.length}
                      </TableCell>
                      <TableCell align="right" sx={numericSx}>
                        {totalPieces(preOrder)}
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

                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 0, border: 0 }}>
                        <Collapse in={aberto} unmountOnExit>
                          <Table size="small" sx={{ my: 1 }}>
                            <TableHead>
                              <TableRow>
                                <TableCell>Matriz</TableCell>
                                <TableCell>Tecido</TableCell>
                                <TableCell>Produto</TableCell>
                                <TableCell align="right">Peças</TableCell>
                                <TableCell align="right">Camadas</TableCell>
                                <TableCell>Enfesto</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {preOrder.matrizes.map((matriz) => (
                                <TableRow key={matriz.id}>
                                  <TableCell sx={numericSx}>{matriz.sequence}</TableCell>
                                  <TableCell>{matriz.fabric.name}</TableCell>
                                  <TableCell>{matriz.productType.name}</TableCell>
                                  <TableCell align="right" sx={numericSx}>
                                    {matriz.estimatedPieces}
                                  </TableCell>
                                  <TableCell align="right" sx={numericSx}>
                                    {matriz.estimatedLayers ?? '—'}
                                  </TableCell>
                                  <TableCell>
                                    {matriz.estimatedLayoutType
                                      ? LAYOUT_TYPE_LABELS[matriz.estimatedLayoutType]
                                      : '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
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

            {/* O histórico é a razão de este formulário existir aqui — por isso ele aparece
                dentro de cada matriz, logo abaixo do tecido escolhido, e não num rodapé. A regra
                6.1 vale POR MATRIZ: basta um tecido estreante para o pedido ser recusado. */}
            <MatrizList
              matrizes={form.matrizes}
              fabrics={fabrics}
              productTypes={productTypes}
              onChange={(matrizes) => {
                setForm({ ...form, matrizes });
                sugerirHoras(matrizes);
              }}
              onMatrizChanged={(matriz) =>
                void carregarHistorico(
                  matriz.fabricId,
                  matriz.estimatedPieces ? Number(matriz.estimatedPieces) : null,
                )
              }
              renderExtra={(matriz) => {
                const historico = matriz.fabricId ? historicos[matriz.fabricId] : undefined;
                if (!historico) {
                  return null;
                }
                if (historico.samples === 0) {
                  return (
                    <Alert severity="warning">
                      Este tecido ainda não tem corte concluído. A primeira estimativa é do
                      Modelista — a partir do segundo corte você abre o pedido por aqui.
                    </Alert>
                  );
                }
                return (
                  <Alert severity="success">
                    {historico.samples} corte{historico.samples > 1 ? 's' : ''} registrado
                    {historico.samples > 1 ? 's' : ''} com este tecido
                    {historico.medianHours
                      ? ` · mediana de ${historico.medianHours.toFixed(1).replace('.', ',')}h por matriz`
                      : ''}
                    .
                  </Alert>
                );
              }}
            />

            <TextField
              label="Horas do pedido"
              type="number"
              sx={{ maxWidth: 200 }}
              inputProps={{ min: 1, max: 24 }}
              value={form.estimatedHours}
              onChange={(event) => setForm({ ...form, estimatedHours: Number(event.target.value) })}
              helperText="Hora cheia, do pedido inteiro"
            />

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
