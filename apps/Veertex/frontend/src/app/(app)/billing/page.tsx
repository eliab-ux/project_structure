'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
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
import billingService, {
  BillingConfig,
  Charge,
  DunningEvent,
  DunningRule,
} from 'src/services/billingService';
import financeService from 'src/services/financeService';
import contactService from 'src/services/contactService';
import { FinancialAccount, FinancialTitle, TITLE_STATUS_LABEL } from 'src/types/finance';
import { Contact } from 'src/types/admin';

const MAX_WIDTH = 1280;

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * COBRANÇA — COB (06): configuração do agregador (fronteira pronta-para-credencial, com Testar),
 * emissão de boleto/Pix de títulos a receber, régua (propostas para aprovar; automático com opt-in
 * por etapa) e inadimplência por cliente (carnê imprimível + renegociação).
 */
export default function BillingPage() {
  const [tab, setTab] = useState(0);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    void financeService
      .listAccounts()
      .then(setAccounts)
      .catch(() => undefined);
    void contactService
      .list({ type: 'customer' })
      .then(setContacts)
      .catch(() => undefined);
  }, []);

  return (
    <Box component="section" aria-label="Cobrança" sx={{ maxWidth: MAX_WIDTH, mx: 'auto' }}>
      <PageHeader
        title="Cobrança"
        description="Boleto/Pix pelo agregador, régua de comunicação e inadimplência."
      />
      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}>
        <Tab label="Cobranças" />
        <Tab label="Régua" />
        <Tab label="Inadimplência" />
        <Tab label="Configuração" />
      </Tabs>

      {tab === 0 ? (
        <ChargesTab />
      ) : tab === 1 ? (
        <DunningTab />
      ) : tab === 2 ? (
        <DelinquencyTab contacts={contacts} />
      ) : (
        <ConfigTab accounts={accounts} />
      )}
    </Box>
  );
}

// ── Configuração ─────────────────────────────────────────────────────────────────────────────────

