'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { RequireAuth } from 'src/components/RequireAuth';
import cutService from 'src/services/cutService';
import scheduleService from 'src/services/scheduleService';
import { apiErrorMessage } from 'src/services/api';
import { Cut, clock, shortDuration } from 'src/types/cut';
import { LAYOUT_TYPE_LABELS, LayoutType } from 'src/types/preOrder';
import { ReservationForModelista, hhmm } from 'src/types/schedule';
import { numericSx } from 'src/theme/theme';

const TOUCH = { minHeight: 56 };

/**
 * Matriz em andamento — a tela que o Modelista usa de pé, ao lado da máquina.
 *
 * **Dois cronômetros simultâneos** (spec §8):
 *
 * - **Corrido**: `now − cut.started_at` da matriz atual. Sobe sempre, é o número em destaque, e é
 *   o que alimenta o apontamento.
 * - **Restante**: `reservation.ends_at − now` da **reserva inteira**. Desce, secundário. É com ele
 *   que ele decide se cabe mais uma matriz antes de acabar a hora comprada.
 *
 * Quando o restante chega a zero ele **não zera nem some**: vira excedente, ganha sinal e cor de
 * alerta, e conta para cima. O corrido continua subindo normalmente. **Nada trava, nada
 * interrompe, nenhum aviso bloqueante** — o excedente é só informação, não altera cobrança
 * (regra 6.4).
 */
