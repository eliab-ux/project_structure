'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { RequireAuth } from 'src/components/RequireAuth';
import scheduleService from 'src/services/scheduleService';
import { apiErrorMessage } from 'src/services/api';
import {
  RESERVATION_STATUS_LABELS,
  ReservationForModelista,
  ScheduleEntry,
  hhmm,
  isoDate,
} from 'src/types/schedule';
import { numericSx } from 'src/theme/theme';

const TOUCH = { minHeight: 56 };

/**
 * A fila do Modelista.
 *
 * Só chega aqui o que está **pago** — o backend filtra `confirmed`/`in_progress` no repositório, e
 * o DTO não traz campo monetário nenhum. Pré-reserva não existe para ele: "não está na agenda, não
 * faz" (§5).
 */
function QueueScreen() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<ReservationForModelista[]>([]);
  const [consultations, setConsultations] = useState<ScheduleEntry[]>([]);

  const load = useCallback(async () => {
    try {
      // O dia inteiro, no relógio local. O Modelista precisa ver o atendimento marcado para as
      // 16h logo cedo, não quando ele já passou.
      const hoje = isoDate(new Date());
      const [fila, agenda] = await Promise.all([
        scheduleService.modelistaQueue(),
        scheduleService.agenda(
          new Date(`${hoje}T00:00:00`).toISOString(),
          new Date(`${hoje}T23:59:59`).toISOString(),
        ),
      ]);

      setQueue(fila);
      setConsultations(agenda.filter((entry) => entry.type === 'consultation'));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar a fila.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markNoShow(id: string) {
    try {
      await scheduleService.markNoShow(id);
      enqueueSnackbar('Marcado. O Administrativo decide o que fazer.', { variant: 'success' });
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível marcar.'), { variant: 'error' });
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

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 3 }}>
      <Container maxWidth="sm">
        <Typography variant="overline" component="p" sx={{ color: 'info.main' }}>
          Fila do dia
        </Typography>
        <Typography variant="h2" component="h1" gutterBottom>
          Cortes pagos
        </Typography>

        {/*
         * Atendimentos do dia — conversa marcada, não corte.
         *
         * Aparecem aqui porque ocupam a agenda DELE: é hora em que ele não está na máquina. O
         * `ScheduleEntryDto` não carrega campo monetário nenhum, então a §5 continua respeitada
         * mesmo com o Modelista lendo a agenda.
         */}
        {consultations.length > 0 && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            <Typography variant="overline" component="p" sx={{ color: 'text.secondary' }}>
              Atendimentos de hoje
            </Typography>
            {consultations.map((entry) => (
              <Paper
                key={entry.id}
                variant="outlined"
                sx={{ p: 1.75, borderLeft: '3px solid', borderLeftColor: 'info.main' }}
              >
                <Typography variant="h4" component="h2">
                  {entry.title ?? entry.customer?.name ?? 'Atendimento'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={numericSx}>
                  {hhmm(entry.startsAt)}–{hhmm(entry.endsAt)}
                  {entry.customer ? ` · ${entry.customer.name}` : ''}
                </Typography>
              </Paper>
            ))}
          </Stack>
        )}

        {queue.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Nada na fila. Reserva só aparece aqui depois que o Administrativo registra o pagamento.
          </Alert>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {queue.map((reservation) => (
              <Paper key={reservation.id} variant="outlined" sx={{ p: 2 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  gap={1}
                >
                  <Box>
                    <Typography variant="h4" component="h2">
                      {reservation.customer.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={numericSx}>
                      {hhmm(reservation.startsAt)}–{hhmm(reservation.endsAt)} ·{' '}
                      {reservation.machine.name}
                    </Typography>
                  </Box>
                  <Stack spacing={0.5} alignItems="flex-end">
                    <Typography sx={{ ...numericSx, fontSize: 24, fontWeight: 600 }}>
                      {reservation.hours}h
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={RESERVATION_STATUS_LABELS[reservation.status]}
                    />
                  </Stack>
                </Stack>

                <Stack spacing={1} sx={{ mt: 2 }}>
                  <Button
                    component={Link}
                    href={`/m/matriz/${reservation.id}`}
                    fullWidth
                    sx={TOUCH}
                  >
                    {reservation.status === 'in_progress' ? 'Continuar corte' : 'Começar corte'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    sx={TOUCH}
                    onClick={() => markNoShow(reservation.id)}
                  >
                    Cliente não veio
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        <Button component={Link} href="/m" variant="outlined" fullWidth sx={{ ...TOUCH, mt: 3 }}>
          Voltar
        </Button>
      </Container>
    </Box>
  );
}

export default function Page() {
  return (
    <RequireAuth allow={['modelista', 'owner']}>
      <QueueScreen />
    </RequireAuth>
  );
}
