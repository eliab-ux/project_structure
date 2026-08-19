'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/PageHeader';
import financeService from 'src/services/financeService';
import { apiErrorMessage } from 'src/services/api';
import { formatCents } from 'src/types/account';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from 'src/types/schedule';
import {
  Balances,
  BankAccount,
  CASH_ENTRY_TYPE_LABELS,
  CashEntry,
  FinancialCategory,
  formatDay,
  formatSlot,
  monthRange,
  toCents,
} from 'src/types/finance';
import { numericSx } from 'src/theme/theme';

const HOJE = new Date();

interface EntryForm {
  type: 'in' | 'out';
  occurredOn: string;
  amount: string;
  categoryId: string;
  bankAccountId: string;
  description: string;
  payee: string;
  paymentMethod: string;
}

interface TransferForm {
  occurredOn: string;
  amount: string;
  fromAccountId: string;
  toAccountId: string;
  description: string;
}

const hoje = () => new Date().toISOString().slice(0, 10);

const EMPTY_ENTRY: EntryForm = {
  type: 'out',
  occurredOn: hoje(),
  amount: '',
  categoryId: '',
  bankAccountId: '',
  description: '',
  payee: '',
  paymentMethod: '',
};

const EMPTY_TRANSFER: TransferForm = {
  occurredOn: hoje(),
  amount: '',
  fromAccountId: '',
  toAccountId: '',
  description: '',
};