function MatrizScreen() {
  const params = useParams<{ reservationId: string }>();
  const reservationId = params.reservationId;
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [reservation, setReservation] = useState<ReservationForModelista | null>(null);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [stopOpen, setStopOpen] = useState(false);
  const [stopForm, setStopForm] = useState({
    layers: '',
    nestedPieces: '',
    layoutType: 'zigzag' as LayoutType,
  });
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [queue, loadedCuts] = await Promise.all([
        scheduleService.modelistaQueue(),
        cutService.listByReservation(reservationId),
      ]);
      setReservation(queue.find((item) => item.id === reservationId) ?? null);
      setCuts(loadedCuts);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar a matriz.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [reservationId, enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Um tick por segundo move os dois relógios. Não há polling ao servidor — só o relógio local. */
  useEffect(() => {
    timer.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, []);

  const running = cuts.find((cut) => cut.isRunning) ?? null;
  const finished = cuts.filter((cut) => !cut.isRunning);

  const elapsedSeconds = running
    ? Math.floor((now - new Date(running.startedAt).getTime()) / 1000)
    : 0;

  /** Negativo = excedente. É o sinal que a UI mostra com `+` e em cor de alerta. */
  const remainingSeconds = reservation
    ? Math.floor((new Date(reservation.endsAt).getTime() - now) / 1000)
    : 0;

  const overtime = remainingSeconds < 0;

  /** Barra de horas: passa do fim e ganha faixa de excedente (spec §8). */
  const progress = useMemo(() => {
    if (!reservation) {
      return 0;
    }
    const start = new Date(reservation.startsAt).getTime();
    const end = new Date(reservation.endsAt).getTime();
    return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  }, [reservation, now]);

  const totalPiecesSoFar = finished.reduce((sum, cut) => sum + (cut.totalPieces ?? 0), 0);

  async function startCut() {
    setBusy(true);
    try {
      await cutService.start(reservationId);
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível iniciar a matriz.'), {
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function stopCut() {
    if (!running) {
      return;
    }
    setBusy(true);
    try {
      const result = await cutService.stop(running.id, {
        layers: Number(stopForm.layers),
        nestedPieces: Number(stopForm.nestedPieces),
        layoutType: stopForm.layoutType,
      });

      // Avisos aparecem, mas o apontamento já foi gravado — aviso, não bloqueio.
      for (const warning of result.warnings) {
        enqueueSnackbar(warning, { variant: 'warning', autoHideDuration: 8000 });
      }
      enqueueSnackbar(`Matriz encerrada: ${result.cut.totalPieces} peças.`, { variant: 'success' });

      setStopOpen(false);
      setStopForm({ layers: '', nestedPieces: '', layoutType: 'zigzag' });
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível encerrar a matriz.'), {
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function completeReservation() {
    setBusy(true);
    try {
      await cutService.completeReservation(reservationId);
      enqueueSnackbar('Reserva encerrada.', { variant: 'success' });
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível encerrar a reserva.'), {
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Box
        role="status"
        aria-label="Carregando"
        sx={{ display: 'flex', justifyContent: 'center', py: 10 }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!reservation) {
    return (
      <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 3 }}>
        <Container maxWidth="sm">
          <Alert severity="info">
            Esta reserva não está na sua fila. Ou não foi paga, ou já foi encerrada.
          </Alert>
          <Button
            component={Link}
            href="/m/fila"
            variant="outlined"
            fullWidth
            sx={{ ...TOUCH, mt: 3 }}
          >
            Voltar para a fila
          </Button>
        </Container>
      </Box>
    );
  }

  const isCompleted = reservation.status === 'completed';

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 3 }}>
      <Container maxWidth="sm">
        <Typography variant="overline" component="p" sx={{ color: 'info.main' }}>
          {reservation.machine.name} · {hhmm(reservation.startsAt)}–{hhmm(reservation.endsAt)}
        </Typography>
        <Typography variant="h2" component="h1">
          {reservation.customer.name}
        </Typography>

        {/* ==== Os dois cronômetros ==== */}
        <Paper variant="outlined" sx={{ p: 3, mt: 2.5, textAlign: 'center' }}>
          <Typography variant="overline" component="p" color="text.secondary">
            {running ? `Matriz ${running.sequence} — corrido` : 'Nenhuma matriz em andamento'}
          </Typography>
          <Typography
            component="p"
            aria-live="polite"
            sx={{ ...numericSx, fontSize: 56, fontWeight: 600, lineHeight: 1.05 }}
          >
            {clock(running ? elapsedSeconds : 0)}
          </Typography>

          <Box sx={{ mt: 2 }}>
            <Typography variant="overline" component="p" color="text.secondary">
              {overtime ? 'Excedente da reserva' : 'Restante da reserva'}
            </Typography>
            <Typography
              component="p"
              sx={{
                ...numericSx,
                fontSize: 24,
                fontWeight: 600,
                // O excedente ganha cor de alerta. Não trava nada — é informação.
                color: overtime ? 'error.main' : 'text.secondary',
              }}
            >
              {clock(remainingSeconds)}
            </Typography>
          </Box>

          <LinearProgress
            variant="determinate"
            value={progress}
            color={overtime ? 'error' : 'info'}
            sx={{ mt: 2, height: 10, borderRadius: 5 }}
          />
        </Paper>

        {overtime && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Passou do fim da reserva. Isso não interrompe nada e não muda a cobrança — cobra-se a
            hora reservada. O excedente serve ao histórico, para a próxima estimativa sair melhor.
          </Alert>
        )}

        {/* ==== Os dois toques ==== */}
        {!isCompleted && (
          <Stack spacing={1.5} sx={{ mt: 2.5 }}>
            {running ? (
              <Button
                fullWidth
                sx={{ ...TOUCH, minHeight: 72, fontSize: 20 }}
                color="error"
                disabled={busy}
                onClick={() => setStopOpen(true)}
              >
                Parar — a máquina desligou
              </Button>
            ) : (
              <Button
                fullWidth
                sx={{ ...TOUCH, minHeight: 72, fontSize: 20 }}
                disabled={busy}
                onClick={startCut}
              >
                Começar matriz {cuts.length + 1}
              </Button>
            )}

            {!running && cuts.length > 0 && (
              <Button
                variant="outlined"
                fullWidth
                sx={TOUCH}
                disabled={busy}
                onClick={completeReservation}
              >
                Encerrar a reserva
              </Button>
            )}
          </Stack>
        )}

        {isCompleted && (
          <Alert severity="success" sx={{ mt: 2.5 }}>
            Reserva concluída. As matrizes não podem mais ser alteradas.
          </Alert>
        )}

        {/* ==== Matrizes já apontadas ==== */}
        <Typography variant="h4" component="h2" sx={{ mt: 4, mb: 1.5 }}>
          Matrizes apontadas ({finished.length}) · {totalPiecesSoFar} peças
        </Typography>

        <Stack spacing={1.5}>
          {finished.map((cut) => (
            <Paper key={cut.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                <Box>
                  <Typography variant="h4" component="h3">
                    Matriz {cut.sequence}
                    {cut.markerName ? ` · ${cut.markerName}` : ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={numericSx}>
                    {cut.layers} camadas × {cut.nestedPieces} encaixadas
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {cut.fabric.name}
                    {cut.layoutType ? ` · ${LAYOUT_TYPE_LABELS[cut.layoutType]}` : ''}
                  </Typography>
                </Box>
                <Stack spacing={0.5} alignItems="flex-end">
                  <Typography sx={{ ...numericSx, fontSize: 22, fontWeight: 600 }}>
                    {cut.totalPieces}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={shortDuration(cut.durationSeconds)}
                  />
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>

        <Button
          component={Link}
          href="/m/fila"
          variant="outlined"
          fullWidth
          sx={{ ...TOUCH, mt: 3 }}
        >
          Voltar para a fila
        </Button>
      </Container>

      {/* ==== Stop: confirmação de camadas e peças encaixadas ==== */}
      <Dialog open={stopOpen} onClose={() => setStopOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Encerrar matriz {running?.sequence}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Confirme o que realmente saiu. O total de peças é calculado — você não digita.
          </Typography>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Camadas"
              fullWidth
              autoFocus
              inputProps={{ inputMode: 'numeric' }}
              value={stopForm.layers}
              onChange={(event) =>
                setStopForm({ ...stopForm, layers: event.target.value.replace(/\D/g, '') })
              }
            />
            <TextField
              label="Peças encaixadas"
              fullWidth
              inputProps={{ inputMode: 'numeric' }}
              value={stopForm.nestedPieces}
              onChange={(event) =>
                setStopForm({ ...stopForm, nestedPieces: event.target.value.replace(/\D/g, '') })
              }
            />

            {/* O total aparece calculado, em tempo real — reforça que ninguém o digita. */}
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="overline" component="p" color="text.secondary">
                Total de peças
              </Typography>
              <Typography sx={{ ...numericSx, fontSize: 32, fontWeight: 600 }}>
                {stopForm.layers && stopForm.nestedPieces
                  ? Number(stopForm.layers) * Number(stopForm.nestedPieces)
                  : '—'}
              </Typography>
            </Paper>

            <Box>
              <Typography variant="overline" component="p" sx={{ mb: 1 }}>
                Tipo de enfesto
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={stopForm.layoutType}
                onChange={(_event, value) =>
                  value && setStopForm({ ...stopForm, layoutType: value as LayoutType })
                }
              >
                {(Object.keys(LAYOUT_TYPE_LABELS) as LayoutType[]).map((type) => (
                  <ToggleButton key={type} value={type} sx={TOUCH}>
                    {LAYOUT_TYPE_LABELS[type]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setStopOpen(false)}>
            Voltar
          </Button>
          <Button onClick={stopCut} disabled={busy || !stopForm.layers || !stopForm.nestedPieces}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function Page() {
  return (
    <RequireAuth allow={['modelista', 'owner']}>
      <MatrizScreen />
    </RequireAuth>
  );
}
