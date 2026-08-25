'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from 'src/components/AppShell/AppShell';
import { StatusChip } from 'src/components/StatusChip/StatusChip';
import { errorMessage } from 'src/services/api';
import dispatchService from 'src/services/dispatchService';
import scheduleService from 'src/services/scheduleService';
import whatsappService from 'src/services/whatsappService';
import { DispatchLog, Schedule, TodayVideo, WhatsappInstance } from 'src/types';

export default function DashboardPage() {
  const [instance, setInstance] = useState<WhatsappInstance | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [today, setToday] = useState<TodayVideo | null>(null);
  const [todayError, setTodayError] = useState<string | null>(null);
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // `allSettled`: uma parte indisponível não deve apagar o resto do painel.
      const [inst, sched, hist, todayRes] = await Promise.allSettled([
        whatsappService.getInstance(),
        scheduleService.get(),
        dispatchService.history(1, 5),
        dispatchService.today(),
      ]);
      if (inst.status === 'fulfilled') setInstance(inst.value);
      if (sched.status === 'fulfilled') setSchedule(sched.value);
      if (hist.status === 'fulfilled') setLogs(hist.value.data);
      if (todayRes.status === 'fulfilled') {
        setToday(todayRes.value);
      } else {
        setTodayError(errorMessage(todayRes.reason, 'Não há vídeo para hoje no catálogo'));
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <Box
          role="status"
          aria-label="Carregando"
          sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
        >
          <CircularProgress />
        </Box>
      </AppShell>
    );
  }

  const connected = instance?.status === 'connected';
  const active = schedule?.isActive === true;

  return (
    <AppShell>
      <Typography component="h1" variant="h2" gutterBottom>
        Painel
      </Typography>

      <Stack spacing={2}>
        {!connected && (
          <Alert
            role="alert"
            severity="warning"
            action={
              <Button component={Link} href="/whatsapp" size="small">
                Conectar
              </Button>
            }
          >
            Seu WhatsApp não está conectado — nenhuma mensagem será enviada.
          </Alert>
        )}
        {connected && !schedule?.configured && (
          <Alert
            role="alert"
            severity="info"
            action={
              <Button component={Link} href="/configuracao" size="small">
                Configurar
              </Button>
            }
          >
            Falta escolher o grupo e o horário do envio.
          </Alert>
        )}
        {connected && schedule?.configured && !active && (
          <Alert
            role="alert"
            severity="warning"
            action={
              <Button component={Link} href="/configuracao" size="small">
                Ativar
              </Button>
            }
          >
            O envio automático está pausado.
          </Alert>
        )}

        <Card component="section">
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Mensagem de hoje
            </Typography>
            {today ? (
              <>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    mt: 1,
                    p: 2,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.95rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {today.messagePreview}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {today.title} · dia {today.dayNumber} do plano
                </Typography>
              </>
            ) : (
              <Alert role="alert" severity="error" sx={{ mt: 1 }}>
                {todayError}
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card component="section">
          <CardContent>
            <Stack spacing={1.5}>
              <Row label="WhatsApp">
                <StatusChip status={instance?.status ?? null} />
                {instance?.connectedNumber && (
                  <Typography variant="body2" color="text.secondary">
                    {instance.connectedNumber}
                  </Typography>
                )}
              </Row>
              <Divider />
              <Row label="Grupo de destino">
                <Typography variant="body2">{schedule?.groupName ?? '—'}</Typography>
              </Row>
              <Divider />
              <Row label="Horário">
                <Typography variant="body2">
                  {schedule?.sendTime ? `${schedule.sendTime} (${schedule.timezone})` : '—'}
                </Typography>
              </Row>
              <Divider />
              <Row label="Envio automático">
                <Chip
                  size="small"
                  label={active ? 'Ativo' : 'Pausado'}
                  color={active ? 'success' : 'default'}
                  variant={active ? 'filled' : 'outlined'}
                />
              </Row>
            </Stack>
          </CardContent>
        </Card>

        <Card component="section">
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography variant="overline" color="text.secondary">
                Últimos envios
              </Typography>
              <Button component={Link} href="/historico" size="small">
                Ver tudo
              </Button>
            </Stack>
            {logs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum envio ainda.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {logs.map((log) => (
                  <Stack key={log.id} direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'ui-monospace, monospace', minWidth: 92 }}
                    >
                      {log.referenceDate}
                    </Typography>
                    <StatusChip status={log.status} />
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {log.dayNumber ? `dia ${log.dayNumber}` : (log.errorReason ?? '—')}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        {children}
      </Stack>
    </Stack>
  );
}