export default function CashEntriesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(monthRange(HOJE));
  /** Extrato por conta: vazio = todas. A transferência aparece nas duas pontas. */
  const [filterAccountId, setFilterAccountId] = useState('');
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [balances, setBalances] = useState<Balances | null>(null);

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryForm, setEntryForm] = useState<EntryForm>(EMPTY_ENTRY);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferForm>(EMPTY_TRANSFER);
  const [cancelling, setCancelling] = useState<CashEntry | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    try {
      const [loadedEntries, loadedAccounts, loadedCategories, loadedBalances] = await Promise.all([
        financeService.listEntries(range.from, range.to, filterAccountId || undefined),
        financeService.listBankAccounts(),
        financeService.listCategories(),
        financeService.balances(range.to),
      ]);
      setEntries(loadedEntries);
      setAccounts(loadedAccounts);
      setCategories(loadedCategories);
      setBalances(loadedBalances);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar o caixa.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [range, filterAccountId, enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);
  const categoriesOfType = useMemo(
    () => categories.filter((c) => c.isActive && c.direction === entryForm.type),
    [categories, entryForm.type],
  );

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

  function openEntry(type: 'in' | 'out') {
    setEntryForm({
      ...EMPTY_ENTRY,
      type,
      bankAccountId: activeAccounts[0]?.id ?? '',
    });
    setEntryOpen(true);
  }

  async function submitEntry() {
    const ok = await act(
      () =>
        financeService.createEntry({
          type: entryForm.type,
          occurredOn: entryForm.occurredOn,
          amountCents: toCents(entryForm.amount),
          categoryId: entryForm.categoryId,
          bankAccountId: entryForm.bankAccountId,
          description: entryForm.description,
          payee: entryForm.payee.trim() || null,
          paymentMethod: entryForm.paymentMethod || null,
        }),
      'Lançamento registrado.',
    );
    if (ok) setEntryOpen(false);
  }

  async function submitTransfer() {
    const ok = await act(
      () =>
        financeService.createTransfer({
          occurredOn: transferForm.occurredOn,
          amountCents: toCents(transferForm.amount),
          fromAccountId: transferForm.fromAccountId,
          toAccountId: transferForm.toAccountId,
          description: transferForm.description,
        }),
      'Transferência registrada. Ela move saldo, mas não entra no DRE.',
    );
    if (ok) setTransferOpen(false);
  }

  async function submitCancel() {
    if (!cancelling) return;
    const ok = await act(
      () => financeService.cancelEntry(cancelling.id, cancelReason),
      'Lançamento cancelado. Ele sai do saldo e do DRE, mas continua no histórico.',
    );
    if (ok) {
      setCancelling(null);
      setCancelReason('');
    }
  }

  async function semear() {
    await act(
      () => financeService.seedDefaultCategories(),
      'Categorias-padrão criadas. Rodar de novo não duplica nada.',
    );
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
        title="Lançamentos"
        description="Regime de caixa: o que vale é o dia em que o dinheiro entrou ou saiu, não o da reserva."
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <TextField
              type="date"
              size="small"
              label="De"
              InputLabelProps={{ shrink: true }}
              value={range.from}
              onChange={(event) => setRange({ ...range, from: event.target.value })}
            />
            <TextField
              type="date"
              size="small"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={range.to}
              onChange={(event) => setRange({ ...range, to: event.target.value })}
            />
            <TextField
              select
              size="small"
              label="Conta"
              sx={{ minWidth: 160 }}
              value={filterAccountId}
              onChange={(event) => setFilterAccountId(event.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={() => openEntry('in')}>
              + Entrada
            </Button>
            <Button onClick={() => openEntry('out')}>+ Saída</Button>
            <Button variant="outlined" onClick={() => setTransferOpen(true)}>
              Transferir
            </Button>
          </Stack>
        }
      />

      {/* ==== Saldos por conta ==== */}
      <Stack
        component="section"
        aria-label="Saldos por conta"
        direction="row"
        spacing={1.5}
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 2 }}
      >
        {balances?.accounts.map((account) => (
          <Paper key={account.bankAccountId} variant="outlined" sx={{ p: 1.5, minWidth: 190 }}>
            <Typography variant="overline" color="text.secondary">
              {account.name}
            </Typography>
            <Typography
              sx={{
                ...numericSx,
                fontSize: 22,
                fontWeight: 600,
                color: account.balanceCents < 0 ? 'error.main' : 'text.primary',
              }}
            >
              {formatCents(account.balanceCents)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={numericSx}>
              Inicial {formatCents(account.openingBalanceCents)}
            </Typography>
          </Paper>
        ))}
        {balances && balances.accounts.length > 1 && (
          <Paper variant="outlined" sx={{ p: 1.5, minWidth: 190, bgcolor: 'background.default' }}>
            <Typography variant="overline" color="text.secondary">
              Total em caixa
            </Typography>
            <Typography sx={{ ...numericSx, fontSize: 22, fontWeight: 600 }}>
              {formatCents(balances.totalBalanceCents)}
            </Typography>
          </Paper>
        )}
      </Stack>

      {categories.length === 0 && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button size="small" onClick={semear}>
              Criar padrão
            </Button>
          }
        >
          Ainda não há categorias. As oito de partida cobrem a operação: Hora de máquina, Outras
          entradas, Insumos, Salários, Contratos de prestador, Energia, Manutenção e Taxas.
        </Alert>
      )}

      <Paper variant="outlined" component="section" aria-label="Lançamentos" sx={{ p: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell>Conta</TableCell>
              <TableCell align="right">Valor</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry) => {
              const cancelado = Boolean(entry.cancelledAt);
              return (
                <TableRow
                  key={entry.id}
                  sx={{ opacity: cancelado ? 0.55 : 1 }}
                  title={cancelado ? `Cancelado: ${entry.cancelledReason}` : undefined}
                >
                  <TableCell sx={numericSx}>{formatDay(entry.occurredOn)}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, textDecoration: cancelado ? 'line-through' : 'none' }}
                    >
                      {entry.description}
                    </Typography>
                    {/* O caminho de volta até o pedido. O pagamento é a catraca que libera a
                        reserva para o Modelista, então quem confere o caixa precisa enxergar qual
                        hora de máquina cada entrada pagou — sem abrir a agenda em outra aba. */}
                    {entry.reservation && (
                      <Typography
                        variant="body2"
                        sx={{ color: 'info.main', fontSize: 12.5, fontWeight: 500 }}
                      >
                        {entry.reservation.customerName} · {formatSlot(entry.reservation.startsAt)}{' '}
                        · {entry.reservation.hours}h · {entry.reservation.machineName}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {entry.payee ?? ''}
                      {cancelado
                        ? ` · Cancelado por ${entry.cancelledBy?.name}: ${entry.cancelledReason}`
                        : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {entry.type === 'transfer' ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`→ ${entry.counterpartAccount?.name ?? ''}`}
                      />
                    ) : (
                      (entry.category?.name ?? '—')
                    )}
                  </TableCell>
                  <TableCell>{entry.bankAccount.name}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      ...numericSx,
                      fontWeight: 600,
                      color:
                        entry.type === 'in'
                          ? 'success.main'
                          : entry.type === 'out'
                            ? 'error.main'
                            : 'text.secondary',
                    }}
                  >
                    {entry.type === 'out' ? '−' : entry.type === 'in' ? '+' : ''}
                    {formatCents(entry.amountCents)}
                  </TableCell>
                  <TableCell align="right">
                    {/* Não há "Editar": valor efetivado não se corrige, cancela-se (§4.15). */}
                    {!cancelado && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => {
                          setCancelling(entry);
                          setCancelReason('');
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Nenhum lançamento no período.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* ==== Novo lançamento ==== */}
      <Dialog open={entryOpen} onClose={() => setEntryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {entryForm.type === 'in' ? 'Nova entrada' : 'Nova saída'}
          <Typography variant="body2" color="text.secondary">
            {CASH_ENTRY_TYPE_LABELS[entryForm.type]} no dia em que o dinheiro se moveu.
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                type="date"
                label="Data"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={entryForm.occurredOn}
                onChange={(e) => setEntryForm({ ...entryForm, occurredOn: e.target.value })}
              />
              <TextField
                label="Valor (R$)"
                fullWidth
                required
                placeholder="1.250,00"
                value={entryForm.amount}
                onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
              />
            </Stack>
            <TextField
              select
              label="Categoria"
              fullWidth
              required
              value={entryForm.categoryId}
              onChange={(e) => setEntryForm({ ...entryForm, categoryId: e.target.value })}
            >
              {categoriesOfType.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Conta"
              fullWidth
              required
              value={entryForm.bankAccountId}
              onChange={(e) => setEntryForm({ ...entryForm, bankAccountId: e.target.value })}
            >
              {activeAccounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Descrição"
              fullWidth
              required
              value={entryForm.description}
              onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Favorecido"
                fullWidth
                placeholder="Fornecedor, colaborador…"
                value={entryForm.payee}
                onChange={(e) => setEntryForm({ ...entryForm, payee: e.target.value })}
              />
              <TextField
                select
                label="Forma"
                fullWidth
                value={entryForm.paymentMethod}
                onChange={(e) => setEntryForm({ ...entryForm, paymentMethod: e.target.value })}
              >
                <MenuItem value="">—</MenuItem>
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                  <MenuItem key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            {entryForm.type === 'out' && (
              <Alert severity="info">
                Salário e contrato de prestador entram aqui, como saída com categoria e favorecido.
                Encargo e holerite continuam com a contabilidade — isto é caixa, não folha.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setEntryOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submitEntry}>Lançar</Button>
        </DialogActions>
      </Dialog>

      {/* ==== Transferência ==== */}
      <Dialog open={transferOpen} onClose={() => setTransferOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Transferência entre contas</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Transferência não é receita nem despesa: ela move saldo entre as suas contas e fica fora
            do DRE. Sem isso, tirar dinheiro da conta da máquina inflaria o mês.
          </Alert>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField
                type="date"
                label="Data"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={transferForm.occurredOn}
                onChange={(e) => setTransferForm({ ...transferForm, occurredOn: e.target.value })}
              />
              <TextField
                label="Valor (R$)"
                fullWidth
                required
                placeholder="500,00"
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
              />
            </Stack>
            <TextField
              select
              label="De"
              fullWidth
              required
              value={transferForm.fromAccountId}
              onChange={(e) => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}
            >
              {activeAccounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Para"
              fullWidth
              required
              value={transferForm.toAccountId}
              onChange={(e) => setTransferForm({ ...transferForm, toAccountId: e.target.value })}
            >
              {activeAccounts
                .filter((account) => account.id !== transferForm.fromAccountId)
                .map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Descrição"
              fullWidth
              required
              value={transferForm.description}
              onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setTransferOpen(false)}>
            Fechar
          </Button>
          <Button onClick={submitTransfer}>Transferir</Button>
        </DialogActions>
      </Dialog>

      {/* ==== Cancelamento ==== */}
      <Dialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Cancelar lançamento</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            O lançamento não é apagado: ele sai do saldo e do DRE e continua consultável, com o
            motivo e o seu nome. É assim que dá para auditar depois.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {cancelling?.description} · {cancelling ? formatCents(cancelling.amountCents) : ''}
          </Typography>
          <TextField
            label="Motivo"
            fullWidth
            required
            multiline
            minRows={2}
            placeholder="Ex.: lançado na conta errada"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setCancelling(null)}>
            Voltar
          </Button>
          <Button color="error" onClick={submitCancel}>
            Cancelar lançamento
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
