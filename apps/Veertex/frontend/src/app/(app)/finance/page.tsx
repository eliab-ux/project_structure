'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import companyService from 'src/services/companyService';
import contactService from 'src/services/contactService';
import financeService, { FinanceDashboard } from 'src/services/financeService';
import { Company, Contact } from 'src/types/admin';
import {
  CATEGORY_KIND_LABEL,
  CATEGORY_KINDS,
  CategoryKind,
  FINANCIAL_ACCOUNT_TYPE_LABEL,
  FINANCIAL_ACCOUNT_TYPES,
  FinancialAccount,
  FinancialAccountType,
  FinancialCategory,
  FinancialTitle,
  SETTLEMENT_METHOD_LABEL,
  SETTLEMENT_METHODS,
  SettlementMethod,
  TITLE_STATUS_LABEL,
  TitleDirection,
  TitleStatus,
} from 'src/types/finance';

const MAX_WIDTH = 1280;

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

const STATUS_CHIP: Record<TitleStatus, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  open: 'info',
  partial: 'warning',
  settled: 'success',
  renegotiated: 'default',
  written_off_pending: 'error',
  written_off: 'error',
};

/**
 * FINANCEIRO (05): títulos (a receber/a pagar) com baixas parciais no MESMO título, contas
 * financeiras e a árvore de categorias. A situação do título é DERIVADA das baixas — não existe
 * "marcar como pago" sem dizer em qual conta o dinheiro entrou.
 */
