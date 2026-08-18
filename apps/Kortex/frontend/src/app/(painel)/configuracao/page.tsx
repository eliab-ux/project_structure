'use client';

import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
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
import { RequireAuth } from 'src/components/RequireAuth';
import accountService from 'src/services/accountService';
import machineService from 'src/services/machineService';
import { apiErrorMessage } from 'src/services/api';
import {
  AccountSettings,
  BusinessHour,
  Machine,
  WEEKDAY_LABELS,
  formatCents,
  formatMinutes,
} from 'src/types/account';
import { numericSx } from 'src/theme/theme';

/** 'R$ 85,00' digitado como '85,00' → 8500. Centavos inteiros, sem float no caminho. */
function toCents(input: string): number {
  const digits = input.replace(/\D/g, '');
  return digits ? Number.parseInt(digits, 10) : 0;
}

/**
 * Fusos do Brasil.
 *
 * Lista curta e explícita em vez de `Intl.supportedValuesOf('timeZone')`: são ~400 nomes, e num
 * combo desse tamanho o operador escolhe `America/Argentina/Cordoba` por engano. A conta aceita
 * qualquer fuso IANA pela API — a lista limita a TELA, não o domínio.
 */
const TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/Sao_Paulo', label: 'Brasília (America/Sao_Paulo)' },
  { value: 'America/Bahia', label: 'Bahia (America/Bahia)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (America/Fortaleza)' },
  { value: 'America/Recife', label: 'Recife (America/Recife)' },
  { value: 'America/Belem', label: 'Belém (America/Belem)' },
  { value: 'America/Manaus', label: 'Manaus (America/Manaus)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (America/Cuiaba)' },
  { value: 'America/Campo_Grande', label: 'Campo Grande (America/Campo_Grande)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (America/Porto_Velho)' },
  { value: 'America/Boa_Vista', label: 'Boa Vista (America/Boa_Vista)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (America/Rio_Branco)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (America/Noronha)' },
];

function ConfigurationPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);

  const [newHour, setNewHour] = useState({ weekday: 1, startsAt: '07:00', endsAt: '11:30' });
  const [newMachine, setNewMachine] = useState({ name: '', model: '', price: '0,00' });
  const [account, setAccount] = useState({ name: '', city: '', timezone: 'America/Sao_Paulo' });
  const [reportOwner, setReportOwner] = useState({ name: '', role: '', phone: '', email: '' });

  const load = useCallback(async () => {
    try {
      const [loadedSettings, loadedHours, loadedMachines] = await Promise.all([
        accountService.getSettings(),
        accountService.listBusinessHours(),
        machineService.list(),
      ]);
      setSettings(loadedSettings);
      setHours(loadedHours);
      setMachines(loadedMachines);
      setAccount({
        name: loadedSettings.name,
        city: loadedSettings.city,
        timezone: loadedSettings.timezone,
      });
      setReportOwner({
        name: loadedSettings.reportOwner?.name ?? '',
        role: loadedSettings.reportOwner?.role ?? '',
        phone: loadedSettings.reportOwner?.phone ?? '',
        email: loadedSettings.reportOwner?.email ?? '',
      });
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar a configuração.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAccount() {
    try {
      const saved = await accountService.updateSettings({
        name: account.name,
        city: account.city,
        timezone: account.timezone,
        // Sem nome não há responsável: as outras três colunas sozinhas não formam ninguém.
        reportOwner: reportOwner.name.trim()
          ? {
              name: reportOwner.name,
              role: reportOwner.role || null,
              phone: reportOwner.phone || null,
              email: reportOwner.email || null,
            }
          : null,
      });
      setSettings(saved);
      enqueueSnackbar('Configuração salva.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível salvar.'), { variant: 'error' });
    }
  }

  async function addHour() {
    try {
      await accountService.addBusinessHour(newHour);
      setHours(await accountService.listBusinessHours());
      enqueueSnackbar('Janela adicionada.', { variant: 'success' });
    } catch (error) {
      // A mensagem do backend nomeia a janela conflitante — vale mostrar literal.
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível adicionar a janela.'), {
        variant: 'error',
      });
    }
  }

  async function removeHour(id: string) {
    try {
      await accountService.removeBusinessHour(id);
      setHours((current) => current.filter((hour) => hour.id !== id));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível remover a janela.'), {
        variant: 'error',
      });
    }
  }

  async function addMachine() {
    try {
      const created = await machineService.create({
        name: newMachine.name,
        model: newMachine.model || null,
        hourPriceCents: toCents(newMachine.price),
      });
      setMachines((current) => [...current, created]);
      setNewMachine({ name: '', model: '', price: '0,00' });
      enqueueSnackbar('Máquina cadastrada.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível cadastrar a máquina.'), {
        variant: 'error',
      });
    }
  }

  async function toggleMachine(machine: Machine) {
    try {
      const saved = await machineService.update(machine.id, {
        name: machine.name,
        model: machine.model,
        hourPriceCents: machine.hourPriceCents,
        isActive: !machine.isActive,
      });
      setMachines((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível alterar a máquina.'), {
        variant: 'error',
      });
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

  const hoursByWeekday = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    windows: hours.filter((hour) => hour.weekday === weekday),
  }));

  return (
    <>
      <PageHeader
        title="Configuração da conta"
        description={settings ? `${settings.name} · ${settings.city}` : undefined}
      />

      <Paper
        variant="outlined"
        component="section"
        aria-label="Horário de funcionamento"
        sx={{ p: 2.5, mb: 2.5 }}
      >
        <Typography variant="h3" component="h2">
          Horário de funcionamento
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 2, maxWidth: '80ch' }}
        >
          Cadastre as <strong>janelas</strong> em que a máquina pode ser reservada. O intervalo é o
          espaço entre uma janela e a seguinte — pode ter quantos precisar. Uma reserva não
          atravessa intervalo.
        </Typography>

        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Dia</TableCell>
              <TableCell>Janelas</TableCell>
              <TableCell align="right">Horas úteis</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {hoursByWeekday.map((day) => (
              <TableRow key={day.weekday}>
                <TableCell sx={{ fontWeight: 600 }}>{day.label}</TableCell>
                <TableCell>
                  {day.windows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      fechado
                    </Typography>
                  ) : (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {day.windows.map((window) => (
                        <Chip
                          key={window.id}
                          label={`${window.startsAt}–${window.endsAt}`}
                          onDelete={() => removeHour(window.id)}
                          size="small"
                          sx={{ ...numericSx }}
                        />
                      ))}
                    </Stack>
                  )}
                </TableCell>
                <TableCell align="right" sx={numericSx}>
                  {day.windows.length === 0
                    ? '—'
                    : formatMinutes(
                        day.windows.reduce((total, window) => total + window.durationMinutes, 0),
                      )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Divider sx={{ mb: 2 }} />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
          <TextField
            select
            label="Dia"
            size="small"
            value={newHour.weekday}
            onChange={(event) => setNewHour({ ...newHour, weekday: Number(event.target.value) })}
            sx={{ minWidth: 160 }}
          >
            {WEEKDAY_LABELS.map((label, weekday) => (
              <MenuItem key={weekday} value={weekday}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Começa"
            type="time"
            size="small"
            value={newHour.startsAt}
            onChange={(event) => setNewHour({ ...newHour, startsAt: event.target.value })}
          />
          <TextField
            label="Termina"
            type="time"
            size="small"
            value={newHour.endsAt}
            onChange={(event) => setNewHour({ ...newHour, endsAt: event.target.value })}
          />
          <Button onClick={addHour}>Adicionar janela</Button>
        </Stack>
      </Paper>

      <Paper
        variant="outlined"
        component="section"
        aria-label="Máquinas e preço da hora"
        sx={{ p: 2.5, mb: 2.5 }}
      >
        <Typography variant="h3" component="h2">
          Máquinas e preço da hora
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 2, maxWidth: '80ch' }}
        >
          O preço é <strong>de cada máquina</strong>, não do sistema. Mudar o preço não altera
          reserva já criada — cada reserva grava o valor da máquina no dia.
        </Typography>

        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Máquina</TableCell>
              <TableCell>Modelo</TableCell>
              <TableCell align="right">Preço/hora</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {machines.map((machine) => (
              <TableRow key={machine.id}>
                <TableCell sx={{ fontWeight: 600 }}>{machine.name}</TableCell>
                <TableCell>{machine.model ?? '—'}</TableCell>
                <TableCell align="right" sx={numericSx}>
                  {formatCents(machine.hourPriceCents)}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={machine.isActive ? 'Ativa' : 'Inativa'}
                    color={machine.isActive ? 'success' : 'default'}
                    variant={machine.isActive ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined" onClick={() => toggleMachine(machine)}>
                    {machine.isActive ? 'Inativar' : 'Reativar'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Divider sx={{ mb: 2 }} />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
          <TextField
            label="Nome"
            size="small"
            value={newMachine.name}
            onChange={(event) => setNewMachine({ ...newMachine, name: event.target.value })}
          />
          <TextField
            label="Modelo (opcional)"
            size="small"
            value={newMachine.model}
            onChange={(event) => setNewMachine({ ...newMachine, model: event.target.value })}
          />
          <TextField
            label="Preço/hora"
            size="small"
            value={newMachine.price}
            onChange={(event) => setNewMachine({ ...newMachine, price: event.target.value })}
            InputProps={{ startAdornment: <Box sx={{ mr: 0.5 }}>R$</Box> }}
            inputProps={{ inputMode: 'decimal', style: { fontFamily: 'inherit' } }}
          />
          <Button onClick={addMachine}>Adicionar máquina</Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" component="section" aria-label="Dados da conta" sx={{ p: 2.5 }}>
        <Typography variant="h3" component="h2">
          Conta e responsável pelo relatório
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 2, maxWidth: '80ch' }}
        >
          A cidade aparece no relatório mensal. O responsável é quem a associação procura quando o
          relatório tem pergunta.
        </Typography>

        <Stack spacing={2} sx={{ maxWidth: 640 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Nome da operação"
              size="small"
              fullWidth
              value={account.name}
              onChange={(event) => setAccount({ ...account, name: event.target.value })}
            />
            <TextField
              label="Cidade"
              size="small"
              fullWidth
              value={account.city}
              onChange={(event) => setAccount({ ...account, city: event.target.value })}
            />
            <TextField
              select
              label="Fuso horário"
              size="small"
              fullWidth
              helperText="A agenda inteira é lida por ele. Trocar reinterpreta horários já marcados."
              value={account.timezone}
              onChange={(event) => setAccount({ ...account, timezone: event.target.value })}
            >
              {TIMEZONES.map((timezone) => (
                <MenuItem key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Responsável"
              size="small"
              fullWidth
              value={reportOwner.name}
              onChange={(event) => setReportOwner({ ...reportOwner, name: event.target.value })}
            />
            <TextField
              label="Cargo"
              size="small"
              fullWidth
              value={reportOwner.role}
              onChange={(event) => setReportOwner({ ...reportOwner, role: event.target.value })}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Telefone"
              size="small"
              fullWidth
              value={reportOwner.phone}
              onChange={(event) => setReportOwner({ ...reportOwner, phone: event.target.value })}
            />
            <TextField
              label="E-mail"
              size="small"
              fullWidth
              value={reportOwner.email}
              onChange={(event) => setReportOwner({ ...reportOwner, email: event.target.value })}
            />
          </Stack>

          <Box>
            <Button onClick={saveAccount}>Salvar</Button>
          </Box>
        </Stack>
      </Paper>
    </>
  );
}

export default function Page() {
  // Exclusivo do dono (§5): configurar janelas e definir preço da hora.
  return (
    <RequireAuth allow={['owner']}>
      <ConfigurationPage />
    </RequireAuth>
  );
}
