'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Alert from '@mui/material/Alert';
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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import orderService from 'src/services/orderService';
import companyService from 'src/services/companyService';
import contactService from 'src/services/contactService';
import userService from 'src/services/userService';
import productService from 'src/services/productService';
import stockService from 'src/services/stockService';
import { Company } from 'src/types/admin';
import { Contact } from 'src/types/admin';
import { AdminUser } from 'src/types/admin';
import { Product } from 'src/types/product';
import {
  Order,
  ORDER_ORIGIN_LABEL,
  ORDER_ORIGINS,
  ORDER_STATUS_LABEL,
  OrderOrigin,
  OrderStatus,
} from 'src/types/order';

const MAX_WIDTH = 1280;

/** Referências para os seletores do formulário e da lista — carregadas uma vez. */
interface Refs {
  companies: Company[];
  customers: Contact[];
  sellers: AdminUser[];
  products: Product[];
}

const STATUS_CHIP: Record<OrderStatus, 'default' | 'info' | 'success' | 'warning'> = {
  rascunho: 'default',
  confirmado: 'info',
  faturado: 'warning',
  concluido: 'success',
  cancelado: 'default',
};

/**
 * PEDIDOS — VND (§02). O backend já exige tudo isto; esta tela é a casca que faltava.
 *
 * O que a tela NÃO decide, e por quê: o **limite de crédito** é conferido na confirmação, e a
 * mensagem (limite e excedente) vem do backend — a tela só a exibe. O **faturar** existe no fluxo mas
 * depende de EST/FIN/FIS: em vez de um botão morto, a tela diz o motivo (mesmo raciocínio do cadeado
 * do CORE). O **desconto** só aparece para quem tem `orders.discount.grant` — esconder não é
 * proteger, mas oferecer um controle que o servidor recusa é o defeito oposto.
 */