export default function FinancePage() {
  const [tab, setTab] = useState(0);
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [dashboardCompany, setDashboardCompany] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);

  const reloadRefs = useCallback(async () => {
    const [accountRows, categoryRows] = await Promise.all([
      financeService.listAccounts().catch(() => [] as FinancialAccount[]),
      financeService.listCategories().catch(() => [] as FinancialCategory[]),
    ]);
    setAccounts(accountRows);
    setCategories(categoryRows);
  }, []);

  useEffect(() => {
    void Promise.all([companyService.list(), contactService.list({})])
      .then(([companyRows, contactRows]) => {
        setCompanies(companyRows);
        setContacts(contactRows);
      })
      .catch(() => undefined);
    void reloadRefs();
  }, [reloadRefs]);

  useEffect(() => {
    void financeService
      .dashboard(dashboardCompany || undefined)
      .then(setDashboard)
      .catch(() => setDashboard(null));
  }, [dashboardCompany]);

  return (
    <Box component="section" aria-label="Financeiro" sx={{ maxWidth: MAX_WIDTH, mx: 'auto' }}>
      <PageHeader
        title="Financeiro"
        description="Títulos a receber e a pagar, baixas, contas e categorias."
      />

      {dashboard ? (
        <Stack spacing={1.5} sx={{ mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Últimos 7 dias
              {dashboard.totals.receivedPrevious7d > 0 || dashboard.totals.paidPrevious7d > 0
                ? ' (comparado com os 7 anteriores)'
                : ''}
            </Typography>
            <TextField
              select
              label="Empresa"
              value={dashboardCompany}
              onChange={(event) => setDashboardCompany(event.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {companies.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.displayName}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <DashboardCard
              label="Recebido"
              value={dashboard.totals.received7d}
              previous={dashboard.totals.receivedPrevious7d}
            />
            <DashboardCard
              label="Pago"
              value={dashboard.totals.paid7d}
              previous={dashboard.totals.paidPrevious7d}
            />
            <DashboardCard
              label="Vencido a receber"
              value={dashboard.totals.overdueReceivable}
              warn
            />
            <DashboardCard
              label="A receber em 7 dias"
              value={dashboard.totals.dueNext7dReceivable}
            />
            <DashboardCard label="A pagar em 7 dias" value={dashboard.totals.dueNext7dPayable} />
          </Stack>
        </Stack>
      ) : null}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}>
        <Tab label="Títulos" />
        <Tab label="Contas" />
        <Tab label="Categorias" />
      </Tabs>

      {tab === 0 ? (
        <TitlesTab
          companies={companies}
          contacts={contacts}
          accounts={accounts}
          categories={categories}
        />
      ) : tab === 1 ? (
        <AccountsTab accounts={accounts} onChanged={() => void reloadRefs()} />
      ) : (
        <CategoriesTab categories={categories} onChanged={() => void reloadRefs()} />
      )}
    </Box>
  );
}

// ── Títulos ──────────────────────────────────────────────────────────────────────────────────────

function TitlesTab({
  companies,
  contacts,
  accounts,
  categories,
}: {
  companies: Company[];
  contacts: Contact[];
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
}) {
  const { can } = useAuth();

  const [direction, setDirection] = useState<TitleDirection>('receivable');
  const [titles, setTitles] = useState<FinancialTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [settling, setSettling] = useState<FinancialTitle | null>(null);

  const canCreate =
    direction === 'receivable' ? can('finance.receivable.manage') : can('finance.payable.manage');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTitles(
        await financeService.listTitles(direction, {
          status: statusFilter || undefined,
          companyId: companyFilter || undefined,
        }),
      );
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar os títulos.'));
    } finally {
      setLoading(false);
    }
  }, [direction, statusFilter, companyFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const contactName = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact.displayName])),
    [contacts],
  );
  const companyName = useMemo(
    () => new Map(companies.map((company) => [company.id, company.displayName])),
    [companies],
  );

  const totals = useMemo(() => {
    const open = titles
      .filter((title) => title.status === 'open' || title.status === 'partial')
      .reduce((sum, title) => sum + title.openAmount, 0);
    const overdue = titles
      .filter(
        (title) =>
          (title.status === 'open' || title.status === 'partial') &&
          new Date(title.dueDate).getTime() < Date.now(),
      )
      .reduce((sum, title) => sum + title.openAmount, 0);
    return { open, overdue };
  }, [titles]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Tabs value={direction} onChange={(_, value) => setDirection(value)}>
          <Tab label="A receber" value="receivable" />
          <Tab label="A pagar" value="payable" />
        </Tabs>
        <TextField
          select
          label="Situação"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          size="small"
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {Object.entries(TITLE_STATUS_LABEL).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Empresa"
          value={companyFilter}
          onChange={(event) => setCompanyFilter(event.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {companies.map((company) => (
            <MenuItem key={company.id} value={company.id}>
              {company.displayName}
            </MenuItem>
          ))}
        </TextField>
        {canCreate ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Novo título
          </Button>
        ) : null}
      </Stack>

      <Stack direction="row" spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Em aberto (filtro atual)
          </Typography>
          <Typography variant="h6">{formatMoney(totals.open)}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Vencido
          </Typography>
          <Typography variant="h6" color={totals.overdue > 0 ? 'error.main' : undefined}>
            {formatMoney(totals.overdue)}
          </Typography>
        </Paper>
      </Stack>

      {loading || error || titles.length === 0 ? (
        <DataState
          loading={loading}
          error={error}
          empty={titles.length === 0}
          emptyMessage="Nenhum título para este filtro."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Títulos financeiros">
            <TableHead>
              <TableRow>
                <TableCell>Descrição</TableCell>
                <TableCell>Contato</TableCell>
                <TableCell>Empresa</TableCell>
                <TableCell>Vencimento</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell align="right">Em aberto</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {titles.map((title) => {
                const overdue =
                  (title.status === 'open' || title.status === 'partial') &&
                  new Date(title.dueDate).getTime() < Date.now();
                return (
                  <TableRow key={title.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {title.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {title.origin !== 'manual' ? `origem: ${title.origin}` : null}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {title.contactId ? (contactName.get(title.contactId) ?? '—') : '—'}
                    </TableCell>
                    <TableCell>{companyName.get(title.companyId) ?? '—'}</TableCell>
                    <TableCell sx={{ color: overdue ? 'error.main' : undefined }}>
                      {formatDate(title.dueDate)}
                    </TableCell>
                    <TableCell align="right">{formatMoney(title.amount)}</TableCell>
                    <TableCell align="right">{formatMoney(title.openAmount)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={TITLE_STATUS_LABEL[title.status] ?? title.status}
                        color={STATUS_CHIP[title.status] ?? 'default'}
                        variant={title.status === 'settled' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {can('finance.settle') &&
                      (title.status === 'open' || title.status === 'partial') ? (
                        <Button size="small" onClick={() => setSettling(title)}>
                          Dar baixa
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {createOpen ? (
        <CreateTitleDialog
          direction={direction}
          companies={companies}
          contacts={contacts}
          categories={categories}
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      ) : null}

      {settling ? (
        <SettleDialog
          title={settling}
          accounts={accounts}
          onClose={() => setSettling(null)}
          onDone={() => {
            setSettling(null);
            void load();
          }}
        />
      ) : null}
    </Stack>
  );
}

function CreateTitleDialog({
  direction,
  companies,
  contacts,
  categories,
  onClose,
  onDone,
}: {
  direction: TitleDirection;
  companies: Company[];
  contacts: Contact[];
  categories: FinancialCategory[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState(companies.length === 1 ? companies[0].id : '');
  const [contactId, setContactId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [occurrences, setOccurrences] = useState('12');

  async function save() {
    if (!companyId || !description.trim() || !(Number(amount) > 0) || !dueDate) {
      enqueueSnackbar('Preencha empresa, descrição, valor e vencimento.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const base = {
        companyId,
        contactId: contactId || null,
        categoryId: categoryId || null,
        description: description.trim(),
        amount: Number(amount),
        dueDate: `${dueDate}T00:00:00`,
      };
      if (direction === 'payable' && recurring) {
        const titles = await financeService.createRecurringPayable({
          ...base,
          firstDueDate: `${dueDate}T00:00:00`,
          occurrences: Math.max(1, Math.min(60, Number(occurrences) || 1)),
        });
        enqueueSnackbar(`${titles.length} título(s) mensais gerados.`, { variant: 'success' });
      } else {
        await financeService.createTitle(direction, base);
        enqueueSnackbar('Título lançado.', { variant: 'success' });
      }
      onDone();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {direction === 'receivable' ? 'Novo título a receber' : 'Novo título a pagar'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            select
            label="Empresa"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
            fullWidth
            required
          >
            {companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>
                {company.displayName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Contato"
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            fullWidth
          >
            <MenuItem value="">Nenhum</MenuItem>
            {contacts.map((contact) => (
              <MenuItem key={contact.id} value={contact.id}>
                {contact.displayName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Categoria"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            fullWidth
          >
            <MenuItem value="">Nenhuma</MenuItem>
            {categories
              .filter((category) => category.active)
              .map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            label="Descrição"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            fullWidth
            required
            inputProps={{ maxLength: 200 }}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Valor"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
              required
            />
            <TextField
              type="date"
              label={recurring ? 'Primeiro vencimento' : 'Vencimento'}
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
          </Stack>
          {direction === 'payable' ? (
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    checked={recurring}
                    onChange={(event) => setRecurring(event.target.checked)}
                  />
                }
                label="Recorrente (mensal)"
              />
              {recurring ? (
                <TextField
                  label="Parcelas"
                  type="number"
                  value={occurrences}
                  onChange={(event) => setOccurrences(event.target.value)}
                  inputProps={{ min: 1, max: 60 }}
                  size="small"
                  sx={{ width: 110 }}
                />
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          Lançar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SettleDialog({
  title,
  accounts,
  onClose,
  onDone,
}: {
  title: FinancialTitle;
  accounts: FinancialAccount[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const [financialAccountId, setFinancialAccountId] = useState(
    accounts.length === 1 ? accounts[0].id : '',
  );
  const [method, setMethod] = useState<SettlementMethod>('pix');
  const [principal, setPrincipal] = useState(String(title.openAmount));
  const [interest, setInterest] = useState('');
  const [fine, setFine] = useState('');
  const [discount, setDiscount] = useState('');

  async function save() {
    if (!financialAccountId || !(Number(principal) > 0)) {
      enqueueSnackbar('Escolha a conta e informe o valor.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const updated = await financeService.settleTitle(title.id, {
        financialAccountId,
        method,
        principal: Number(principal),
        interest: interest ? Number(interest) : undefined,
        fine: fine ? Number(fine) : undefined,
        discount: discount ? Number(discount) : undefined,
      });
      enqueueSnackbar(
        updated.status === 'settled'
          ? 'Título baixado por completo.'
          : `Baixa parcial registrada — em aberto: ${formatMoney(updated.openAmount)}.`,
        { variant: 'success' },
      );
      onDone();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Dar baixa — {title.description}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Em aberto: <strong>{formatMoney(title.openAmount)}</strong> · Vencimento{' '}
            {formatDate(title.dueDate)}
          </Typography>
          <TextField
            select
            label="Conta financeira (onde o dinheiro entra/sai)"
            value={financialAccountId}
            onChange={(event) => setFinancialAccountId(event.target.value)}
            fullWidth
            required
          >
            {accounts
              .filter((account) => account.active)
              .map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name} ({account.typeLabel})
                </MenuItem>
              ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Forma"
              value={method}
              onChange={(event) => setMethod(event.target.value as SettlementMethod)}
              fullWidth
            >
              {SETTLEMENT_METHODS.map((value) => (
                <MenuItem key={value} value={value}>
                  {SETTLEMENT_METHOD_LABEL[value]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Valor (principal)"
              type="number"
              value={principal}
              onChange={(event) => setPrincipal(event.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
              helperText="Menor que o aberto = baixa PARCIAL no mesmo título."
            />
          </Stack>
          <Divider textAlign="left">
            <Typography variant="caption" color="text.secondary">
              Acréscimos / abatimento
            </Typography>
          </Divider>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Juros"
              type="number"
              value={interest}
              onChange={(event) => setInterest(event.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
            />
            <TextField
              label="Multa"
              type="number"
              value={fine}
              onChange={(event) => setFine(event.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
            />
            <TextField
              label="Desconto"
              type="number"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          Registrar baixa
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Contas ───────────────────────────────────────────────────────────────────────────────────────

function AccountsTab({
  accounts,
  onChanged,
}: {
  accounts: FinancialAccount[];
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const canSettings = can('finance.settings');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<FinancialAccountType>('bank');
  const [institution, setInstitution] = useState('');
  const [initialBalance, setInitialBalance] = useState('');

  function openDialog(account: FinancialAccount | null) {
    setEditing(account);
    setName(account?.name ?? '');
    setType(account?.type ?? 'bank');
    setInstitution(account?.institution ?? '');
    setInitialBalance(account ? String(account.initialBalance) : '');
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      enqueueSnackbar('Dê um nome à conta.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await financeService.updateAccount(editing.id, {
          name: name.trim(),
          institution: institution || null,
        });
        enqueueSnackbar('Conta atualizada.', { variant: 'success' });
      } else {
        await financeService.createAccount({
          name: name.trim(),
          type,
          institution: institution || null,
          initialBalance: initialBalance ? Number(initialBalance) : undefined,
        });
        enqueueSnackbar('Conta criada.', { variant: 'success' });
      }
      setDialogOpen(false);
      onChanged();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(account: FinancialAccount) {
    try {
      await financeService.updateAccount(account.id, { active: !account.active });
      enqueueSnackbar(account.active ? 'Conta desativada.' : 'Conta reativada.', {
        variant: 'success',
      });
      onChanged();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    }
  }

  return (
    <Stack spacing={2}>
      {canSettings ? (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openDialog(null)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Nova conta
        </Button>
      ) : null}

      {accounts.length === 0 ? (
        <Typography color="text.secondary">
          Nenhuma conta financeira — a primeira baixa precisa de uma.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Contas financeiras">
            <TableHead>
              <TableRow>
                <TableCell>Conta</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Instituição</TableCell>
                <TableCell align="right">Saldo inicial</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {account.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{account.typeLabel}</TableCell>
                  <TableCell>{account.institution ?? '—'}</TableCell>
                  <TableCell align="right">{formatMoney(account.initialBalance)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={account.active ? 'Ativa' : 'Inativa'}
                      color={account.active ? 'success' : 'default'}
                      variant={account.active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {canSettings ? (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" onClick={() => openDialog(account)}>
                          Editar
                        </Button>
                        <Switch
                          size="small"
                          checked={account.active}
                          onChange={() => void toggleActive(account)}
                          inputProps={{
                            'aria-label': `${account.active ? 'Desativar' : 'Reativar'} ${account.name}`,
                          }}
                        />
                      </Stack>
                    ) : null}
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
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editing ? 'Editar conta' : 'Nova conta financeira'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
              inputProps={{ maxLength: 120 }}
            />
            {!editing ? (
              <TextField
                select
                label="Tipo"
                value={type}
                onChange={(event) => setType(event.target.value as FinancialAccountType)}
                fullWidth
              >
                {FINANCIAL_ACCOUNT_TYPES.map((value) => (
                  <MenuItem key={value} value={value}>
                    {FINANCIAL_ACCOUNT_TYPE_LABEL[value]}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
            <TextField
              label="Instituição"
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
              fullWidth
              inputProps={{ maxLength: 120 }}
            />
            {!editing ? (
              <TextField
                label="Saldo inicial"
                type="number"
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
                inputProps={{ step: '0.01' }}
                fullWidth
              />
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
    </Stack>
  );
}

// ── Categorias (árvore) ──────────────────────────────────────────────────────────────────────────

function CategoriesTab({
  categories,
  onChanged,
}: {
  categories: FinancialCategory[];
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const canSettings = can('finance.settings');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [parentId, setParentId] = useState('');

  // Árvore montada da lista plana: raízes primeiro, filhos indentados sob o pai.
  const tree = useMemo(() => {
    const byParent = new Map<string | null, FinancialCategory[]>();
    for (const category of categories) {
      const key = category.parentId ?? null;
      byParent.set(key, [...(byParent.get(key) ?? []), category]);
    }
    const rows: { category: FinancialCategory; depth: number }[] = [];
    function walk(parent: string | null, depth: number) {
      for (const category of (byParent.get(parent) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        rows.push({ category, depth });
        walk(category.id, depth + 1);
      }
    }
    walk(null, 0);
    return rows;
  }, [categories]);

  function openDialog(category: FinancialCategory | null) {
    setEditing(category);
    setName(category?.name ?? '');
    setKind(category?.kind ?? 'expense');
    setParentId(category?.parentId ?? '');
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      enqueueSnackbar('Dê um nome à categoria.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await financeService.updateCategory(editing.id, {
          name: name.trim(),
          parentId: parentId || null,
        });
        enqueueSnackbar('Categoria atualizada.', { variant: 'success' });
      } else {
        await financeService.createCategory({
          name: name.trim(),
          kind,
          parentId: parentId || null,
        });
        enqueueSnackbar('Categoria criada.', { variant: 'success' });
      }
      setDialogOpen(false);
      onChanged();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2}>
      {canSettings ? (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openDialog(null)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Nova categoria
        </Button>
      ) : null}

      {tree.length === 0 ? (
        <Typography color="text.secondary">Nenhuma categoria cadastrada.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Árvore de categorias">
            <TableHead>
              <TableRow>
                <TableCell>Categoria</TableCell>
                <TableCell>Natureza</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tree.map(({ category, depth }) => (
                <TableRow key={category.id} hover>
                  <TableCell sx={{ pl: 2 + depth * 3 }}>
                    {depth > 0 ? '└ ' : null}
                    {category.name}
                  </TableCell>
                  <TableCell>{CATEGORY_KIND_LABEL[category.kind] ?? category.kind}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={category.active ? 'Ativa' : 'Inativa'}
                      color={category.active ? 'success' : 'default'}
                      variant={category.active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {canSettings ? (
                      <Button size="small" onClick={() => openDialog(category)}>
                        Editar
                      </Button>
                    ) : null}
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
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
              inputProps={{ maxLength: 120 }}
            />
            {!editing ? (
              <TextField
                select
                label="Natureza"
                value={kind}
                onChange={(event) => setKind(event.target.value as CategoryKind)}
                fullWidth
              >
                {CATEGORY_KINDS.map((value) => (
                  <MenuItem key={value} value={value}>
                    {CATEGORY_KIND_LABEL[value]}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
            <TextField
              select
              label="Categoria pai"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              fullWidth
              helperText="Em branco = categoria raiz."
            >
              <MenuItem value="">Nenhuma (raiz)</MenuItem>
              {categories
                .filter((category) => category.id !== editing?.id)
                .map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
            </TextField>
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
    </Stack>
  );
}

function DashboardCard({
  label,
  value,
  previous,
  warn,
}: {
  label: string;
  value: number;
  previous?: number;
  warn?: boolean;
}) {
  const delta = previous !== undefined && previous > 0 ? value - previous : null;
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" color={warn && value > 0 ? 'error.main' : undefined}>
        {formatMoney(value)}
      </Typography>
      {delta !== null ? (
        <Typography
          variant="caption"
          color={delta >= 0 ? 'success.main' : 'error.main'}
          role="status"
        >
          {delta >= 0 ? '+' : ''}
          {formatMoney(delta)} vs. 7 dias anteriores
        </Typography>
      ) : null}
    </Paper>
  );
}