function ConfigTab({ accounts }: { accounts: FinancialAccount[] }) {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const canManage = can('cob.manage');

  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [provider, setProvider] = useState('asaas');
  const [credentials, setCredentials] = useState('');
  const [agreementCode, setAgreementCode] = useState('');
  const [settlementAccountId, setSettlementAccountId] = useState('');
  const [webhookPath, setWebhookPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    void billingService
      .getConfig()
      .then((current) => {
        setConfig(current);
        if (current) {
          setProvider(current.provider);
          setAgreementCode(current.agreementCode ?? '');
          setSettlementAccountId(current.settlementAccountId);
        }
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    if (!credentials.trim() || !settlementAccountId) {
      enqueueSnackbar('Informe a credencial e a conta de liquidação.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const saved = await billingService.saveConfig({
        provider,
        credentials,
        agreementCode: agreementCode || null,
        settlementAccountId,
      });
      setConfig(saved);
      setWebhookPath(saved.webhookPath);
      setCredentials('');
      enqueueSnackbar('Configuração salva — a credencial foi cifrada.', { variant: 'success' });
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await billingService.testConnection());
    } catch (requestError) {
      setTestResult({ ok: false, message: apiErrorMessage(requestError) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Alert severity="info" role="status">
        A emissão fica pronta-para-credencial: sem o agregador configurado, emitir recusa com
        mensagem clara (nunca um boleto de mentira). Escolhido o agregador e obtida a credencial, o
        adapter real entra sem mudar nada do resto.
      </Alert>

      <TextField
        select
        label="Agregador"
        value={provider}
        onChange={(event) => setProvider(event.target.value)}
        disabled={!canManage}
      >
        <MenuItem value="asaas">Asaas</MenuItem>
        <MenuItem value="kobana">Kobana</MenuItem>
        <MenuItem value="tecnospeed">TecnoSpeed</MenuItem>
      </TextField>

      <TextField
        label="Credencial (API key do agregador)"
        type="password"
        value={credentials}
        onChange={(event) => setCredentials(event.target.value)}
        disabled={!canManage}
        helperText={
          config
            ? 'Já existe credencial cifrada salva — preencher substitui (e gera token de webhook novo).'
            : 'Cifrada em repouso (aes-256-gcm); nunca reexibida.'
        }
      />

      <TextField
        label="Convênio (opcional)"
        value={agreementCode}
        onChange={(event) => setAgreementCode(event.target.value)}
        disabled={!canManage}
        inputProps={{ maxLength: 60 }}
      />

      <TextField
        select
        label="Conta de liquidação (onde a baixa do webhook entra)"
        value={settlementAccountId}
        onChange={(event) => setSettlementAccountId(event.target.value)}
        disabled={!canManage}
      >
        {accounts
          .filter((account) => account.active)
          .map((account) => (
            <MenuItem key={account.id} value={account.id}>
              {account.name} ({account.typeLabel})
            </MenuItem>
          ))}
      </TextField>

      {canManage ? (
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={() => void save()} disabled={saving}>
            Salvar configuração
          </Button>
          <Button variant="outlined" onClick={() => void test()} disabled={testing || !config}>
            Testar conexão
          </Button>
        </Stack>
      ) : null}

      {testResult ? (
        <Alert severity={testResult.ok ? 'success' : 'warning'} role="status">
          {testResult.message}
        </Alert>
      ) : null}

      {webhookPath ? (
        <Alert severity="warning" role="alert">
          <strong>URL do webhook (mostrada UMA vez — copie agora):</strong>
          <Typography component="div" variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
            {typeof window !== 'undefined' ? window.location.origin : ''}
            {webhookPath}
          </Typography>
          Cadastre-a no painel do agregador. Perdeu? Salve a configuração de novo (gera token novo).
        </Alert>
      ) : null}
    </Stack>
  );
}

// ── Cobranças ────────────────────────────────────────────────────────────────────────────────────

function ChargesTab() {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const canManage = can('cob.manage');

  const [charges, setCharges] = useState<Charge[]>([]);
  const [openTitles, setOpenTitles] = useState<FinancialTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [titleId, setTitleId] = useState('');
  const [kind, setKind] = useState<'boleto' | 'pix'>('boleto');
  const [emitting, setEmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chargeRows, titles] = await Promise.all([
        billingService.listCharges(),
        financeService.listTitles('receivable', {}),
      ]);
      setCharges(chargeRows);
      setOpenTitles(
        titles.filter((title) => title.status === 'open' || title.status === 'partial'),
      );
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar as cobranças.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const titleLabel = useMemo(
    () =>
      new Map(
        openTitles.map((title) => [
          title.id,
          `${title.description} — ${formatMoney(title.openAmount)}`,
        ]),
      ),
    [openTitles],
  );

  async function emit() {
    if (!titleId) {
      enqueueSnackbar('Escolha o título.', { variant: 'warning' });
      return;
    }
    setEmitting(true);
    try {
      await billingService.emitCharge(titleId, kind);
      enqueueSnackbar('Cobrança emitida.', { variant: 'success' });
      setTitleId('');
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setEmitting(false);
    }
  }

  return (
    <Stack spacing={2}>
      {canManage ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            label="Título a receber (em aberto)"
            value={titleId}
            onChange={(event) => setTitleId(event.target.value)}
            size="small"
            sx={{ minWidth: 340 }}
          >
            {openTitles.map((title) => (
              <MenuItem key={title.id} value={title.id}>
                {titleLabel.get(title.id)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Instrumento"
            value={kind}
            onChange={(event) => setKind(event.target.value as 'boleto' | 'pix')}
            size="small"
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="boleto">Boleto</MenuItem>
            <MenuItem value="pix">Pix</MenuItem>
          </TextField>
          <Button variant="contained" onClick={() => void emit()} disabled={emitting}>
            Emitir
          </Button>
        </Stack>
      ) : null}

      {loading || error || charges.length === 0 ? (
        <DataState
          loading={loading}
          error={error}
          empty={charges.length === 0}
          emptyMessage="Nenhuma cobrança emitida."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Cobranças emitidas">
            <TableHead>
              <TableRow>
                <TableCell>Título</TableCell>
                <TableCell>Instrumento</TableCell>
                <TableCell>Linha digitável / QR</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell>Pago em</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {charges.map((charge) => (
                <TableRow key={charge.id} hover>
                  <TableCell>{charge.titleId.slice(0, 8)}</TableCell>
                  <TableCell>{charge.kind === 'pix' ? 'Pix' : 'Boleto'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', maxWidth: 320, overflow: 'hidden' }}>
                    {charge.digitableLine ?? charge.pixQrCode ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={
                        charge.status === 'paid'
                          ? 'Paga'
                          : charge.status === 'registered'
                            ? 'Registrada'
                            : charge.status === 'cancelled'
                              ? 'Cancelada'
                              : 'Erro'
                      }
                      color={
                        charge.status === 'paid'
                          ? 'success'
                          : charge.status === 'registered'
                            ? 'info'
                            : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {charge.paidAt ? new Date(charge.paidAt).toLocaleString('pt-BR') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}

// ── Régua ────────────────────────────────────────────────────────────────────────────────────────

interface StepRow {
  offsetDays: string;
  channel: string;
  template: string;
  mode: string;
}

function DunningTab() {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const canManage = can('cob.manage');

  const [rule, setRule] = useState<DunningRule | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [maxRebillings, setMaxRebillings] = useState('3');
  const [proposals, setProposals] = useState<DunningEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const [currentRule, proposed] = await Promise.all([
      billingService.getDunningRule().catch(() => null),
      billingService.listDunningEvents('proposed').catch(() => [] as DunningEvent[]),
    ]);
    setRule(currentRule);
    setProposals(proposed);
    if (currentRule) {
      setMaxRebillings(String(currentRule.maxRebillings));
      setSteps(
        currentRule.steps.map((step) => ({
          offsetDays: String(step.offsetDays),
          channel: step.channel,
          template: step.template,
          mode: step.mode,
        })),
      );
    } else {
      setSteps([
        {
          offsetDays: '-3',
          channel: 'whatsapp',
          template:
            'Olá [NOME]! Sua parcela de [VALOR] vence em [VENCIMENTO]. Qualquer dúvida, estamos à disposição.',
          mode: 'propose',
        },
      ]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const parsed = steps
      .filter((step) => step.offsetDays !== '' && step.template.trim().length >= 5)
      .map((step) => ({
        offsetDays: Number(step.offsetDays),
        channel: step.channel,
        template: step.template.trim(),
        mode: step.mode,
      }));
    if (parsed.length === 0) {
      enqueueSnackbar('Monte ao menos uma etapa completa.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      setRule(
        await billingService.saveDunningRule({
          steps: parsed,
          maxRebillings: Number(maxRebillings) || 3,
        }),
      );
      enqueueSnackbar('Régua salva.', { variant: 'success' });
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function run() {
    setRunning(true);
    try {
      const result = await billingService.runDunning();
      enqueueSnackbar(
        `Régua executada: ${result.proposed} proposta(s), ${result.sent} enviada(s)` +
          (result.writtenOffPending.length > 0
            ? `, ${result.writtenOffPending.length} título(s) marcados como perdida`
            : '') +
          '.',
        { variant: 'success' },
      );
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setRunning(false);
    }
  }

  async function approve(event: DunningEvent) {
    try {
      await billingService.approveDunningEvent(event.id);
      enqueueSnackbar('Mensagem aprovada e enviada.', { variant: 'success' });
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    }
  }

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Etapas da régua
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Offset negativo = dias ANTES do vencimento; 0 = no vencimento; positivo = dias após. A
          etapa de MAIOR offset positivo é a recobrança: repete a cada offset até 1+N passagens sem
          pagamento — aí o título vira &quot;perdida&quot; e sai da régua. Modo padrão PROPÕE (você
          aprova cada envio); automático é opt-in POR ETAPA e fica registrado.
        </Typography>
        <Stack spacing={2}>
          {steps.map((step, index) => (
            <Stack key={index} direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField
                label="Offset (dias)"
                type="number"
                value={step.offsetDays}
                onChange={(event) =>
                  setSteps((current) =>
                    current.map((s, i) =>
                      i === index ? { ...s, offsetDays: event.target.value } : s,
                    ),
                  )
                }
                size="small"
                sx={{ width: 120 }}
                disabled={!canManage}
              />
              <TextField
                select
                label="Canal"
                value={step.channel}
                onChange={(event) =>
                  setSteps((current) =>
                    current.map((s, i) =>
                      i === index ? { ...s, channel: event.target.value } : s,
                    ),
                  )
                }
                size="small"
                sx={{ width: 140 }}
                disabled={!canManage}
              >
                <MenuItem value="whatsapp">WhatsApp</MenuItem>
                <MenuItem value="email">E-mail</MenuItem>
              </TextField>
              <TextField
                select
                label="Modo"
                value={step.mode}
                onChange={(event) =>
                  setSteps((current) =>
                    current.map((s, i) => (i === index ? { ...s, mode: event.target.value } : s)),
                  )
                }
                size="small"
                sx={{ width: 170 }}
                disabled={!canManage}
              >
                <MenuItem value="propose">Propor (aprovo cada)</MenuItem>
                <MenuItem value="auto">Automático (opt-in)</MenuItem>
              </TextField>
              <TextField
                label="Template ([NOME] [VALOR] [VENCIMENTO])"
                value={step.template}
                onChange={(event) =>
                  setSteps((current) =>
                    current.map((s, i) =>
                      i === index ? { ...s, template: event.target.value } : s,
                    ),
                  )
                }
                size="small"
                fullWidth
                disabled={!canManage}
              />
              {canManage ? (
                <Button
                  size="small"
                  onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
                  disabled={steps.length === 1}
                >
                  <DeleteIcon fontSize="small" />
                </Button>
              ) : null}
            </Stack>
          ))}
          {canManage ? (
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                startIcon={<AddIcon />}
                onClick={() =>
                  setSteps((current) => [
                    ...current,
                    { offsetDays: '5', channel: 'whatsapp', template: '', mode: 'propose' },
                  ])
                }
              >
                Adicionar etapa
              </Button>
              <TextField
                label="Recobranças até perdida (N)"
                type="number"
                value={maxRebillings}
                onChange={(event) => setMaxRebillings(event.target.value)}
                size="small"
                inputProps={{ min: 0, max: 12 }}
                sx={{ width: 210 }}
              />
              <Button variant="contained" onClick={() => void save()} disabled={saving}>
                Salvar régua
              </Button>
              <Button variant="outlined" onClick={() => void run()} disabled={running || !rule}>
                Rodar régua agora
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Propostas aguardando aprovação ({proposals.length})
        </Typography>
        {proposals.length === 0 ? (
          <Typography color="text.secondary">
            Nenhuma proposta — rode a régua para gerar as mensagens devidas.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {proposals.map((event) => (
              <Paper key={event.id} variant="outlined" sx={{ p: 2 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ sm: 'center' }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {event.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'} · etapa{' '}
                      {event.offsetDays >= 0 ? `+${event.offsetDays}` : event.offsetDays} dias ·
                      título {event.titleId.slice(0, 8)}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {event.renderedMessage}
                    </Typography>
                  </Box>
                  {canManage ? (
                    <Button variant="contained" size="small" onClick={() => void approve(event)}>
                      Aprovar e enviar
                    </Button>
                  ) : null}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}

// ── Inadimplência + carnê + renegociação ─────────────────────────────────────────────────────────

function DelinquencyTab({ contacts }: { contacts: Contact[] }) {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const canManage = can('cob.manage');

  const [contactId, setContactId] = useState('');
  const [titles, setTitles] = useState<FinancialTitle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [installmentCount, setInstallmentCount] = useState('3');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [renegotiating, setRenegotiating] = useState(false);

  const load = useCallback(async () => {
    if (!contactId) {
      setTitles([]);
      return;
    }
    setLoading(true);
    try {
      setTitles(await financeService.listTitles('receivable', { contactId }));
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [contactId, enqueueSnackbar]);

  useEffect(() => {
    void load();
    setSelected(new Set());
  }, [load]);

  const open = titles.filter((title) => title.status === 'open' || title.status === 'partial');
  const overdue = open.filter((title) => new Date(title.dueDate).getTime() < Date.now());
  const selectedTotal = open
    .filter((title) => selected.has(title.id))
    .reduce((sum, title) => sum + title.openAmount, 0);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function renegotiate() {
    const count = Math.max(1, Math.min(60, Number(installmentCount) || 1));
    if (selected.size === 0 || !firstDueDate) {
      enqueueSnackbar('Selecione os títulos e o primeiro vencimento.', { variant: 'warning' });
      return;
    }
    setRenegotiating(true);
    try {
      const amount = Math.round((selectedTotal / count) * 100) / 100;
      const first = new Date(`${firstDueDate}T00:00:00`);
      const installments = Array.from({ length: count }, (_, index) => {
        const due = new Date(
          Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + index, first.getUTCDate()),
        );
        // Última parcela absorve o resíduo do arredondamento — o total fecha no centavo.
        const isLast = index === count - 1;
        return {
          amount: isLast ? Math.round((selectedTotal - amount * (count - 1)) * 100) / 100 : amount,
          dueDate: due.toISOString(),
        };
      });
      await billingService.renegotiate({ titleIds: [...selected], installments });
      enqueueSnackbar('Renegociação registrada — títulos novos criados.', { variant: 'success' });
      setSelected(new Set());
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setRenegotiating(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          select
          label="Cliente"
          value={contactId}
          onChange={(event) => setContactId(event.target.value)}
          size="small"
          sx={{ minWidth: 280 }}
        >
          {contacts.map((contact) => (
            <MenuItem key={contact.id} value={contact.id}>
              {contact.displayName}
            </MenuItem>
          ))}
        </TextField>
        {contactId && open.length > 0 ? (
          <Button variant="outlined" onClick={() => window.print()}>
            Imprimir carnê
          </Button>
        ) : null}
      </Stack>

      {overdue.length > 0 ? (
        <Alert severity="warning" role="alert">
          {overdue.length} título(s) vencidos —{' '}
          {formatMoney(overdue.reduce((sum, title) => sum + title.openAmount, 0))} em atraso.
        </Alert>
      ) : null}

      {loading ? (
        <DataState loading error={null} empty={false} emptyMessage="" />
      ) : contactId && titles.length === 0 ? (
        <Typography color="text.secondary">Nenhum título deste cliente.</Typography>
      ) : titles.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          {/* O carnê imprimível é ESTA tabela (window.print) — parcela, vencimento, valor. */}
          <Table size="small" aria-label="Carnê do cliente">
            <TableHead>
              <TableRow>
                {canManage ? <TableCell /> : null}
                <TableCell>Parcela</TableCell>
                <TableCell>Vencimento</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell align="right">Em aberto</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {titles.map((title) => (
                <TableRow key={title.id} hover>
                  {canManage ? (
                    <TableCell padding="checkbox">
                      {title.status === 'open' || title.status === 'partial' ? (
                        <input
                          type="checkbox"
                          checked={selected.has(title.id)}
                          onChange={() => toggle(title.id)}
                          aria-label={`Selecionar ${title.description}`}
                        />
                      ) : null}
                    </TableCell>
                  ) : null}
                  <TableCell>{title.description}</TableCell>
                  <TableCell>{new Date(title.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell align="right">{formatMoney(title.amount)}</TableCell>
                  <TableCell align="right">{formatMoney(title.openAmount)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={TITLE_STATUS_LABEL[title.status] ?? title.status}
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      {canManage && selected.size > 0 ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Renegociar {selected.size} título(s) — {formatMoney(selectedTotal)}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Novas parcelas"
              type="number"
              value={installmentCount}
              onChange={(event) => setInstallmentCount(event.target.value)}
              size="small"
              inputProps={{ min: 1, max: 60 }}
              sx={{ width: 140 }}
            />
            <TextField
              type="date"
              label="Primeiro vencimento"
              value={firstDueDate}
              onChange={(event) => setFirstDueDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <Button variant="contained" onClick={() => void renegotiate()} disabled={renegotiating}>
              Renegociar
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Os títulos antigos são sinalizados como renegociados (histórico preservado); os novos
            nascem com origem &quot;renegociação&quot;, divididos igualmente com resíduo na última.
          </Typography>
        </Paper>
      ) : null}
    </Stack>
  );
}