export default function OrdersPage() {
  const { can, user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const canDiscount = can('orders.discount.grant');

  const [orders, setOrders] = useState<Order[]>([]);
  const [refs, setRefs] = useState<Refs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    status: '',
    companyId: '',
    contactId: '',
    salesRepId: '',
    from: '',
    to: '',
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await orderService.list({
        status: filters.status || undefined,
        companyId: filters.companyId || undefined,
        contactId: filters.contactId || undefined,
        salesRepId: filters.salesRepId || undefined,
        // ISO com hora para o backend cobrir o dia inteiro do "até".
        ...(filters.from ? { from: `${filters.from}T00:00:00` } : {}),
        ...(filters.to ? { to: `${filters.to}T23:59:59` } : {}),
      });
      setOrders(list);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar os pedidos.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  // As referências dos seletores — carregadas uma vez, reusadas pela lista e pelo formulário.
  useEffect(() => {
    let cancelled = false;
    async function loadRefs() {
      try {
        const [companies, customers, sellers, products] = await Promise.all([
          companyService.list(),
          contactService.list({ type: 'customer' }),
          userService.list(),
          productService.list({}),
        ]);
        if (!cancelled) {
          setRefs({ companies, customers, sellers, products });
        }
      } catch {
        // Silencioso: a lista de pedidos ainda funciona; o formulário avisa se as refs faltarem.
      }
    }
    void loadRefs();
    return () => {
      cancelled = true;
    };
  }, []);

  const nameOf = useMemo(() => {
    const company = new Map((refs?.companies ?? []).map((c) => [c.id, c.displayName]));
    const contact = new Map((refs?.customers ?? []).map((c) => [c.id, c.displayName]));
    const seller = new Map((refs?.sellers ?? []).map((u) => [u.id, u.name]));
    return { company, contact, seller };
  }, [refs]);

  async function runAction(order: Order, action: 'confirm' | 'complete' | 'cancel') {
    try {
      const verb = { confirm: 'confirmado', complete: 'concluído', cancel: 'cancelado' }[action];
      await orderService[action](order.id);
      enqueueSnackbar(`Pedido #${order.number} ${verb}.`, { variant: 'success' });
      await load();
    } catch (requestError) {
      // A mensagem do backend é preferida — é ela que nomeia o limite de crédito e o excedente.
      enqueueSnackbar(apiErrorMessage(requestError, 'Não foi possível mudar a situação.'), {
        variant: 'error',
      });
    }
  }

  return (
    <Box component="section" aria-label="Pedidos" sx={{ maxWidth: MAX_WIDTH, mx: 'auto' }}>
      <PageHeader
        title="Pedidos"
        description="Vendas: pedido, itens, situação e limite de crédito."
        action={
          can('orders.create') && refs ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              Novo pedido
            </Button>
          ) : null
        }
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2.5 }} flexWrap="wrap">
        <TextField
          select
          label="Situação"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          sx={{ minWidth: 150 }}
          size="small"
        >
          <MenuItem value="">Todas</MenuItem>
          {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => (
            <MenuItem key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Empresa"
          value={filters.companyId}
          onChange={(e) => setFilters((f) => ({ ...f, companyId: e.target.value }))}
          sx={{ minWidth: 180 }}
          size="small"
        >
          <MenuItem value="">Todas</MenuItem>
          {(refs?.companies ?? []).map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.displayName}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Contato"
          value={filters.contactId}
          onChange={(e) => setFilters((f) => ({ ...f, contactId: e.target.value }))}
          sx={{ minWidth: 180 }}
          size="small"
        >
          <MenuItem value="">Todos</MenuItem>
          {(refs?.customers ?? []).map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.displayName}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Vendedor"
          value={filters.salesRepId}
          onChange={(e) => setFilters((f) => ({ ...f, salesRepId: e.target.value }))}
          sx={{ minWidth: 160 }}
          size="small"
        >
          <MenuItem value="">Todos</MenuItem>
          {(refs?.sellers ?? []).map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {u.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          type="date"
          label="De"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <TextField
          type="date"
          label="Até"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
      </Stack>

      <DataState
        loading={loading}
        error={error}
        empty={orders.length === 0}
        emptyMessage="Nenhum pedido para este filtro."
      />

      {!loading && !error && orders.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="Lista de pedidos">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Empresa</TableCell>
                <TableCell>Origem</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>{order.number}</TableCell>
                  <TableCell>{nameOf.contact.get(order.contactId) ?? '—'}</TableCell>
                  <TableCell>{nameOf.company.get(order.companyId) ?? '—'}</TableCell>
                  <TableCell>{order.originLabel}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={order.statusLabel}
                      color={STATUS_CHIP[order.status]}
                      variant={order.status === 'rascunho' ? 'outlined' : 'filled'}
                    />
                  </TableCell>
                  <TableCell align="right">{formatMoney(order.total)}</TableCell>
                  <TableCell align="right">
                    <OrderActions
                      order={order}
                      canUpdate={can('orders.update')}
                      canCancel={can('orders.cancel')}
                      onEdit={() => {
                        setEditing(order);
                        setDialogOpen(true);
                      }}
                      onAction={(action) => void runAction(order, action)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      {dialogOpen && refs ? (
        <OrderFormDialog
          refs={refs}
          editing={editing}
          canDiscount={canDiscount}
          defaultSellerId={user?.id ?? null}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            void load();
          }}
        />
      ) : null}
    </Box>
  );
}

/**
 * Ações de situação (§3.2). `faturar` NÃO é um botão morto: é um aviso do porquê — depende de
 * EST/FIN/FIS, que não existem. Botão que sempre recusa é promessa falsa (mesmo raciocínio do cadeado
 * do CORE em Módulos).
 */
function OrderActions({
  order,
  canUpdate,
  canCancel,
  onEdit,
  onAction,
}: {
  order: Order;
  canUpdate: boolean;
  canCancel: boolean;
  onEdit: () => void;
  onAction: (action: 'confirm' | 'complete' | 'cancel') => void;
}) {
  return (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
      {order.status === 'rascunho' && canUpdate ? (
        <>
          <Button size="small" onClick={onEdit}>
            Editar
          </Button>
          <Button size="small" variant="outlined" onClick={() => onAction('confirm')}>
            Confirmar
          </Button>
        </>
      ) : null}

      {order.status === 'confirmado' && canUpdate ? (
        <>
          <Button size="small" variant="outlined" onClick={() => onAction('complete')}>
            Concluir
          </Button>
          <Tooltip title="Faturar depende dos módulos de Estoque, Financeiro e Fiscal, que ainda não existem.">
            {/* `span` porque o Tooltip precisa de um filho habilitado para captar o hover. */}
            <span>
              <Button size="small" disabled>
                Faturar
              </Button>
            </span>
          </Tooltip>
        </>
      ) : null}

      {(order.status === 'rascunho' || order.status === 'confirmado') && canCancel ? (
        <Button size="small" color="error" onClick={() => onAction('cancel')}>
          Cancelar
        </Button>
      ) : null}
    </Stack>
  );
}

interface ItemRow {
  productId: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  discountValue: string;
}

const EMPTY_ITEM: ItemRow = {
  productId: '',
  quantity: '1',
  unitPrice: '',
  discountPercent: '',
  discountValue: '',
};

function OrderFormDialog({
  refs,
  editing,
  canDiscount,
  defaultSellerId,
  onClose,
  onSaved,
}: {
  refs: Refs;
  editing: Order | null;
  canDiscount: boolean;
  defaultSellerId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { hasModule } = useAuth();
  const estActive = hasModule('EST');
  const [saving, setSaving] = useState(false);
  // Disponível por produto (§3.9) — é o que decide se dá para confirmar. Só faz sentido com EST.
  const [available, setAvailable] = useState<Record<string, number>>({});

  const [companyId, setCompanyId] = useState(editing?.companyId ?? '');
  const [contactId, setContactId] = useState(editing?.contactId ?? '');
  const [salesRepId, setSalesRepId] = useState(editing?.salesRepId ?? '');
  const [origin, setOrigin] = useState<OrderOrigin>((editing?.origin as OrderOrigin) ?? 'balcao');
  const [referenceDate, setReferenceDate] = useState(
    (editing?.referenceDate ?? new Date().toISOString()).slice(0, 10),
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [orderDiscountPercent, setOrderDiscountPercent] = useState(
    editing && editing.discountPercent ? String(editing.discountPercent) : '',
  );
  const [orderDiscountValue, setOrderDiscountValue] = useState(
    editing && editing.discountValue ? String(editing.discountValue) : '',
  );
  const [items, setItems] = useState<ItemRow[]>(
    editing
      ? editing.items.map((i) => ({
          productId: i.productId,
          quantity: String(i.quantity),
          unitPrice: String(i.unitPrice),
          discountPercent: i.discountPercent ? String(i.discountPercent) : '',
          discountValue: i.discountValue ? String(i.discountValue) : '',
        }))
      : [EMPTY_ITEM],
  );

  const productById = useMemo(() => new Map(refs.products.map((p) => [p.id, p])), [refs.products]);

  function setItem(index: number, patch: Partial<ItemRow>) {
    setItems((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function onPickProduct(index: number, productId: string) {
    const product = productById.get(productId);
    // Preço cai para o base do produto ao escolher — editável (§3.5). Se o produto não tem base, fica
    // em branco e o operador informa.
    setItem(index, {
      productId,
      unitPrice: product?.basePrice != null ? String(product.basePrice) : '',
    });
    // Busca o disponível (§3.9) — a informação que decide a confirmação. Silencioso em falha.
    if (estActive && companyId && productId && available[productId] === undefined) {
      stockService
        .balance(companyId, productId)
        .then((b) => setAvailable((current) => ({ ...current, [productId]: b.available })))
        .catch(() => undefined);
    }
  }

  const total = useMemo(
    () => estimateTotal(items, orderDiscountPercent, orderDiscountValue),
    [items, orderDiscountPercent, orderDiscountValue],
  );

  async function save() {
    if (!editing && !companyId) {
      enqueueSnackbar('Escolha a empresa.', { variant: 'warning' });
      return;
    }
    if (!editing && !contactId) {
      enqueueSnackbar('Escolha o cliente.', { variant: 'warning' });
      return;
    }
    const validItems = items.filter((i) => i.productId && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      enqueueSnackbar('Adicione ao menos um item.', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const itemsPayload = validItems.map((i) => ({
        productId: i.productId,
        quantity: Number(i.quantity),
        unitPrice: i.unitPrice === '' ? null : Number(i.unitPrice),
        discountPercent: canDiscount && i.discountPercent ? Number(i.discountPercent) : null,
        discountValue: canDiscount && i.discountValue ? Number(i.discountValue) : null,
      }));
      const common = {
        salesRepId: salesRepId || null,
        origin,
        items: itemsPayload,
        discountPercent: canDiscount && orderDiscountPercent ? Number(orderDiscountPercent) : null,
        discountValue: canDiscount && orderDiscountValue ? Number(orderDiscountValue) : null,
        notes: notes || null,
        referenceDate: `${referenceDate}T00:00:00`,
      };

      if (editing) {
        await orderService.update(editing.id, common);
        enqueueSnackbar('Pedido atualizado.', { variant: 'success' });
      } else {
        await orderService.create({ companyId, contactId, ...common });
        enqueueSnackbar('Pedido criado (rascunho).', { variant: 'success' });
      }
      onSaved();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError, 'Não foi possível salvar o pedido.'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editing ? `Editar pedido #${editing.number}` : 'Novo pedido'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="Empresa"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              // Empresa e cliente são imutáveis na edição (o pedido pertence a eles): trocar seria
              // outro pedido. O backend só edita rascunho e não os aceita mudados.
              disabled={!!editing}
              fullWidth
              required
            >
              {refs.companies.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.displayName}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Cliente"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              disabled={!!editing}
              fullWidth
              required
              helperText={
                refs.customers.length === 0 ? 'Nenhum contato do tipo cliente.' : undefined
              }
            >
              {refs.customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.displayName}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="Vendedor"
              value={salesRepId}
              onChange={(e) => setSalesRepId(e.target.value)}
              fullWidth
              helperText="Em branco = você."
            >
              <MenuItem value="">
                {defaultSellerId
                  ? `Você${refs.sellers.find((s) => s.id === defaultSellerId) ? ` (${refs.sellers.find((s) => s.id === defaultSellerId)?.name})` : ''}`
                  : 'Você'}
              </MenuItem>
              {refs.sellers.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Origem"
              value={origin}
              onChange={(e) => setOrigin(e.target.value as OrderOrigin)}
              fullWidth
            >
              {ORDER_ORIGINS.map((o) => (
                <MenuItem key={o} value={o}>
                  {ORDER_ORIGIN_LABEL[o]}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              type="date"
              label="Data de referência"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          <Divider textAlign="left">
            <Typography variant="caption" color="text.secondary">
              Itens
            </Typography>
          </Divider>

          <Stack spacing={1.5}>
            {items.map((row, index) => (
              <Paper key={index} variant="outlined" sx={{ p: 1.5, bgcolor: 'vx.panel' }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  alignItems="flex-start"
                >
                  <TextField
                    select
                    label="Produto"
                    value={row.productId}
                    onChange={(e) => onPickProduct(index, e.target.value)}
                    size="small"
                    sx={{ flex: 2, minWidth: 180 }}
                    helperText={
                      estActive && row.productId && available[row.productId] !== undefined
                        ? `Disponível: ${available[row.productId]}`
                        : undefined
                    }
                  >
                    {refs.products
                      .filter((p) => p.active)
                      .map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name}
                        </MenuItem>
                      ))}
                  </TextField>
                  <TextField
                    label="Qtd"
                    value={row.quantity}
                    onChange={(e) => setItem(index, { quantity: e.target.value })}
                    size="small"
                    inputProps={{ inputMode: 'decimal' }}
                    sx={{ width: 90 }}
                  />
                  <TextField
                    label="Preço unit."
                    value={row.unitPrice}
                    onChange={(e) => setItem(index, { unitPrice: e.target.value })}
                    size="small"
                    inputProps={{ inputMode: 'decimal' }}
                    sx={{ width: 120 }}
                  />
                  {canDiscount ? (
                    <>
                      <TextField
                        label="Desc. %"
                        value={row.discountPercent}
                        onChange={(e) => setItem(index, { discountPercent: e.target.value })}
                        size="small"
                        inputProps={{ inputMode: 'decimal' }}
                        sx={{ width: 90 }}
                      />
                      <TextField
                        label="Desc. R$"
                        value={row.discountValue}
                        onChange={(e) => setItem(index, { discountValue: e.target.value })}
                        size="small"
                        inputProps={{ inputMode: 'decimal' }}
                        helperText={row.discountValue ? 'valor vence o %' : undefined}
                        sx={{ width: 110 }}
                      />
                    </>
                  ) : null}
                  <IconButton
                    aria-label="Remover item"
                    onClick={() => setItems((c) => c.filter((_, i) => i !== index))}
                    disabled={items.length === 1}
                    sx={{ mt: 0.5 }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Paper>
            ))}
            <Button
              startIcon={<AddIcon />}
              onClick={() => setItems((c) => [...c, { ...EMPTY_ITEM }])}
              sx={{ alignSelf: 'flex-start' }}
            >
              Adicionar item
            </Button>
          </Stack>

          {canDiscount ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Desconto do pedido (%)"
                value={orderDiscountPercent}
                onChange={(e) => setOrderDiscountPercent(e.target.value)}
                size="small"
                inputProps={{ inputMode: 'decimal' }}
              />
              <TextField
                label="Desconto do pedido (R$)"
                value={orderDiscountValue}
                onChange={(e) => setOrderDiscountValue(e.target.value)}
                size="small"
                inputProps={{ inputMode: 'decimal' }}
                helperText={orderDiscountValue ? 'valor vence o %' : undefined}
              />
            </Stack>
          ) : (
            <Alert severity="info" role="status">
              Você não pode conceder desconto (permissão <strong>orders.discount.grant</strong>).
            </Alert>
          )}

          <TextField
            label="Observações"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
          />

          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" color="text.secondary">
              Total estimado
            </Typography>
            <Typography variant="h2" sx={{ fontSize: '1.4rem' }}>
              {formatMoney(total)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              O total e o bloqueio por limite de crédito são conferidos pelo servidor ao confirmar.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar rascunho'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Estimativa local só para feedback — a verdade do total é do servidor (valor vence percentual). */
function estimateTotal(items: ItemRow[], discPercent: string, discValue: string): number {
  const itemsTotal = items.reduce((sum, row) => {
    const qty = Number(row.quantity) || 0;
    const price = Number(row.unitPrice) || 0;
    const gross = qty * price;
    const discount = row.discountValue
      ? Number(row.discountValue) || 0
      : (gross * (Number(row.discountPercent) || 0)) / 100;
    return sum + Math.max(0, gross - discount);
  }, 0);
  const orderDiscount = discValue
    ? Number(discValue) || 0
    : (itemsTotal * (Number(discPercent) || 0)) / 100;
  return Math.max(0, itemsTotal - orderDiscount);
}
