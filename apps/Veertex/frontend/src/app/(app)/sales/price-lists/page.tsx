'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
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
import salesConfigService from 'src/services/salesConfigService';
import contactService from 'src/services/contactService';
import productService from 'src/services/productService';
import userService from 'src/services/userService';
import { PriceList } from 'src/types/sales';
import { AdminUser, Contact } from 'src/types/admin';
import { Product } from 'src/types/product';

const ADMIN_MAX_WIDTH = 1200;

interface ItemRow {
  productId: string;
  price: string;
  minQuantity: string;
}

const EMPTY_ITEM: ItemRow = { productId: '', price: '', minQuantity: '' };

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Tabelas de preço (02A §3.2): itens produto×preço com quantidade mínima, e o alvo opcional —
 * tabela do CLIENTE ou do VENDEDOR. A resolução na venda (`/price-lists/resolve`) escolhe a mais
 * específica; esta tela só cadastra.
 */
export default function PriceListsPage() {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [lists, setLists] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [sellers, setSellers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PriceList | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [contactId, setContactId] = useState('');
  const [salesRepId, setSalesRepId] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLists(await salesConfigService.listPriceLists(includeInactive));
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar as tabelas de preço.'));
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // Referências do formulário — a lista principal funciona mesmo se alguma falhar.
    void Promise.all([
      productService.list({}),
      contactService.list({ type: 'customer' }),
      userService.list(),
    ])
      .then(([productRows, customerRows, userRows]) => {
        setProducts(productRows);
        setCustomers(customerRows);
        setSellers(userRows);
      })
      .catch(() => undefined);
  }, []);

  const productName = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );
  const customerName = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.displayName])),
    [customers],
  );
  const sellerName = useMemo(
    () => new Map(sellers.map((seller) => [seller.id, seller.name])),
    [sellers],
  );

  function openDialog(list: PriceList | null) {
    setEditing(list);
    setName(list?.name ?? '');
    setContactId(list?.contactId ?? '');
    setSalesRepId(list?.salesRepId ?? '');
    setItems(
      list && list.items.length > 0
        ? list.items.map((item) => ({
            productId: item.productId,
            price: String(item.price),
            minQuantity: item.minQuantity > 0 ? String(item.minQuantity) : '',
          }))
        : [{ ...EMPTY_ITEM }],
    );
    setDialogOpen(true);
  }

  function setItem(index: number, patch: Partial<ItemRow>) {
    setItems((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function save() {
    if (!name.trim()) {
      enqueueSnackbar('Dê um nome à tabela.', { variant: 'warning' });
      return;
    }
    const validItems = items.filter((row) => row.productId && Number(row.price) > 0);
    if (validItems.length === 0) {
      enqueueSnackbar('Adicione ao menos um item com preço.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        contactId: contactId || null,
        salesRepId: salesRepId || null,
        items: validItems.map((row) => ({
          productId: row.productId,
          price: Number(row.price),
          minQuantity: row.minQuantity ? Number(row.minQuantity) : undefined,
        })),
      };
      if (editing) {
        await salesConfigService.updatePriceList(editing.id, payload);
        enqueueSnackbar('Tabela atualizada.', { variant: 'success' });
      } else {
        await salesConfigService.createPriceList(payload);
        enqueueSnackbar('Tabela cadastrada.', { variant: 'success' });
      }
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(list: PriceList) {
    try {
      await salesConfigService.updatePriceList(list.id, { active: !list.active });
      enqueueSnackbar(list.active ? 'Tabela desativada.' : 'Tabela reativada.', {
        variant: 'success',
      });
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    }
  }

  const isEmpty = lists.length === 0;

  return (
    <Box
      component="section"
      aria-label="Tabelas de preço"
      sx={{ maxWidth: ADMIN_MAX_WIDTH, mx: 'auto' }}
    >
      <PageHeader
        title="Tabelas de preço"
        description="Preços por produto, com tabela geral, por cliente ou por vendedor."
        action={
          can('sales.settings.manage') ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog(null)}>
              Nova tabela
            </Button>
          ) : null
        }
      />

      <FormControlLabel
        sx={{ mb: 2 }}
        control={
          <Switch
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
        }
        label="Incluir inativas"
      />

      {loading || error || isEmpty ? (
        <DataState
          loading={loading}
          error={error}
          empty={isEmpty}
          emptyMessage="Nenhuma tabela de preço cadastrada."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="Lista de tabelas de preço">
            <TableHead>
              <TableRow>
                <TableCell>Tabela</TableCell>
                <TableCell>Alvo</TableCell>
                <TableCell align="right">Itens</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lists.map((list) => (
                <TableRow key={list.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {list.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {list.contactId
                      ? `Cliente: ${customerName.get(list.contactId) ?? list.contactId}`
                      : list.salesRepId
                        ? `Vendedor: ${sellerName.get(list.salesRepId) ?? list.salesRepId}`
                        : 'Geral'}
                  </TableCell>
                  <TableCell align="right">{list.items.length}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={list.active ? 'Ativa' : 'Inativa'}
                      color={list.active ? 'success' : 'default'}
                      variant={list.active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {can('sales.settings.manage') ? (
                        <>
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              aria-label={`Editar ${list.name}`}
                              onClick={() => openDialog(list)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={list.active ? 'Desativar' : 'Reativar'}>
                            <Switch
                              size="small"
                              checked={list.active}
                              onChange={() => void toggleActive(list)}
                              inputProps={{
                                'aria-label': `${list.active ? 'Desativar' : 'Reativar'} ${list.name}`,
                              }}
                            />
                          </Tooltip>
                        </>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={dialogOpen}
        onClose={saving ? undefined : () => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{editing ? 'Editar tabela de preço' : 'Nova tabela de preço'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              inputProps={{ maxLength: 120 }}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Cliente (tabela do cliente)"
                value={contactId}
                onChange={(event) => {
                  setContactId(event.target.value);
                  if (event.target.value) setSalesRepId('');
                }}
                fullWidth
                helperText="Opcional — vale só para este cliente."
              >
                <MenuItem value="">Nenhum (tabela geral)</MenuItem>
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.displayName}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Vendedor (tabela do vendedor)"
                value={salesRepId}
                onChange={(event) => {
                  setSalesRepId(event.target.value);
                  if (event.target.value) setContactId('');
                }}
                fullWidth
                helperText="Opcional — vale para as vendas deste vendedor."
              >
                <MenuItem value="">Nenhum</MenuItem>
                {sellers.map((seller) => (
                  <MenuItem key={seller.id} value={seller.id}>
                    {seller.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Typography variant="subtitle2">Itens</Typography>
            {items.map((row, index) => (
              <Stack key={index} direction="row" spacing={1.5} alignItems="center">
                <TextField
                  select
                  label="Produto"
                  value={row.productId}
                  onChange={(event) => setItem(index, { productId: event.target.value })}
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
                  label="Preço"
                  type="number"
                  value={row.price}
                  onChange={(event) => setItem(index, { price: event.target.value })}
                  inputProps={{ min: 0, step: '0.01' }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Qtd. mínima"
                  type="number"
                  value={row.minQuantity}
                  onChange={(event) => setItem(index, { minQuantity: event.target.value })}
                  inputProps={{ min: 0, step: '1' }}
                  sx={{ flex: 1 }}
                />
                <IconButton
                  aria-label="Remover item"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  disabled={items.length === 1}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Button
              onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}
              sx={{ alignSelf: 'flex-start' }}
            >
              Adicionar item
            </Button>
            {items.some((row) => row.productId && Number(row.price) > 0) ? (
              <Typography variant="caption" color="text.secondary">
                {items.filter((row) => row.productId && Number(row.price) > 0).length} item(ns)
                válido(s) —{' '}
                {items
                  .filter((row) => row.productId && Number(row.price) > 0)
                  .map(
                    (row) =>
                      `${productName.get(row.productId) ?? 'Produto'}: ${formatMoney(Number(row.price))}`,
                  )
                  .join(' · ')}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
