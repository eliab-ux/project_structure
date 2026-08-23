'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DataState } from 'src/components/DataState';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import financeService from 'src/services/financeService';
import orderService from 'src/services/orderService';
import productService from 'src/services/productService';
import routeService from 'src/services/routeService';
import stockService, { StockLocation } from 'src/services/stockService';
import { FinancialAccount } from 'src/types/finance';
import { Order } from 'src/types/order';
import { Product } from 'src/types/product';
import {
  CargoLinePayload,
  FIELD_RECEIPT_METHOD_LABEL,
  FIELD_RECEIPT_METHODS,
  FieldReceiptMethod,
  PromissoryNoteResult,
  TRIP_EXPENSE_CATEGORY_LABEL,
  TRIP_EXPENSE_CATEGORIES,
  TripClosureSummary,
  TripDetails,
  TripExpenseCategory,
} from 'src/types/route';

const MAX_WIDTH = 1280;

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * A VIAGEM da retaguarda (04 §3): carga → saída → carteira → acerto em DOIS estágios (lançar →
 * efetivar) → devolução/troca → despesas → chegada → fechamento com batimento. O fechamento devolve
 * o resumo das planilhas reais (cobrança/recobrança, caixa, folha B, comparativo com a anterior).
 */
export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const canManage = can('rot.trip.manage');
  const tripId = params.id;

  const [details, setDetails] = useState<TripDetails | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closure, setClosure] = useState<TripClosureSummary | null>(null);

  const [dialog, setDialog] = useState<
    | null
    | { kind: 'cargo' }
    | { kind: 'arrive' }
    | { kind: 'receipt' }
    | { kind: 'effectuate'; receiptId: string; amount: number }
    | { kind: 'return' }
    | { kind: 'exchange' }
    | { kind: 'expense' }
    | { kind: 'close' }
    | { kind: 'promissory'; order: Order }
    | { kind: 'closeOrder'; order: Order }
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await routeService.getTripDetails(tripId);
      setDetails(data);
      // Pedidos da viagem: a lista de pedidos não filtra por viagem — filtramos aqui (volume baixo).
      const allOrders = await orderService.list({}).catch(() => [] as Order[]);
      setOrders(allOrders.filter((order) => order.tripId === tripId));
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar a viagem.'));
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void productService
      .list({})
      .then(setProducts)
      .catch(() => undefined);
    void financeService
      .listAccounts()
      .then(setAccounts)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (details?.trip.companyId) {
      void stockService
        .listLocations(details.trip.companyId)
        .then(setLocations)
        .catch(() => undefined);
    }
  }, [details?.trip.companyId]);

  const productName = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );

  async function run(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      enqueueSnackbar(successMessage, { variant: 'success' });
      setDialog(null);
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    }
  }

  if (loading || error || !details) {
    return (
      <Box sx={{ maxWidth: MAX_WIDTH, mx: 'auto' }}>
        <DataState
          loading={loading}
          error={error}
          empty={!details}
          emptyMessage="Viagem não encontrada."
        />
      </Box>
    );
  }

  const { trip, wallet, receipts, expenses } = details;
  const walletTotal = wallet.reduce((sum, entry) => sum + entry.amountAtBuild, 0);
  const pendingReceipts = receipts.filter((receipt) => receipt.status === 'proposto');

  return (
    <Box component="section" aria-label="Viagem" sx={{ maxWidth: MAX_WIDTH, mx: 'auto' }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <IconButton aria-label="Voltar" onClick={() => router.push('/trips')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h1" sx={{ flex: 1 }}>
          Viagem {trip.id.slice(0, 8)}
        </Typography>
        <Chip label={trip.statusLabel} color={trip.status === 'fechada' ? 'success' : 'info'} />
      </Stack>

      {/* ── Ações por situação ─────────────────────────────────────────────────────────────── */}
      {canManage ? (
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          {trip.status === 'planejada' ? (
            <>
              <Button variant="contained" onClick={() => setDialog({ kind: 'cargo' })}>
                Carregar carga
              </Button>
              <Button
                variant="outlined"
                onClick={() =>
                  void run(() => routeService.departTrip(trip.id), 'Saída registrada.')
                }
                disabled={!trip.loadLocationId}
              >
                Registrar saída
              </Button>
              <Button
                color="error"
                onClick={() =>
                  void run(() => routeService.cancelTrip(trip.id), 'Viagem cancelada.')
                }
              >
                Cancelar viagem
              </Button>
            </>
          ) : null}

          {trip.status === 'em_andamento' ? (
            <>
              <Button
                variant="outlined"
                onClick={() =>
                  void run(async () => {
                    const result = await routeService.buildWallet(trip.id);
                    enqueueSnackbar(
                      `Carteira montada: ${result.added.length} título(s), ${formatMoney(result.walletTotal)}.`,
                      { variant: 'info' },
                    );
                  }, 'Carteira atualizada.')
                }
              >
                Montar carteira
              </Button>
              <Button variant="outlined" onClick={() => setDialog({ kind: 'receipt' })}>
                Lançar recebimento
              </Button>
              <Button onClick={() => setDialog({ kind: 'return' })}>Devolução</Button>
              <Button onClick={() => setDialog({ kind: 'exchange' })}>Troca</Button>
              <Button onClick={() => setDialog({ kind: 'expense' })}>Despesa</Button>
              <Button variant="contained" onClick={() => setDialog({ kind: 'arrive' })}>
                Registrar chegada
              </Button>
            </>
          ) : null}

          {trip.status === 'em_fechamento' ? (
            <>
              <Button variant="outlined" onClick={() => setDialog({ kind: 'receipt' })}>
                Lançar recebimento
              </Button>
              <Button onClick={() => setDialog({ kind: 'return' })}>Devolução</Button>
              <Button onClick={() => setDialog({ kind: 'exchange' })}>Troca</Button>
              <Button onClick={() => setDialog({ kind: 'expense' })}>Despesa</Button>
              <Button
                variant="contained"
                onClick={() => setDialog({ kind: 'close' })}
                disabled={pendingReceipts.length > 0}
              >
                Fechar viagem
              </Button>
              {pendingReceipts.length > 0 ? (
                <Typography variant="caption" color="warning.main" sx={{ alignSelf: 'center' }}>
                  {pendingReceipts.length} recebimento(s) aguardando efetivação.
                </Typography>
              ) : null}
            </>
          ) : null}
        </Stack>
      ) : null}

      {/* ── Resumo ─────────────────────────────────────────────────────────────────────────── */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <SummaryCard label="Carteira" value={formatMoney(walletTotal)} />
        <SummaryCard
          label="Recebido (efetivado)"
          value={formatMoney(
            receipts
              .filter((receipt) => receipt.status === 'efetivado')
              .reduce((sum, receipt) => sum + receipt.amount + receipt.interest, 0),
          )}
        />
        <SummaryCard
          label="Despesas"
          value={formatMoney(expenses.reduce((sum, expense) => sum + expense.amount, 0))}
        />
        <SummaryCard label="Caixa inicial" value={formatMoney(trip.initialCash)} />
        <SummaryCard
          label="Caixa contado (retorno)"
          value={trip.returnCash !== null ? formatMoney(trip.returnCash) : '—'}
        />
      </Stack>

      {closure ? <ClosureSummaryPanel closure={closure} /> : null}

      {/* ── Pedidos consignados da viagem ──────────────────────────────────────────────────── */}
      <SectionTitle title="Pedidos da viagem" />
      {orders.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Nenhum pedido vinculado a esta viagem.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small" aria-label="Pedidos da viagem">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>{order.number}</TableCell>
                  <TableCell>
                    <Chip size="small" label={order.statusLabel} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">{formatMoney(order.total)}</TableCell>
                  <TableCell align="right">
                    {canManage ? (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="flex-end"
                        flexWrap="wrap"
                      >
                        {order.status === 'rascunho' ? (
                          <Button
                            size="small"
                            onClick={() =>
                              void run(
                                () => orderService.openConsignment(order.id),
                                `Pedido #${order.number} efetivado — título da consignação criado.`,
                              )
                            }
                          >
                            Efetivar consignação
                          </Button>
                        ) : null}
                        {order.status === 'consignado_aberto' ? (
                          <Button
                            size="small"
                            onClick={() =>
                              void run(
                                () => orderService.startSettlement(order.id),
                                `Acerto do pedido #${order.number} iniciado.`,
                              )
                            }
                          >
                            Iniciar acerto
                          </Button>
                        ) : null}
                        {order.status === 'em_acerto' ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setDialog({ kind: 'closeOrder', order })}
                          >
                            Fechar acerto
                          </Button>
                        ) : null}
                        <Button
                          size="small"
                          onClick={() => setDialog({ kind: 'promissory', order })}
                        >
                          Promissória
                        </Button>
                      </Stack>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Carteira ───────────────────────────────────────────────────────────────────────── */}
      <SectionTitle title={`Carteira de cobrança (${wallet.length} título(s))`} />
      {wallet.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Carteira vazia — use &quot;Montar carteira&quot; com a viagem em andamento.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small" aria-label="Carteira da viagem">
            <TableHead>
              <TableRow>
                <TableCell>Título</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell align="right">Valor na montagem</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {wallet.map((entry) => (
                <TableRow key={entry.titleId} hover>
                  <TableCell>{entry.titleId.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={entry.kind === 'recobranca' ? 'Recobrança' : 'Cobrança'}
                      color={entry.kind === 'recobranca' ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">{formatMoney(entry.amountAtBuild)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Recebimentos (dois estágios) ───────────────────────────────────────────────────── */}
      <SectionTitle title="Recebimentos do acerto" />
      {receipts.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Nenhum recebimento lançado.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small" aria-label="Recebimentos">
            <TableHead>
              <TableRow>
                <TableCell>Título</TableCell>
                <TableCell>Forma</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell align="right">Juros</TableCell>
                <TableCell>Estágio</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {receipts.map((receipt) => (
                <TableRow key={receipt.id} hover>
                  <TableCell>
                    {receipt.titleId ? receipt.titleId.slice(0, 8) : 'À vista (fora da carteira)'}
                  </TableCell>
                  <TableCell>
                    {FIELD_RECEIPT_METHOD_LABEL[receipt.method as FieldReceiptMethod] ??
                      receipt.method}
                  </TableCell>
                  <TableCell align="right">{formatMoney(receipt.amount)}</TableCell>
                  <TableCell align="right">
                    {receipt.interest > 0 ? formatMoney(receipt.interest) : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={receipt.status === 'efetivado' ? 'Efetivado' : 'Proposto'}
                      color={receipt.status === 'efetivado' ? 'success' : 'warning'}
                      variant={receipt.status === 'efetivado' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {canManage && receipt.status === 'proposto' ? (
                      <Button
                        size="small"
                        onClick={() =>
                          setDialog({
                            kind: 'effectuate',
                            receiptId: receipt.id,
                            amount: receipt.amount + receipt.interest,
                          })
                        }
                      >
                        Efetivar
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Despesas ───────────────────────────────────────────────────────────────────────── */}
      <SectionTitle title="Despesas da viagem" />
      {expenses.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Nenhuma despesa lançada.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small" aria-label="Despesas">
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell>Obs.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell>{new Date(expense.spentAt).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>
                    {TRIP_EXPENSE_CATEGORY_LABEL[expense.category as TripExpenseCategory] ??
                      expense.category}
                  </TableCell>
                  <TableCell align="right">{formatMoney(expense.amount)}</TableCell>
                  <TableCell>{expense.note ?? ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Dialogs ────────────────────────────────────────────────────────────────────────── */}
      {dialog?.kind === 'cargo' ? (
        <CargoDialog
          products={products}
          locations={locations}
          onClose={() => setDialog(null)}
          onSubmit={(fromLocationId, lines) =>
            void run(
              () => routeService.loadCargo(trip.id, { fromLocationId, lines }),
              'Carga registrada (romaneio).',
            )
          }
        />
      ) : null}

      {dialog?.kind === 'arrive' ? (
        <ArriveDialog
          onClose={() => setDialog(null)}
          onSubmit={(returnCash, finalKm) =>
            void run(
              () =>
                routeService.arriveTrip(trip.id, {
                  returnCash: returnCash ?? undefined,
                  finalKm: finalKm ?? undefined,
                }),
              'Chegada registrada — viagem em fechamento.',
            )
          }
        />
      ) : null}

      {dialog?.kind === 'receipt' ? (
        <ReceiptDialog
          wallet={wallet}
          onClose={() => setDialog(null)}
          onSubmit={(payload) =>
            void run(
              () => routeService.registerReceipt(trip.id, payload),
              'Recebimento lançado (proposto) — efetive para baixar no financeiro.',
            )
          }
        />
      ) : null}

      {dialog?.kind === 'effectuate' ? (
        <EffectuateDialog
          amount={dialog.amount}
          accounts={accounts}
          onClose={() => setDialog(null)}
          onSubmit={(financialAccountId) =>
            void run(
              () => routeService.effectuateReceipt(dialog.receiptId, { financialAccountId }),
              'Recebimento efetivado — baixa registrada no financeiro.',
            )
          }
        />
      ) : null}

      {dialog?.kind === 'return' ? (
        <ReturnDialog
          products={products}
          locations={locations}
          orders={orders}
          onClose={() => setDialog(null)}
          onSubmit={(toLocationId, orderId, lines) =>
            void run(
              () => routeService.returnItems(trip.id, { toLocationId, orderId, lines }),
              'Devolução registrada — reentrada pelo custo da época da carga.',
            )
          }
        />
      ) : null}

      {dialog?.kind === 'exchange' ? (
        <ExchangeDialog
          products={products}
          orders={orders}
          onClose={() => setDialog(null)}
          onSubmit={(payload) =>
            void run(
              () => routeService.exchangeItems(trip.id, payload),
              'Troca registrada (par vinculado).',
            )
          }
        />
      ) : null}

      {dialog?.kind === 'expense' ? (
        <ExpenseDialog
          onClose={() => setDialog(null)}
          onSubmit={(payload) =>
            void run(() => routeService.registerExpense(trip.id, payload), 'Despesa lançada.')
          }
        />
      ) : null}

      {dialog?.kind === 'close' ? (
        <CloseTripDialog
          onClose={() => setDialog(null)}
          onSubmit={(payload) =>
            void run(async () => {
              setClosure(await routeService.closeTrip(trip.id, payload));
            }, 'Viagem fechada — batimento abaixo.')
          }
        />
      ) : null}

      {dialog?.kind === 'closeOrder' ? (
        <CloseOrderDialog
          order={dialog.order}
          productName={productName}
          onClose={() => setDialog(null)}
          onSubmit={(soldLines) =>
            void run(
              () => orderService.closeConsignment(dialog.order.id, soldLines),
              `Acerto do pedido #${dialog.order.number} fechado — venda registrada.`,
            )
          }
        />
      ) : null}

      {dialog?.kind === 'promissory' ? (
        <PromissoryDialog order={dialog.order} onClose={() => setDialog(null)} />
      ) : null}
    </Box>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
    </Paper>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
      {title}
    </Typography>
  );
}

/** O batimento do fechamento (§3.5): os blocos das planilhas reais + comparativo com a anterior. */
function ClosureSummaryPanel({ closure }: { closure: TripClosureSummary }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3 }} component="article" aria-label="Batimento">
      <Typography variant="h6" sx={{ mb: 2 }}>
        Batimento do fechamento
      </Typography>
      <Stack spacing={1}>
        <Typography variant="body2">
          <strong>Cobrança:</strong> carteira {formatMoney(closure.cobranca.wallet)} · recebido{' '}
          {formatMoney(closure.cobranca.received)} · {closure.cobranca.percent}%
        </Typography>
        <Typography variant="body2">
          <strong>Recobrança:</strong> carteira {formatMoney(closure.recobranca.wallet)} · recebido{' '}
          {formatMoney(closure.recobranca.received)} · {closure.recobranca.percent}%
        </Typography>
        <Typography variant="body2">
          <strong>Juros recebidos:</strong> {formatMoney(closure.interestReceived)} ·{' '}
          <strong>Outros recebimentos (à vista):</strong> {formatMoney(closure.otherReceipts)}
        </Typography>
        <Typography variant="body2">
          <strong>Despesas:</strong> {formatMoney(closure.expenses.total)} (
          {closure.expenses.percentOfReceived}% do recebido) —{' '}
          {Object.entries(closure.expenses.byCategory)
            .map(
              ([category, amount]) =>
                `${TRIP_EXPENSE_CATEGORY_LABEL[category as TripExpenseCategory] ?? category}: ${formatMoney(amount)}`,
            )
            .join(' · ') || 'sem despesas'}
        </Typography>
        <Typography variant="body2">
          <strong>Caixa:</strong> esperado {formatMoney(closure.cash.expected)} · contado{' '}
          {closure.cash.counted !== null ? formatMoney(closure.cash.counted) : '—'} · diferença{' '}
          {closure.cash.difference !== null ? formatMoney(closure.cash.difference) : '—'}
        </Typography>
        <Divider />
        <Typography variant="body2">
          <strong>Folha:</strong> representante {closure.commission.commissionPercent}% sobre{' '}
          {formatMoney(closure.commission.received)} ={' '}
          {formatMoney(closure.commission.repCommission)} · gerente{' '}
          {formatMoney(closure.commission.managerCommission)} · ajudante{' '}
          {formatMoney(closure.commission.helperAmount)} —{' '}
          {closure.commission.payableTitleIds.length} conta(s) a pagar geradas
        </Typography>
        {closure.previousTrip ? (
          <>
            <Divider />
            <Typography variant="body2">
              <strong>Comparativo com a viagem anterior</strong> (
              {closure.previousTrip.departureAt
                ? new Date(closure.previousTrip.departureAt).toLocaleDateString('pt-BR')
                : 'sem data'}
              ): recebido {formatMoney(closure.previousTrip.received)} (
              {closure.previousTrip.receivedPercent}%) · despesas{' '}
              {formatMoney(closure.previousTrip.expensesTotal)} — deltas: recebido{' '}
              {formatMoney(closure.previousTrip.deltas.received)}, %{' '}
              {closure.previousTrip.deltas.receivedPercent}, despesas{' '}
              {formatMoney(closure.previousTrip.deltas.expensesTotal)}
            </Typography>
          </>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Primeira viagem da rota — sem comparativo.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

// ── Dialogs ──────────────────────────────────────────────────────────────────────────────────────

function CargoDialog({
  products,
  locations,
  onClose,
  onSubmit,
}: {
  products: Product[];
  locations: StockLocation[];
  onClose: () => void;
  onSubmit: (fromLocationId: string, lines: CargoLinePayload[]) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [fromLocationId, setFromLocationId] = useState('');
  const [rows, setRows] = useState<{ productId: string; quantity: string }[]>([
    { productId: '', quantity: '' },
  ]);

  function submit() {
    const lines = rows
      .filter((row) => row.productId && Number(row.quantity) > 0)
      .map((row) => ({ productId: row.productId, quantity: Number(row.quantity) }));
    if (!fromLocationId || lines.length === 0) {
      enqueueSnackbar('Escolha o depósito de origem e ao menos um item.', { variant: 'warning' });
      return;
    }
    onSubmit(fromLocationId, lines);
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Carregar carga (romaneio)</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            select
            label="Depósito de origem"
            value={fromLocationId}
            onChange={(event) => setFromLocationId(event.target.value)}
            fullWidth
            helperText="A carga vira uma localização própria (rep_load) — a saída é trip_load."
          >
            {locations
              .filter((location) => location.kind === 'warehouse')
              .map((location) => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
          </TextField>
          {rows.map((row, index) => (
            <Stack key={index} direction="row" spacing={1.5}>
              <TextField
                select
                label="Produto"
                value={row.productId}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((r, i) =>
                      i === index ? { ...r, productId: event.target.value } : r,
                    ),
                  )
                }
                size="small"
                sx={{ flex: 2 }}
              >
                {products
                  .filter((product) => product.active)
                  .map((product) => (
                    <MenuItem key={product.id} value={product.id}>
                      {product.name}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                label="Qtd"
                type="number"
                value={row.quantity}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((r, i) =>
                      i === index ? { ...r, quantity: event.target.value } : r,
                    ),
                  )
                }
                size="small"
                inputProps={{ min: 0, step: '1' }}
                sx={{ width: 100 }}
              />
              <Button
                size="small"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                disabled={rows.length === 1}
              >
                Remover
              </Button>
            </Stack>
          ))}
          <Button
            startIcon={<AddIcon />}
            onClick={() => setRows((current) => [...current, { productId: '', quantity: '' }])}
            sx={{ alignSelf: 'flex-start' }}
          >
            Adicionar item
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={submit}>
          Carregar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ArriveDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (returnCash: number | null, finalKm: number | null) => void;
}) {
  const [returnCash, setReturnCash] = useState('');
  const [finalKm, setFinalKm] = useState('');
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Registrar chegada</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Caixa contado no retorno (R$)"
            type="number"
            value={returnCash}
            onChange={(event) => setReturnCash(event.target.value)}
            inputProps={{ min: 0, step: '0.01' }}
            fullWidth
            helperText="Entra na conferência física × sistema do fechamento."
          />
          <TextField
            label="Km final"
            type="number"
            value={finalKm}
            onChange={(event) => setFinalKm(event.target.value)}
            inputProps={{ min: 0 }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() =>
            onSubmit(returnCash ? Number(returnCash) : null, finalKm ? Number(finalKm) : null)
          }
        >
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ReceiptDialog({
  wallet,
  onClose,
  onSubmit,
}: {
  wallet: TripDetails['wallet'];
  onClose: () => void;
  onSubmit: (payload: {
    titleId?: string | null;
    method: FieldReceiptMethod;
    amount: number;
    interest?: number;
  }) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [titleId, setTitleId] = useState('');
  const [method, setMethod] = useState<FieldReceiptMethod>('dinheiro');
  const [amount, setAmount] = useState('');
  const [interest, setInterest] = useState('');

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Lançar recebimento (1º estágio — proposta)</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            select
            label="Título da carteira"
            value={titleId}
            onChange={(event) => setTitleId(event.target.value)}
            fullWidth
            helperText="Sem título = venda à vista, fora da carteira (não entra na razão da comissão B)."
          >
            <MenuItem value="">À vista (fora da carteira)</MenuItem>
            {wallet.map((entry) => (
              <MenuItem key={entry.titleId} value={entry.titleId}>
                {entry.titleId.slice(0, 8)} — {formatMoney(entry.amountAtBuild)} (
                {entry.kind === 'recobranca' ? 'recobrança' : 'cobrança'})
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Forma"
              value={method}
              onChange={(event) => setMethod(event.target.value as FieldReceiptMethod)}
              fullWidth
            >
              {FIELD_RECEIPT_METHODS.map((value) => (
                <MenuItem key={value} value={value}>
                  {FIELD_RECEIPT_METHOD_LABEL[value]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Valor"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
            />
            <TextField
              label="Juros"
              type="number"
              value={interest}
              onChange={(event) => setInterest(event.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => {
            if (!(Number(amount) > 0)) {
              enqueueSnackbar('Informe o valor.', { variant: 'warning' });
              return;
            }
            onSubmit({
              titleId: titleId || null,
              method,
              amount: Number(amount),
              interest: interest ? Number(interest) : undefined,
            });
          }}
        >
          Lançar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EffectuateDialog({
  amount,
  accounts,
  onClose,
  onSubmit,
}: {
  amount: number;
  accounts: FinancialAccount[];
  onClose: () => void;
  onSubmit: (financialAccountId: string) => void;
}) {
  const [financialAccountId, setFinancialAccountId] = useState(
    accounts.length === 1 ? accounts[0].id : '',
  );
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Efetivar recebimento (2º estágio — baixa)</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {formatMoney(amount)} — a baixa acontece AGORA, na conta escolhida.
          </Typography>
          <TextField
            select
            label="Conta financeira"
            value={financialAccountId}
            onChange={(event) => setFinancialAccountId(event.target.value)}
            fullWidth
          >
            {accounts
              .filter((account) => account.active)
              .map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name} ({account.typeLabel})
                </MenuItem>
              ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => financialAccountId && onSubmit(financialAccountId)}
          disabled={!financialAccountId}
        >
          Efetivar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ReturnDialog({
  products,
  locations,
  orders,
  onClose,
  onSubmit,
}: {
  products: Product[];
  locations: StockLocation[];
  orders: Order[];
  onClose: () => void;
  onSubmit: (toLocationId: string, orderId: string | null, lines: CargoLinePayload[]) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [toLocationId, setToLocationId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [rows, setRows] = useState<{ productId: string; quantity: string }[]>([
    { productId: '', quantity: '' },
  ]);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Devolução (carga → depósito)</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            select
            label="Depósito de destino"
            value={toLocationId}
            onChange={(event) => setToLocationId(event.target.value)}
            fullWidth
            helperText="Reentra pelo custo da época da carga (aceite 5 do 04)."
          >
            {locations
              .filter((location) => location.kind === 'warehouse')
              .map((location) => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            select
            label="Pedido (opcional)"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            fullWidth
          >
            <MenuItem value="">Nenhum</MenuItem>
            {orders.map((order) => (
              <MenuItem key={order.id} value={order.id}>
                #{order.number} — {order.statusLabel}
              </MenuItem>
            ))}
          </TextField>
          {rows.map((row, index) => (
            <Stack key={index} direction="row" spacing={1.5}>
              <TextField
                select
                label="Produto"
                value={row.productId}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((r, i) =>
                      i === index ? { ...r, productId: event.target.value } : r,
                    ),
                  )
                }
                size="small"
                sx={{ flex: 2 }}
              >
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Qtd"
                type="number"
                value={row.quantity}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((r, i) =>
                      i === index ? { ...r, quantity: event.target.value } : r,
                    ),
                  )
                }
                size="small"
                inputProps={{ min: 0, step: '1' }}
                sx={{ width: 100 }}
              />
              <Button
                size="small"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                disabled={rows.length === 1}
              >
                Remover
              </Button>
            </Stack>
          ))}
          <Button
            startIcon={<AddIcon />}
            onClick={() => setRows((current) => [...current, { productId: '', quantity: '' }])}
            sx={{ alignSelf: 'flex-start' }}
          >
            Adicionar item
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => {
            const lines = rows
              .filter((row) => row.productId && Number(row.quantity) > 0)
              .map((row) => ({ productId: row.productId, quantity: Number(row.quantity) }));
            if (!toLocationId || lines.length === 0) {
              enqueueSnackbar('Escolha o destino e ao menos um item.', { variant: 'warning' });
              return;
            }
            onSubmit(toLocationId, orderId || null, lines);
          }}
        >
          Registrar devolução
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ExchangeDialog({
  products,
  orders,
  onClose,
  onSubmit,
}: {
  products: Product[];
  orders: Order[];
  onClose: () => void;
  onSubmit: (payload: {
    orderId?: string | null;
    returnedProductId: string;
    returnedQuantity: number;
    takenProductId: string;
    takenQuantity: number;
  }) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [orderId, setOrderId] = useState('');
  const [returnedProductId, setReturnedProductId] = useState('');
  const [returnedQuantity, setReturnedQuantity] = useState('');
  const [takenProductId, setTakenProductId] = useState('');
  const [takenQuantity, setTakenQuantity] = useState('');

  const productSelect = (label: string, value: string, onChange: (next: string) => void) => (
    <TextField
      select
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
    >
      {products.map((product) => (
        <MenuItem key={product.id} value={product.id}>
          {product.name}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Troca em par (devolvido ⇄ levado)</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            select
            label="Pedido (opcional)"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            fullWidth
          >
            <MenuItem value="">Nenhum</MenuItem>
            {orders.map((order) => (
              <MenuItem key={order.id} value={order.id}>
                #{order.number} — {order.statusLabel}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            {productSelect('Produto devolvido', returnedProductId, setReturnedProductId)}
            <TextField
              label="Qtd"
              type="number"
              value={returnedQuantity}
              onChange={(event) => setReturnedQuantity(event.target.value)}
              inputProps={{ min: 0, step: '1' }}
              sx={{ width: 110 }}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            {productSelect('Produto levado', takenProductId, setTakenProductId)}
            <TextField
              label="Qtd"
              type="number"
              value={takenQuantity}
              onChange={(event) => setTakenQuantity(event.target.value)}
              inputProps={{ min: 0, step: '1' }}
              sx={{ width: 110 }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            A diferença de valor é acertada no financeiro do acerto — aqui é só o estoque da carga.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => {
            if (
              !returnedProductId ||
              !takenProductId ||
              !(Number(returnedQuantity) > 0) ||
              !(Number(takenQuantity) > 0)
            ) {
              enqueueSnackbar('Preencha os dois lados da troca.', { variant: 'warning' });
              return;
            }
            onSubmit({
              orderId: orderId || null,
              returnedProductId,
              returnedQuantity: Number(returnedQuantity),
              takenProductId,
              takenQuantity: Number(takenQuantity),
            });
          }}
        >
          Registrar troca
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ExpenseDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (payload: {
    category: TripExpenseCategory;
    amount: number;
    note?: string | null;
  }) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [category, setCategory] = useState<TripExpenseCategory>('combustivel');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Lançar despesa</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            select
            label="Categoria"
            value={category}
            onChange={(event) => setCategory(event.target.value as TripExpenseCategory)}
            fullWidth
          >
            {TRIP_EXPENSE_CATEGORIES.map((value) => (
              <MenuItem key={value} value={value}>
                {TRIP_EXPENSE_CATEGORY_LABEL[value]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Valor"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputProps={{ min: 0, step: '0.01' }}
            fullWidth
          />
          <TextField
            label="Observação"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
            inputProps={{ maxLength: 300 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => {
            if (!(Number(amount) > 0)) {
              enqueueSnackbar('Informe o valor.', { variant: 'warning' });
              return;
            }
            onSubmit({ category, amount: Number(amount), note: note || null });
          }}
        >
          Lançar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CloseTripDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (payload: { managerPercent?: number; helperAmount?: number }) => void;
}) {
  const [managerPercent, setManagerPercent] = useState('');
  const [helperAmount, setHelperAmount] = useState('');

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Fechar viagem (batimento + folha)</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            A comissão do representante (modelo B) é calculada do recebido ÷ carteira. Gerente e
            ajudante são os inputs manuais da folha — persistidos com o fechamento.
          </Typography>
          <TextField
            label="Gerente (% sobre o recebido)"
            type="number"
            value={managerPercent}
            onChange={(event) => setManagerPercent(event.target.value)}
            inputProps={{ min: 0, max: 100, step: '0.01' }}
            fullWidth
          />
          <TextField
            label="Ajudante (valor fixo R$)"
            type="number"
            value={helperAmount}
            onChange={(event) => setHelperAmount(event.target.value)}
            inputProps={{ min: 0, step: '0.01' }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() =>
            onSubmit({
              managerPercent: managerPercent ? Number(managerPercent) : undefined,
              helperAmount: helperAmount ? Number(helperAmount) : undefined,
            })
          }
        >
          Fechar viagem
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Fechar o acerto do pedido: sem linhas = os itens do pedido inteiros; com devolução/troca, o
 * operador informa o VENDIDO REAL — baixar o total após devolução baixaria duas vezes.
 */
function CloseOrderDialog({
  order,
  productName,
  onClose,
  onSubmit,
}: {
  order: Order;
  productName: Map<string, string>;
  onClose: () => void;
  onSubmit: (soldLines: { productId: string; quantity: number }[] | null) => void;
}) {
  const [adjust, setAdjust] = useState(false);
  const [rows, setRows] = useState(
    order.items.map((item) => ({ productId: item.productId, quantity: String(item.quantity) })),
  );

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Fechar acerto — pedido #{order.number}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            A venda do consignado e a saída física da carga são o MESMO evento: fechar registra o
            sale_out na carga e emite a natureza fiscal (no-op até o FIS).
          </Typography>
          <Button variant={adjust ? 'contained' : 'outlined'} onClick={() => setAdjust((v) => !v)}>
            {adjust ? 'Informando o vendido real' : 'Houve devolução/troca? Ajustar o vendido'}
          </Button>
          {adjust
            ? rows.map((row, index) => (
                <Stack key={row.productId} direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {productName.get(row.productId) ?? row.productId.slice(0, 8)}
                  </Typography>
                  <TextField
                    label="Qtd vendida"
                    type="number"
                    value={row.quantity}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((r, i) =>
                          i === index ? { ...r, quantity: event.target.value } : r,
                        ),
                      )
                    }
                    size="small"
                    inputProps={{ min: 0, step: '1' }}
                    sx={{ width: 130 }}
                  />
                </Stack>
              ))
            : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() =>
            onSubmit(
              adjust
                ? rows
                    .filter((row) => Number(row.quantity) > 0)
                    .map((row) => ({ productId: row.productId, quantity: Number(row.quantity) }))
                : null,
            )
          }
        >
          Fechar acerto
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PromissoryDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<PromissoryNoteResult | null>(null);

  async function generate() {
    if (!dueDate) {
      enqueueSnackbar('Informe o vencimento (≈ próxima passagem).', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      setNote(await routeService.generatePromissory(order.id, { dueDate: `${dueDate}T00:00:00` }));
      enqueueSnackbar('Promissória gerada — 1 por pedido, reimpressão sempre possível.', {
        variant: 'success',
      });
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Promissória — pedido #{order.number}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {note ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>{formatMoney(note.amount)}</strong> — {note.amountInWords}
              </Typography>
              <Typography variant="body2">
                Devedora: {note.debtorName}
                {note.debtorDocument ? ` (${note.debtorDocument})` : ''}
              </Typography>
              <Typography variant="body2">
                Vencimento: {new Date(note.dueDate).toLocaleDateString('pt-BR')}
              </Typography>
            </Paper>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                Gerada sobre o TOTAL do pedido ({formatMoney(order.total)}), com o valor por extenso
                — o que a térmica imprime como garantia da consignação.
              </Typography>
              <TextField
                type="date"
                label="Vencimento"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Fechar
        </Button>
        {!note ? (
          <Button variant="contained" onClick={() => void generate()} disabled={saving}>
            Gerar promissória
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
