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
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/PageHeader';
import financeService from 'src/services/financeService';
import { apiErrorMessage } from 'src/services/api';
import { formatCents } from 'src/types/account';
import {
  BankAccount,
  CATEGORY_DIRECTION_LABELS,
  CategoryDirection,
  FinancialCategory,
  toCents,
} from 'src/types/finance';
import { numericSx } from 'src/theme/theme';

interface AccountForm {
  name: string;
  bank: string;
  openingBalance: string;
  isActive: boolean;
}

const EMPTY_ACCOUNT: AccountForm = { name: '', bank: '', openingBalance: '0,00', isActive: true };

export default function BankAccountsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);

  const [accountOpen, setAccountOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>(EMPTY_ACCOUNT);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<{ name: string; direction: CategoryDirection }>({
    name: '',
    direction: 'out',
  });

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, loadedCategories] = await Promise.all([
        financeService.listBankAccounts(),
        financeService.listCategories(),
      ]);
      setAccounts(loadedAccounts);
      setCategories(loadedCategories);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar os cadastros.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: () => Promise<unknown>, ok: string) {
    try {
      await action();
      enqueueSnackbar(ok, { variant: 'success' });
      await load();
      return true;
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível concluir.'), { variant: 'error' });
      return false;
    }
  }

  function openCreateAccount() {
    setEditing(null);
    setAccountForm(EMPTY_ACCOUNT);
    setAccountOpen(true);
  }

  function openEditAccount(account: BankAccount) {
    setEditing(account);
    setAccountForm({
      name: account.name,
      bank: account.bank ?? '',
      openingBalance: (account.openingBalanceCents / 100).toFixed(2).replace('.', ','),
      isActive: account.isActive,
    });
    setAccountOpen(true);
  }

  async function submitAccount() {
    const payload = {
      name: accountForm.name,
      bank: accountForm.bank.trim() || null,
      openingBalanceCents: toCents(accountForm.openingBalance),
    };
    const ok = editing
      ? await act(
          () =>
            financeService.updateBankAccount(editing.id, {
              ...payload,
              isActive: accountForm.isActive,
            }),
          'Conta atualizada.',
        )
      : await act(() => financeService.createBankAccount(payload), 'Conta cadastrada.');
    if (ok) setAccountOpen(false);
  }

  async function submitCategory() {
    const ok = await act(() => financeService.createCategory(categoryForm), 'Categoria criada.');
    if (ok) {
      setCategoryOpen(false);
      setCategoryForm({ name: '', direction: 'out' });
    }
  }

  if (loading) {
    return (
      <Box
        role="status"
        aria-label="Carregando"
        sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <PageHeader
        title="Contas e categorias"
        description="A operação tem conta separada para a máquina — e cada conta fecha o seu próprio saldo."
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => setCategoryOpen(true)}>
              + Categoria
            </Button>
            <Button onClick={openCreateAccount}>+ Conta</Button>
          </Stack>
        }
      />

      <Paper variant="outlined" component="section" aria-label="Contas" sx={{ p: 1, mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Conta</TableCell>
              <TableCell>Banco</TableCell>
              <TableCell align="right">Saldo inicial</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell sx={{ fontWeight: 600 }}>{account.name}</TableCell>
                <TableCell>{account.bank ?? '—'}</TableCell>
                <TableCell align="right" sx={numericSx}>
                  {formatCents(account.openingBalanceCents)}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={account.isActive ? 'info' : 'default'}
                    label={account.isActive ? 'Ativa' : 'Inativa'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined" onClick={() => openEditAccount(account)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Nenhuma conta cadastrada. Sem conta, o pagamento de reserva não tem onde entrar.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Paper variant="outlined" component="section" aria-label="Categorias" sx={{ p: 1 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ px: 1, pt: 0.5 }}
        >
          <Typography variant="overline" color="text.secondary">
            Categorias
          </Typography>
          {categories.length === 0 && (
            <Button
              size="small"
              onClick={() =>
                act(() => financeService.seedDefaultCategories(), 'Categorias-padrão criadas.')
              }
            >
              Criar as oito de partida
            </Button>
          )}
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Categoria</TableCell>
              <TableCell>Direção</TableCell>
              <TableCell>Situação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell sx={{ fontWeight: 600 }}>{category.name}</TableCell>
                <TableCell>{CATEGORY_DIRECTION_LABELS[category.direction]}</TableCell>
                <TableCell>{category.isActive ? 'Ativa' : 'Inativa'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={accountOpen} onClose={() => setAccountOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Editar conta' : 'Nova conta'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              fullWidth
              required
              placeholder="Conta principal, Conta da máquina…"
              value={accountForm.name}
              onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
            />
            <TextField
              label="Banco"
              fullWidth
              value={accountForm.bank}
              onChange={(e) => setAccountForm({ ...accountForm, bank: e.target.value })}
            />
            <TextField
              label="Saldo inicial (R$)"
              fullWidth
              helperText="Pode ser zero, e pode ser negativo — é saldo, não preço."
              value={accountForm.openingBalance}
              onChange={(e) => setAccountForm({ ...accountForm, openingBalance: e.target.value })}
            />
            {editing && (
              <FormControlLabel
                control={
                  <Switch
                    checked={accountForm.isActive}
                    onChange={(e) => setAccountForm({ ...accountForm, isActive: e.target.checked })}
                  />
                }
                label="Conta ativa"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setAccountOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submitAccount}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={categoryOpen} onClose={() => setCategoryOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nova categoria</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            A direção é escolhida aqui e não muda depois: mudá-la inverteria o sinal de todo
            lançamento já feito nesta categoria.
          </Alert>
          <Stack spacing={2}>
            <TextField
              label="Nome"
              fullWidth
              required
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            />
            <TextField
              select
              label="Direção"
              fullWidth
              value={categoryForm.direction}
              onChange={(e) =>
                setCategoryForm({ ...categoryForm, direction: e.target.value as CategoryDirection })
              }
            >
              {(['in', 'out'] as CategoryDirection[]).map((direction) => (
                <MenuItem key={direction} value={direction}>
                  {CATEGORY_DIRECTION_LABELS[direction]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setCategoryOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submitCategory}>Criar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
