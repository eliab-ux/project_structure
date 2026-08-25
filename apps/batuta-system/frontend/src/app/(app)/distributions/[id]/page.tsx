'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import {
  ConfirmDialog,
  ErrorState,
  Loading,
  PageHeader,
  StatusChip,
  formatDateTime,
} from 'src/components/common/common';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import { auditService, distributionService } from 'src/services/services';
import type { DistributionProgress } from 'src/types/api';

/**
 * Tracking one distribution, plus the running controls (§10, FASE 7 item 8).
 *
 * It polls every ten seconds while the campaign is live. Polling rather than a socket because the only
 * thing moving is a set of counters, and a campaign paced at one message per minute per chip does not need
 * push — it needs to not lie about where it is.
 *
 * `contentChangedSincePlanning` gets a banner of its own. Every message was rendered and frozen at planning
 * time, so if the content was edited afterwards, what is going out is the approved text and NOT what the
 * content screen now shows. That discrepancy is correct and has to be visible rather than discovered.
 */
export default function DistributionDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [progress, setProgress] = useState<DistributionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      setProgress(await distributionService.detail(params.id));
      setError(null);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar a distribuição.'));
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll only while something can still change.
  useEffect(() => {
    if (!progress || !['PLANNED', 'RUNNING'].includes(progress.status)) {
      return undefined;
    }
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [progress, load]);

  async function control(action: 'pause' | 'resume') {
    try {
      if (action === 'pause') {
        await distributionService.pause(params.id);
        enqueueSnackbar('Distribuição pausada. Os envios pendentes saíram da fila.', {
          variant: 'success',
        });
      } else {
        await distributionService.resume(params.id);
        enqueueSnackbar('Distribuição retomada.', { variant: 'success' });
      }
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  async function cancel(reason: string) {
    try {
      await distributionService.cancel(params.id, reason || undefined);
      enqueueSnackbar('Distribuição cancelada. O que já foi enviado permanece registrado.', {
        variant: 'success',
      });
      setCancelling(false);
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
      setCancelling(false);
    }
  }

  if (!progress && !error) {
    return <Loading label="Carregando distribuição" />;
  }
  if (error || !progress) {
    return <ErrorState message={error ?? 'Distribuição não encontrada.'} onRetry={load} />;
  }

  const live = ['PLANNED', 'RUNNING'].includes(progress.status);

  return (
    <Box>
      <PageHeader
        title={progress.contentTitle}
        description={`Janela ${formatDateTime(progress.windowStart)} → ${formatDateTime(progress.windowEnd)}`}
        actions={
          <>
            <Button onClick={() => router.push('/distributions')}>Voltar</Button>
            {live ? (
              <Button startIcon={<PauseIcon />} onClick={() => control('pause')}>
                Pausar
              </Button>
            ) : null}
            {progress.status === 'PAUSED' ? (
              <Button startIcon={<PlayArrowIcon />} onClick={() => control('resume')}>
                Retomar
              </Button>
            ) : null}
            {live || progress.status === 'PAUSED' ? (
              <Button color="error" startIcon={<StopIcon />} onClick={() => setCancelling(true)}>
                Cancelar
              </Button>
            ) : null}
            {isAdmin ? (
              <>
                <Button
                  startIcon={<DownloadIcon />}
                  onClick={() => auditService.downloadReport(params.id, 'CSV')}
                >
                  CSV
                </Button>
                <Button
                  startIcon={<DownloadIcon />}
                  onClick={() => auditService.downloadReport(params.id, 'PDF')}
                >
                  PDF
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <StatusChip status={progress.status} size="medium" />
        {progress.confirmedAt ? (
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
            confirmada em {formatDateTime(progress.confirmedAt)}
          </Typography>
        ) : null}
      </Stack>

      {progress.contentChangedSincePlanning ? (
        <Alert severity="warning" sx={{ mb: 3 }} role="alert">
          O conteúdo foi editado depois deste planejamento. Os envios desta distribuição carregam o
          texto
          <strong> aprovado no momento do plano</strong> — que é o correto, e é diferente do que a
          tela de conteúdo mostra agora.
        </Alert>
      ) : null}

      {/*
        A pergunta que os contadores não respondem: "está PLANNED, zero enviado — quebrou?". Quase
        sempre não quebrou — a cota do chip do dia acabou e o resto está agendado para amanhã de
        manhã. O `scheduled_at` já estava congelado nas linhas desde o planejamento; só não aparecia
        em lugar nenhum, e a única forma de distinguir "amanhã às 08:00" de "defeito" era ler o banco.
      */}
      {progress.nextSendAt && progress.pending > 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          Próximo envio em <strong>{formatDateTime(progress.nextSendAt)}</strong> —{' '}
          {progress.pending} pendente(s). Se a data for depois de hoje, a cota diária dos chips já
          foi consumida e o resto continua na fila para os próximos dias.
        </Alert>
      ) : null}

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 60 }}>
              {progress.progressPercent}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress.progressPercent}
              sx={{ flexGrow: 1, height: 10, borderRadius: 1 }}
            />
          </Stack>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {[
              { label: 'Enviados', value: progress.sent, color: 'success.main' },
              { label: 'Pendentes', value: progress.pending, color: 'text.primary' },
              { label: 'Enviando', value: progress.sending, color: 'info.main' },
              { label: 'Falharam', value: progress.failed, color: 'error.main' },
              { label: 'Bloqueados', value: progress.blocked, color: 'warning.main' },
              { label: 'Cancelados', value: progress.cancelled, color: 'text.secondary' },
            ].map((metric) => (
              <Grid item xs={4} sm={2} key={metric.label}>
                <Typography variant="overline" color="text.secondary">
                  {metric.label}
                </Typography>
                <Typography variant="h6" component="p" color={metric.color}>
                  {metric.value}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Por canal
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Canal</TableCell>
                    <TableCell align="right">Programados</TableCell>
                    <TableCell align="right">Enviados</TableCell>
                    <TableCell align="right">Falharam</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {progress.perChannel.map((channel) => (
                    <TableRow key={channel.channelId}>
                      <TableCell>{channel.channelLabel}</TableCell>
                      <TableCell align="right">{channel.scheduled}</TableCell>
                      <TableCell align="right">{channel.sent}</TableCell>
                      <TableCell align="right">{channel.failed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Bloqueios por motivo
              </Typography>
              {progress.blockedByReason.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum bloqueio.
                </Typography>
              ) : (
                <Table size="small">
                  <TableBody>
                    {progress.blockedByReason.map((entry) => (
                      <TableRow key={entry.reason}>
                        <TableCell>{entry.reason.replace(/_/g, ' ')}</TableCell>
                        <TableCell align="right">{entry.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ConfirmDialog
        open={cancelling}
        title="Cancelar distribuição"
        description="Os envios que ainda não saíram serão cancelados. O que já foi enviado permanece registrado — não há como desenviar uma mensagem, e o relatório continua mostrando o que saiu. Não há como desfazer o cancelamento."
        confirmLabel="Cancelar envios pendentes"
        destructive
        onCancel={() => setCancelling(false)}
        onConfirm={cancel}
      />
    </Box>
  );
}
