'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
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
import {
  ConfirmDialog,
  ErrorState,
  Loading,
  PageHeader,
  StatusChip,
  formatDateTime,
  formatRate,
} from 'src/components/common/common';
import { ACCESS_TOKEN_KEY, apiErrorMessage, getStoredToken, storeSession } from 'src/services/api';
import { platformService } from 'src/services/services';
import type { AbuseSignals, PlatformAccount } from 'src/types/api';

/**
 * The platform area (FASE 10, screen 12): accounts, ceilings, abuse signals, suspension.
 *
 * Deliberately OUTSIDE the `(app)` group and with its own login. A platform admin is not a user of any
 * account — `platform_admins` is a separate table with no `account_id`, and §4 says that separation exists
 * precisely to eliminate the class of bug where a null account leaks data between tenants. Sharing the
 * tenant shell here would reintroduce the confusion the data model went out of its way to prevent.
 *
 * Suspension is the sharpest tool on this screen. §15 risco 7: self-service means a tenant can use the
 * platform as a spam gateway, and the answer is a ceiling, signals, and the ability to stop an account.
 */
export default function PlatformPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suspending, setSuspending] = useState<PlatformAccount | null>(null);
  const [signalsFor, setSignalsFor] = useState<PlatformAccount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await platformService.accounts());
      setAuthenticated(true);
    } catch (caught) {
      // A 401 here means the stored token is a TENANT token, not a platform one. Not an error to shout
      // about: it just means this browser needs the platform login.
      setAuthenticated(false);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getStoredToken(ACCESS_TOKEN_KEY)) {
      load();
    }
  }, [load]);

  async function signIn() {
    setLoading(true);
    try {
      const session = await platformService.login(email, password);
      // `admin`, not `user`: a platform admin belongs to no account. Storing `session.user` wrote the
      // literal string "undefined" into localStorage, which then failed to parse on every page load.
      storeSession(session.accessToken, session.refreshToken, session.admin);
      await load();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Credenciais inválidas.'));
    } finally {
      setLoading(false);
    }
  }

  async function setCeiling(account: PlatformAccount, value: number) {
    try {
      await platformService.setCeiling(account.id, value);
      enqueueSnackbar('Teto diário atualizado.', { variant: 'success' });
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  async function suspend(reason: string) {
    if (!suspending) {
      return;
    }
    try {
      await platformService.suspend(suspending.id, reason || 'Suspensa pela plataforma');
      enqueueSnackbar('Conta suspensa. Nenhum envio sai enquanto ela estiver suspensa.', {
        variant: 'success',
      });
      setSuspending(null);
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
      setSuspending(null);
    }
  }

  async function reactivate(account: PlatformAccount) {
    try {
      await platformService.reactivate(account.id);
      enqueueSnackbar('Conta reativada.', { variant: 'success' });
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  if (!authenticated) {
    return (
      <Container
        component="main"
        maxWidth="xs"
        sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}
      >
        <Paper variant="outlined" sx={{ p: 4, width: '100%' }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Área da plataforma
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Acesso de administrador da plataforma. É um login separado do login das contas.
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="Senha"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              fullWidth
            />
            {error ? (
              <Alert severity="error" role="alert">
                {error}
              </Alert>
            ) : null}
            <Button variant="contained" onClick={signIn} disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  if (loading && accounts.length === 0) {
    return <Loading label="Carregando contas" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <Container component="main" maxWidth="lg" sx={{ py: 4 }}>
      <PageHeader
        title="Plataforma"
        description="Contas, tetos de envio, sinais de abuso e suspensão. Uma conta suspensa não envia nada — o worker recusa antes de tocar no WhatsApp."
        actions={<Button onClick={load}>Atualizar</Button>}
      />

      <CreateAccountCard onCreated={load} />

      <Card variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Conta</TableCell>
              <TableCell>Documento</TableCell>
              <TableCell>Plano</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell align="right">Teto diário</TableCell>
              <TableCell>Criada</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id} hover>
                <TableCell>{account.name}</TableCell>
                <TableCell>
                  <Typography variant="caption">{account.documentMasked}</Typography>
                </TableCell>
                <TableCell>{account.plan}</TableCell>
                <TableCell>
                  <StatusChip status={account.status} />
                  {account.suspensionReason ? (
                    <Typography variant="caption" component="p" color="text.secondary">
                      {account.suspensionReason}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    defaultValue={account.dailySendCeiling}
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      if (value && value !== account.dailySendCeiling) {
                        setCeiling(account, value);
                      }
                    }}
                    sx={{ width: 110 }}
                    inputProps={{ 'aria-label': `Teto diário de ${account.name}` }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{formatDateTime(account.createdAt)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setSignalsFor(account)}>
                    Sinais
                  </Button>
                  {account.status === 'SUSPENDED' ? (
                    <Button size="small" color="success" onClick={() => reactivate(account)}>
                      Reativar
                    </Button>
                  ) : (
                    <Button size="small" color="error" onClick={() => setSuspending(account)}>
                      Suspender
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ConfirmDialog
        open={Boolean(suspending)}
        title={`Suspender ${suspending?.name ?? ''}`}
        description="A conta para de enviar imediatamente: distribuições em andamento são recusadas envio por envio, e respostas da caixa de entrada também param. Os dados continuam intactos e a suspensão é reversível."
        confirmationWord="SUSPENDER"
        confirmLabel="Suspender conta"
        destructive
        onCancel={() => setSuspending(null)}
        onConfirm={suspend}
      />

      <AbuseSignalsDialog account={signalsFor} onClose={() => setSignalsFor(null)} />
    </Container>
  );
}

/**
 * Abuse signals for ONE account, last 30 days (§15 risco 7).
 *
 * Loaded on demand, not with the accounts list: the endpoint is per account and requires a window, so
 * populating a global card would mean one request per row on every page load. The numbers come with no
 * verdict attached — what counts as abuse is DECISÃO PENDENTE (§14 item 10), and this screen exists so
 * a person can look at the rates and decide.
 */
function AbuseSignalsDialog({
  account,
  onClose,
}: {
  account: PlatformAccount | null;
  onClose: () => void;
}) {
  const [signals, setSignals] = useState<AbuseSignals | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      setSignals(null);
      setFailure(null);
      return;
    }
    setLoading(true);
    setFailure(null);
    platformService
      .abuseSignals(account.id)
      .then(setSignals)
      .catch((caught) =>
        setFailure(apiErrorMessage(caught, 'Não foi possível carregar os sinais.')),
      )
      .finally(() => setLoading(false));
  }, [account]);

  return (
    <Dialog open={Boolean(account)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Sinais de {account?.name ?? ''}</DialogTitle>
      <DialogContent>
        {loading ? <Loading label="Carregando sinais" /> : null}
        {failure ? (
          <Alert severity="error" role="alert">
            {failure}
          </Alert>
        ) : null}
        {signals ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              De {signals.from} a {signals.to}. Enviadas {signals.totals.sent}, entregues{' '}
              {signals.totals.delivered}, falhas {signals.totals.failed}, opt-outs{' '}
              {signals.totals.optOut}, respostas {signals.totals.inbound}. Sem veredito: os números
              estão aqui para alguém ler.
            </Typography>
            {signals.days.length === 0 ? (
              <Alert severity="info" role="status">
                Nenhum envio no período. Sem amostra não há taxa — o que é diferente de taxa zero.
              </Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Dia</TableCell>
                    <TableCell align="right">Enviadas</TableCell>
                    <TableCell align="right">Entrega</TableCell>
                    <TableCell align="right">Falha</TableCell>
                    <TableCell align="right">Opt-out</TableCell>
                    <TableCell align="right">Resposta</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {signals.days.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell>{day.date}</TableCell>
                      <TableCell align="right">{day.sentCount}</TableCell>
                      <TableCell align="right">{formatRate(day.deliveryRate)}</TableCell>
                      <TableCell align="right">{formatRate(day.failureRate)}</TableCell>
                      <TableCell align="right">{formatRate(day.optOutRate)}</TableCell>
                      <TableCell align="right">{formatRate(day.inboundRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

const createSchema = yup.object({
  name: yup.string().min(2, 'Mínimo 2 caracteres').required('Nome obrigatório'),
  document: yup
    .string()
    .matches(/^[\d.\-/\s]{11,20}$/, 'CPF ou CNPJ (pontuação opcional)')
    .required('Documento obrigatório'),
  plan: yup.string().required(),
  dailySendCeiling: yup
    .number()
    .typeError('Informe um número')
    .integer('Sem casas decimais')
    .min(1, 'Mínimo 1')
    .max(100000, 'Máximo 100000')
    .required('Teto obrigatório'),
  timezone: yup
    .string()
    .matches(/^[A-Za-z]+\/[A-Za-z_+\-0-9]+$/, 'Ex.: America/Sao_Paulo')
    .required('Timezone obrigatório'),
  adminName: yup.string().min(2, 'Mínimo 2 caracteres').required('Nome obrigatório'),
  adminEmail: yup.string().email('E-mail inválido').required('E-mail obrigatório'),
  adminPhone: yup
    .string()
    .matches(/^\+?[\d\s().-]{10,20}$/, 'DDD + número, ex.: (11) 99999-9999')
    .required('WhatsApp obrigatório'),
  adminPassword: yup
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .matches(/[A-Za-z]/, 'Inclua ao menos uma letra')
    .matches(/\d/, 'Inclua ao menos um número')
    .required('Senha obrigatória'),
});

type CreateAccountForm = yup.InferType<typeof createSchema>;

/**
 * Creating a tenant and its first admin (§1.7).
 *
 * This form is the reason the platform area exists: without it a new account can only be born through
 * a curl, which means the product cannot be operated by whoever is not holding a terminal.
 *
 * The daily ceiling is asked, not derived from the plan, because the plan → ceiling table is DECISÃO
 * PENDENTE (§14 item 8) — inheriting a guess would bake it into every account created from here on.
 *
 * The admin's WhatsApp is required (CLAUDE.md regra 9): this is the one user in the new tenant with
 * nobody above them, so without a number a forgotten password costs them the account.
 */
function CreateAccountCard({ onCreated }: { onCreated: () => Promise<void> }) {
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<CreateAccountForm>({
    resolver: yupResolver(createSchema),
    defaultValues: {
      plan: 'STANDARD',
      timezone: 'America/Sao_Paulo',
      dailySendCeiling: 300,
    },
  });

  async function onSubmit(values: CreateAccountForm) {
    setSubmitting(true);
    try {
      await platformService.createAccount({
        ...values,
        dailySendCeiling: Number(values.dailySendCeiling),
      });
      enqueueSnackbar(`Conta criada. ${values.adminEmail} já pode entrar pelo login das contas.`, {
        variant: 'success',
      });
      form.reset();
      setOpen(false);
      await onCreated();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught, 'Não foi possível criar a conta.'), {
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Nova conta
        </Button>
      </Stack>
    );
  }

  return (
    <Card variant="outlined" component="section" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" component="h3" gutterBottom>
          Nova conta
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Cria o gabinete e o primeiro administrador dele, numa transação. Uma conta em que ninguém
          consegue entrar não é uma conta.
        </Typography>
        <Box component="form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nome do gabinete"
                fullWidth
                {...form.register('name')}
                error={Boolean(form.formState.errors.name)}
                helperText={form.formState.errors.name?.message}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="CPF ou CNPJ"
                fullWidth
                {...form.register('document')}
                error={Boolean(form.formState.errors.document)}
                helperText={form.formState.errors.document?.message}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Plano"
                defaultValue="STANDARD"
                fullWidth
                {...form.register('plan')}
              >
                <MenuItem value="TRIAL">TRIAL</MenuItem>
                <MenuItem value="STANDARD">STANDARD</MenuItem>
                <MenuItem value="PRO">PRO</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Teto diário de envios"
                type="number"
                fullWidth
                {...form.register('dailySendCeiling')}
                error={Boolean(form.formState.errors.dailySendCeiling)}
                helperText={
                  form.formState.errors.dailySendCeiling?.message ?? 'Somando todos os chips'
                }
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Timezone"
                fullWidth
                {...form.register('timezone')}
                error={Boolean(form.formState.errors.timezone)}
                helperText={form.formState.errors.timezone?.message ?? 'Define o dia e o silêncio'}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Primeiro administrador da conta
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nome"
                fullWidth
                {...form.register('adminName')}
                error={Boolean(form.formState.errors.adminName)}
                helperText={form.formState.errors.adminName?.message}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                {...form.register('adminEmail')}
                error={Boolean(form.formState.errors.adminEmail)}
                helperText={form.formState.errors.adminEmail?.message}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="WhatsApp"
                fullWidth
                {...form.register('adminPhone')}
                error={Boolean(form.formState.errors.adminPhone)}
                helperText={
                  form.formState.errors.adminPhone?.message ??
                  'É por aqui que chega o código de recuperação de senha'
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Senha inicial"
                type="password"
                fullWidth
                {...form.register('adminPassword')}
                error={Boolean(form.formState.errors.adminPassword)}
                helperText={
                  form.formState.errors.adminPassword?.message ??
                  'Mínimo 10 caracteres, com letra e número'
                }
              />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button onClick={() => setOpen(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" variant="contained" disabled={submitting}>
                  {submitting ? 'Criando…' : 'Criar conta'}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
}
