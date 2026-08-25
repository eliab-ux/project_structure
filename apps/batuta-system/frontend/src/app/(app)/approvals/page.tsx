'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ErrorState, Loading, PageHeader } from 'src/components/common/common';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import { approvalService } from 'src/services/services';
import type { ApprovalSettings, Approver } from 'src/types/api';

/**
 * Approval configuration and approvers (FASE 10, screen 7).
 *
 * Two rules are visible in the UI rather than hidden in the API:
 *
 *  - **1 or 2, per classification.** There is no free number field, because §8 item 1 sets two as the
 *     ceiling. A select with two options cannot be typed into wrongly.
 *  - **An approver needs no user account.** The form asks for a name and an e-mail or phone, and says so:
 *     the person approving electoral content is often a lawyer who will never log in (§8 item 2).
 */
export default function ApprovalsPage() {
  const { isAdmin } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [settings, setSettings] = useState<ApprovalSettings | null>(null);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsData, approverList] = await Promise.all([
        approvalService.settings(),
        approvalService.approvers(),
      ]);
      setSettings(settingsData);
      setApprovers(approverList);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar a configuração de aprovação.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings(next: ApprovalSettings) {
    try {
      setSettings(await approvalService.updateSettings(next));
      enqueueSnackbar('Configuração salva.', { variant: 'success' });
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
      await load();
    }
  }

  async function addApprover() {
    if (!email && !phone) {
      enqueueSnackbar(
        'Informe e-mail ou telefone: um aprovador que não pode ser avisado trava tudo.',
        {
          variant: 'error',
        },
      );
      return;
    }
    try {
      await approvalService.addApprover({ name, email: email || null, phone: phone || null });
      setName('');
      setEmail('');
      setPhone('');
      enqueueSnackbar('Aprovador cadastrado.', { variant: 'success' });
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  async function toggleApprover(approver: Approver) {
    try {
      await approvalService.updateApprover(approver.id, { active: !approver.active });
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  if (loading) {
    return <Loading label="Carregando aprovação" />;
  }
  if (error || !settings) {
    return <ErrorState message={error ?? 'Configuração indisponível.'} onRetry={load} />;
  }

  const activeCount = approvers.filter((approver) => approver.active).length;

  return (
    <Box>
      <PageHeader
        title="Aprovação"
        description="Quantas aprovações cada tipo de conteúdo precisa, e quem pode aprovar. A aprovação acontece numa página com link mágico — o aprovador não precisa ter conta no sistema."
      />

      {activeCount < settings.requiredForElectoral ? (
        <Alert severity="warning" sx={{ mb: 3 }} role="alert">
          Há {activeCount} aprovador(es) ativo(s), mas conteúdo eleitoral exige{' '}
          {settings.requiredForElectoral}. Uma submissão eleitoral vai ser recusada até haver
          aprovadores suficientes — e o autor nunca conta como aprovador do próprio texto.
        </Alert>
      ) : null}

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Quantas aprovações
              </Typography>
              <Stack spacing={2}>
                <TextField
                  select
                  label="Conteúdo institucional"
                  value={settings.requiredForInstitutional}
                  onChange={(event) =>
                    saveSettings({
                      ...settings,
                      requiredForInstitutional: Number(event.target.value),
                    })
                  }
                  disabled={!isAdmin}
                  fullWidth
                >
                  <MenuItem value={1}>1 aprovação</MenuItem>
                  <MenuItem value={2}>2 aprovações</MenuItem>
                </TextField>
                <TextField
                  select
                  label="Conteúdo eleitoral"
                  value={settings.requiredForElectoral}
                  onChange={(event) =>
                    saveSettings({ ...settings, requiredForElectoral: Number(event.target.value) })
                  }
                  disabled={!isAdmin}
                  fullWidth
                  helperText="Conteúdo eleitoral costuma pedir dois pares de olhos."
                >
                  <MenuItem value={1}>1 aprovação</MenuItem>
                  <MenuItem value={2}>2 aprovações</MenuItem>
                </TextField>
                <TextField
                  select
                  label="Como avisar o aprovador"
                  value={settings.notifyChannel}
                  onChange={(event) =>
                    saveSettings({
                      ...settings,
                      notifyChannel: event.target.value as ApprovalSettings['notifyChannel'],
                    })
                  }
                  disabled={!isAdmin}
                  fullWidth
                  helperText="O aviso sai por canal de sistema, nunca por um chip da campanha."
                >
                  <MenuItem value="EMAIL">E-mail</MenuItem>
                  <MenuItem value="WHATSAPP">WhatsApp</MenuItem>
                  <MenuItem value="BOTH">E-mail e WhatsApp</MenuItem>
                </TextField>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Aprovadores
              </Typography>
              <Table size="small" sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>E-mail</TableCell>
                    <TableCell>WhatsApp</TableCell>
                    <TableCell align="right">Ativo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {approvers.map((approver) => (
                    <TableRow key={approver.id}>
                      <TableCell>{approver.name}</TableCell>
                      <TableCell>{approver.email ?? '—'}</TableCell>
                      <TableCell>{approver.phoneMasked ?? '—'}</TableCell>
                      <TableCell align="right">
                        <Switch
                          checked={approver.active}
                          onChange={() => toggleApprover(approver)}
                          disabled={!isAdmin}
                          inputProps={{ 'aria-label': `Ativar ${approver.name}` }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {isAdmin ? (
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2">Novo aprovador</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      label="Nome"
                      size="small"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="E-mail"
                      size="small"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="WhatsApp (E.164)"
                      size="small"
                      placeholder="+5511999998888"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      fullWidth
                    />
                  </Stack>
                  <Box>
                    <Button variant="contained" onClick={addApprover} disabled={name.length < 2}>
                      Cadastrar
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Um aprovador não precisa de conta no sistema. Ele recebe um link, abre no
                    celular e decide. Aprovadores são desativados, nunca apagados: decisões passadas
                    precisam continuar atribuíveis.
                  </Typography>
                </Stack>
              ) : null}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
