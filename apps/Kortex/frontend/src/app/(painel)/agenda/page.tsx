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
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/PageHeader';
import { AgendaGrid } from './AgendaGrid';
import scheduleService from 'src/services/scheduleService';
import machineService from 'src/services/machineService';
import accountService from 'src/services/accountService';
import preOrderService from 'src/services/preOrderService';
import financeService from 'src/services/financeService';
import { apiErrorMessage } from 'src/services/api';
import { BankAccount } from 'src/types/finance';
import { BusinessHour, Machine, formatCents } from 'src/types/account';
import { PreOrder } from 'src/types/preOrder';
import {
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  RESERVATION_STATUS_LABELS,
  Reservation,
  ScheduleEntry,
  hhmm,
  isoDate,
} from 'src/types/schedule';
import { numericSx } from 'src/theme/theme';

export default function AgendaPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(isoDate(new Date()));
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [selected, setSelected] = useState<ScheduleEntry | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ machineId: '', preOrderId: '', startHour: '07', hours: 3 });
  /** Conta que recebeu. Só precisa ser escolhida quando há mais de uma ativa. */
  const [bankAccountId, setBankAccountId] = useState('');
  /** Mover hora de máquina. `machineId` vazio mantém a atual. */
  const [moving, setMoving] = useState<ScheduleEntry | null>(null);
  const [moveForm, setMoveForm] = useState({ day: '', startHour: '07', hours: 1, machineId: '' });
  /** Atendimento: o MESMO formulário cria e edita — `editing` diz qual dos dois. */
  const [consultOpen, setConsultOpen] = useState(false);
  const [consultEditing, setConsultEditing] = useState<ScheduleEntry | null>(null);
  const [consultForm, setConsultForm] = useState({
    title: '',
    day: '',
    startTime: '09:00',
    endTime: '09:30',
  });
  const [rescheduling, setRescheduling] = useState<Reservation | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    day: isoDate(new Date()),
    startHour: '07',
  });

  const load = useCallback(async () => {
    try {
      const from = new Date(`${day}T00:00:00`);
      const to = new Date(`${day}T23:59:59`);
      const [
        loadedEntries,
        loadedMachines,
        loadedHours,
        loadedReservations,
        loadedPreOrders,
        loadedBankAccounts,
      ] = await Promise.all([
        scheduleService.agenda(from.toISOString(), to.toISOString()),
        machineService.list(),
        accountService.listBusinessHours(),
        scheduleService.listReservations(),
        preOrderService.listOpenPreOrders(),
        financeService.listBankAccounts(),
      ]);
      setEntries(loadedEntries);
      setMachines(loadedMachines);
      setHours(loadedHours);
      setReservations(loadedReservations);
      setPreOrders(loadedPreOrders);
      const ativas = loadedBankAccounts.filter((account) => account.isActive);
      setBankAccounts(ativas);
      setBankAccountId((atual) =>
        ativas.some((account) => account.id === atual) ? atual : (ativas[0]?.id ?? ''),
      );
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar a agenda.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [day, enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  /** A grade cobre as janelas do dia — não 00h às 24h de linhas vazias. */
  const { fromHour, toHour } = useMemo(() => {
    const weekday = new Date(`${day}T12:00:00`).getDay();
    const doDia = hours.filter((hour) => hour.weekday === weekday);
    if (doDia.length === 0) {
      return { fromHour: 7, toHour: 19 };
    }
    const starts = doDia.map((hour) => Number(hour.startsAt.slice(0, 2)));
    const ends = doDia.map((hour) => Math.ceil(Number(hour.endsAt.replace(':', '.')) / 1));
    return {
      fromHour: Math.min(...starts),
      toHour:
        Math.max(
          ...doDia.map((hour) =>
            Math.ceil(Number(hour.endsAt.slice(0, 2)) + (hour.endsAt.slice(3) === '00' ? 0 : 1)),
          ),
        ) || Math.max(...ends),
    };
  }, [day, hours]);

  const columns = useMemo(() => {
    const ativas = machines.filter((machine) => machine.isActive);
    const porMaquina = ativas.map((machine) => ({
      key: machine.id,
      label: machine.name,
      entries: entries.filter((entry) => entry.machine?.id === machine.id),
    }));
    const atendimentos = entries.filter((entry) => entry.type === 'consultation');
    return [...porMaquina, { key: 'consultations', label: 'Atendimentos', entries: atendimentos }];
  }, [machines, entries]);

  const selectedReservation = selected?.reservationId
    ? reservations.find((reservation) => reservation.id === selected.reservationId)
    : null;

  async function act(action: () => Promise<unknown>, ok: string) {
    try {
      await action();
      enqueueSnackbar(ok, { variant: 'success' });
      setSelected(null);
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível concluir.'), { variant: 'error' });
    }
  }

  /** ISO → 'HH:MM' no relógio local, que é como o Administrativo lê a agenda. */
  function horaLocal(iso: string): string {
    const date = new Date(iso);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function abrirMover(entry: ScheduleEntry) {
    const inicio = new Date(entry.startsAt);
    const fim = new Date(entry.endsAt);
    setMoveForm({
      day: isoDate(inicio),
      startHour: String(inicio.getHours()).padStart(2, '0'),
      hours: Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 3_600_000)),
      machineId: entry.machine?.id ?? '',
    });
    setMoving(entry);
  }

  async function moverHoraDeMaquina() {
    if (!moving) return;
    const startsAt = new Date(`${moveForm.day}T${moveForm.startHour.padStart(2, '0')}:00:00`);
    const endsAt = new Date(startsAt.getTime() + moveForm.hours * 3_600_000);

    await act(
      () =>
        scheduleService.moveMachineHour(moving.id, {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          machineId: moveForm.machineId || null,
        }),
      'Horário movido.',
    );
    setMoving(null);
  }

  function abrirAtendimento(entry?: ScheduleEntry) {
    if (entry) {
      setConsultForm({
        title: entry.title ?? '',
        day: isoDate(new Date(entry.startsAt)),
        startTime: horaLocal(entry.startsAt),
        endTime: horaLocal(entry.endsAt),
      });
    } else {
      setConsultForm({ title: '', day, startTime: '09:00', endTime: '09:30' });
    }
    setConsultEditing(entry ?? null);
    setConsultOpen(true);
  }

  async function salvarAtendimento() {
    const payload = {
      title: consultForm.title,
      startsAt: new Date(`${consultForm.day}T${consultForm.startTime}:00`).toISOString(),
      endsAt: new Date(`${consultForm.day}T${consultForm.endTime}:00`).toISOString(),
    };

    await act(
      () =>
        consultEditing
          ? scheduleService.updateConsultation(consultEditing.id, payload)
          : scheduleService.createConsultation(payload),
      consultEditing ? 'Atendimento atualizado.' : 'Atendimento criado.',
    );
    setConsultOpen(false);
  }

  async function createReservation() {
    const startsAt = new Date(`${day}T${form.startHour.padStart(2, '0')}:00:00`);
    const endsAt = new Date(startsAt.getTime() + form.hours * 3_600_000);

    await act(
      () =>
        scheduleService.createReservation({
          machineId: form.machineId,
          preOrderId: form.preOrderId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      'Reserva criada. Ela só aparece para o Modelista depois do pagamento.',
    );
    setNewOpen(false);
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
        title="Agenda"
        description="Hora de máquina é venda; atendimento é conversa. Os dois ocupam a agenda do Modelista."
        action={
          <Stack direction="row" spacing={1.5}>
            <TextField
              type="date"
              size="small"
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />
            <Button variant="outlined" onClick={() => abrirAtendimento()}>
              + Atendimento
            </Button>
            <Button onClick={() => setNewOpen(true)}>+ Reserva</Button>
          </Stack>
        }
      />

      <AgendaGrid columns={columns} fromHour={fromHour} toHour={toHour} onSelect={setSelected} />

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: '80ch' }}>
        Faixa tracejada é pré-reserva: segura o horário mas não está paga — e não existe para o
        Modelista. Compromissos sobrepostos aparecem lado a lado; clique para ver o detalhe.
      </Typography>

      {/* ==== Detalhe do compromisso ==== */}
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {selected?.customer?.name ?? selected?.title ?? 'Compromisso'}
          {selected && (
            <Typography variant="body2" color="text.secondary" sx={numericSx}>
              {hhmm(selected.startsAt)}–{hhmm(selected.endsAt)}
              {selected.machine ? ` · ${selected.machine.name}` : ' · Atendimento'}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedReservation ? (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={RESERVATION_STATUS_LABELS[selectedReservation.status]}
                  color={selectedReservation.status === 'pre_reserved' ? 'error' : 'info'}
                />
                {selectedReservation.paymentMethod && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={PAYMENT_METHOD_LABELS[selectedReservation.paymentMethod]}
                  />
                )}
              </Stack>

              <Divider />

              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Horas reservadas</Typography>
                <Typography sx={numericSx}>{selectedReservation.hours}h</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Valor da hora</Typography>
                <Typography sx={numericSx}>
                  {formatCents(selectedReservation.hourPriceCents)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h4" component="p">
                  Total
                </Typography>
                <Typography sx={{ ...numericSx, fontSize: 20, fontWeight: 600 }}>
                  {formatCents(selectedReservation.totalCents)}
                </Typography>
              </Stack>

              {selectedReservation.status === 'pre_reserved' && (
                <>
                  <Alert severity="warning">
                    Pagamento é catraca: enquanto não for registrado, esta reserva não existe para o
                    Modelista. Registrar o recebimento já lança a entrada no caixa — não repita o
                    lançamento à mão.
                  </Alert>
                  {bankAccounts.length > 1 && (
                    <TextField
                      select
                      size="small"
                      label="Conta que recebeu"
                      value={bankAccountId}
                      onChange={(event) => setBankAccountId(event.target.value)}
                    >
                      {bankAccounts.map((account) => (
                        <MenuItem key={account.id} value={account.id}>
                          {account.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                  {bankAccounts.length === 0 && (
                    <Alert severity="error">
                      Nenhuma conta bancária ativa. Cadastre uma em Contas e categorias — sem conta,
                      o recebimento não tem onde entrar.
                    </Alert>
                  )}
                </>
              )}

              {selectedReservation.status === 'no_show' && (
                <Alert severity="error">
                  Não compareceu.{' '}
                  {selectedReservation.noShowResolution
                    ? `Resolvido: ${selectedReservation.noShowResolution === 'rescheduled' ? 'remarcado' : 'baixa'}.`
                    : 'Escolha remarcar ou dar baixa — o sistema não decide por você.'}
                </Alert>
              )}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Atendimento na agenda. Não é faturável e pode sobrepor hora de máquina.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button variant="outlined" onClick={() => setSelected(null)}>
            Fechar
          </Button>

          {selected?.type === 'consultation' && (
            <>
              <Button variant="outlined" onClick={() => abrirAtendimento(selected)}>
                Editar
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() =>
                  act(
                    () => scheduleService.removeConsultation(selected.id),
                    'Atendimento removido.',
                  )
                }
              >
                Remover
              </Button>
            </>
          )}

          {/* Mover só antes da execução: depois do primeiro start, mudar o horário mentiria sobre
              quando o corte aconteceu. */}
          {selected?.type === 'machine_hour' &&
            (selectedReservation?.status === 'pre_reserved' ||
              selectedReservation?.status === 'confirmed') && (
              <Button variant="outlined" onClick={() => abrirMover(selected)}>
                Mover
              </Button>
            )}

          {selectedReservation?.status === 'pre_reserved' && (
            <>
              {/*
               * "Liberar para a fila" saiu daqui a pedido do Eliab.
               *
               * O rótulo confundia duas filas diferentes: quem lê entende "mandar para a fila do
               * Modelista", que é o que o PAGAMENTO faz. A ação era o contrário — desistir da
               * pré-reserva e devolver o horário para a fila de ESPERA.
               *
               * Quem cobre esse caso agora é "Cancelar", que também libera o horário. O endpoint
               * `PATCH /reservations/:id/release` continua existindo e testado; só não tem botão.
               */}
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                <Button
                  key={method}
                  disabled={bankAccounts.length === 0}
                  onClick={() =>
                    act(
                      () =>
                        scheduleService.registerPayment(
                          selectedReservation.id,
                          method,
                          bankAccountId,
                        ),
                      'Pagamento registrado, entrada lançada no caixa e reserva liberada para o Modelista.',
                    )
                  }
                >
                  Recebi em {PAYMENT_METHOD_LABELS[method]}
                </Button>
              ))}
            </>
          )}

          {selectedReservation?.status === 'no_show' && !selectedReservation.noShowResolution && (
            <>
              <Button
                variant="outlined"
                onClick={() => {
                  setRescheduling(selectedReservation);
                  setRescheduleForm({ day, startHour: '07' });
                }}
              >
                Remarcar
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() =>
                  act(
                    () => scheduleService.resolveNoShow(selectedReservation.id, 'written_off'),
                    'Baixa registrada.',
                  )
                }
              >
                Dar baixa
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ==== Remarcação de no-show ==== */}
      <Dialog
        open={Boolean(rescheduling)}
        onClose={() => setRescheduling(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Remarcar</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            A reserva nova nasce paga com o dinheiro da original — nada é cobrado de novo e nenhum
            lançamento é criado. Por isso vai na mesma máquina e mantém as {rescheduling?.hours}h já
            pagas. Se o cliente precisa de mais tempo, remarque estas horas e crie uma reserva
            separada para o restante: duas reservas, dois pagamentos, dois lançamentos.
          </Alert>
          <Stack direction="row" spacing={2}>
            <TextField
              type="date"
              label="Dia"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={rescheduleForm.day}
              onChange={(event) =>
                setRescheduleForm({ ...rescheduleForm, day: event.target.value })
              }
            />
            <TextField
              label="Começa às"
              type="number"
              sx={{ minWidth: 140 }}
              inputProps={{ min: 0, max: 23 }}
              helperText="Hora cheia"
              value={rescheduleForm.startHour}
              onChange={(event) =>
                setRescheduleForm({ ...rescheduleForm, startHour: event.target.value })
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setRescheduling(null)}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              if (!rescheduling) return;
              const startsAt = new Date(
                `${rescheduleForm.day}T${rescheduleForm.startHour.padStart(2, '0')}:00:00`,
              );
              const endsAt = new Date(startsAt.getTime() + rescheduling.hours * 3_600_000);
              await act(
                () =>
                  scheduleService.rescheduleNoShow(rescheduling.id, {
                    startsAt: startsAt.toISOString(),
                    endsAt: endsAt.toISOString(),
                  }),
                'Remarcado. A reserva nova já está paga e não gerou lançamento novo.',
              );
              setRescheduling(null);
            }}
          >
            Remarcar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==== Mover hora de máquina ==== */}
      <Dialog open={Boolean(moving)} onClose={() => setMoving(null)} fullWidth maxWidth="sm">
        <DialogTitle>Mover hora de máquina</DialogTitle>
        <DialogContent>
          {selectedReservation?.status === 'confirmed' ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Esta reserva já está paga: só o <strong>horário</strong> pode mudar. Duração e máquina
              entram no valor cobrado — para vender mais tempo, crie uma reserva separada.
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              Nada foi cobrado ainda, então horário, duração e máquina podem mudar. O total é
              recalculado com o preço da máquina escolhida.
            </Alert>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                type="date"
                label="Dia"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={moveForm.day}
                onChange={(event) => setMoveForm({ ...moveForm, day: event.target.value })}
              />
              <TextField
                label="Começa às"
                type="number"
                sx={{ minWidth: 130 }}
                inputProps={{ min: 0, max: 23 }}
                helperText="Hora cheia"
                value={moveForm.startHour}
                onChange={(event) => setMoveForm({ ...moveForm, startHour: event.target.value })}
              />
              <TextField
                label="Horas"
                type="number"
                sx={{ minWidth: 110 }}
                inputProps={{ min: 1, max: 24 }}
                disabled={selectedReservation?.status === 'confirmed'}
                value={moveForm.hours}
                onChange={(event) =>
                  setMoveForm({ ...moveForm, hours: Number(event.target.value) })
                }
              />
            </Stack>
            <TextField
              select
              label="Máquina"
              fullWidth
              disabled={selectedReservation?.status === 'confirmed'}
              value={moveForm.machineId}
              onChange={(event) => setMoveForm({ ...moveForm, machineId: event.target.value })}
            >
              {machines
                .filter((machine) => machine.isActive || machine.id === moveForm.machineId)
                .map((machine) => (
                  <MenuItem key={machine.id} value={machine.id}>
                    {machine.name} · {formatCents(machine.hourPriceCents)}/h
                  </MenuItem>
                ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setMoving(null)}>
            Cancelar
          </Button>
          <Button onClick={moverHoraDeMaquina} disabled={!moveForm.day}>
            Mover
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==== Atendimento: criar e editar no mesmo formulário ==== */}
      <Dialog open={consultOpen} onClose={() => setConsultOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{consultEditing ? 'Editar atendimento' : 'Novo atendimento'}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Atendimento não é faturável e não segue hora cheia — pode ser de 30 minutos às 09:15. Se
            sobrepuser hora de máquina, o sistema avisa e deixa seguir.
          </Alert>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Título"
              fullWidth
              required
              placeholder="Primeira conversa — Malharia São Bento"
              value={consultForm.title}
              onChange={(event) => setConsultForm({ ...consultForm, title: event.target.value })}
            />
            {/* Empilha no celular: os três lado a lado num diálogo estreito cortam o relógio
                do campo de hora, e o operador perde o botão que abre o seletor. */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                type="date"
                label="Dia"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={consultForm.day}
                onChange={(event) => setConsultForm({ ...consultForm, day: event.target.value })}
              />
              <TextField
                type="time"
                label="Início"
                InputLabelProps={{ shrink: true }}
                // `flexShrink: 0` é o que segura: sem ele o campo de dia, que é `fullWidth`,
                // come a largura dos dois vizinhos e o relógio fica cortado.
                sx={{ minWidth: 138, flexShrink: 0 }}
                value={consultForm.startTime}
                onChange={(event) =>
                  setConsultForm({ ...consultForm, startTime: event.target.value })
                }
              />
              <TextField
                type="time"
                label="Fim"
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 138, flexShrink: 0 }}
                value={consultForm.endTime}
                onChange={(event) =>
                  setConsultForm({ ...consultForm, endTime: event.target.value })
                }
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setConsultOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={salvarAtendimento}
            disabled={!consultForm.title.trim() || !consultForm.day}
          >
            {consultEditing ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==== Nova reserva ==== */}
      <Dialog open={newOpen} onClose={() => setNewOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nova reserva</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            O valor vem da máquina escolhida. As horas vêm do pré-pedido — quem as definiu foi o
            Modelista.
          </Alert>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Pré-pedido"
              fullWidth
              value={form.preOrderId}
              onChange={(event) => {
                const preOrder = preOrders.find((item) => item.id === event.target.value);
                setForm({
                  ...form,
                  preOrderId: event.target.value,
                  hours: preOrder?.estimatedHours ?? form.hours,
                });
              }}
            >
              {preOrders.map((preOrder) => (
                <MenuItem key={preOrder.id} value={preOrder.id}>
                  {preOrder.customer.name} · {preOrder.estimatedHours}h · {preOrder.fabric.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Máquina"
              fullWidth
              value={form.machineId}
              onChange={(event) => setForm({ ...form, machineId: event.target.value })}
            >
              {machines
                .filter((machine) => machine.isActive)
                .map((machine) => (
                  <MenuItem key={machine.id} value={machine.id}>
                    {machine.name} · {formatCents(machine.hourPriceCents)}/h
                  </MenuItem>
                ))}
            </TextField>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Começa às"
                type="number"
                sx={{ minWidth: 140 }}
                inputProps={{ min: 0, max: 23 }}
                helperText="Hora cheia"
                value={form.startHour}
                onChange={(event) => setForm({ ...form, startHour: event.target.value })}
              />
              <TextField
                label="Horas"
                type="number"
                sx={{ minWidth: 140 }}
                inputProps={{ min: 1, max: 24 }}
                value={form.hours}
                onChange={(event) => setForm({ ...form, hours: Number(event.target.value) })}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setNewOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={createReservation} disabled={!form.machineId || !form.preOrderId}>
            Criar pré-reserva
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
