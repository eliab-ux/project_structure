'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  StatusChip,
  formatAge,
  formatRate,
} from 'src/components/common/common';
import { apiErrorMessage } from 'src/services/api';
import { auditService, distributionService, inboxService } from 'src/services/services';
import type { Distribution, HealthPanel, InboxCounters } from 'src/types/api';

/** One number with a label. Deliberately plain: this screen is read at a glance, not studied. */
function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'warning' | 'error';
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography
          variant="h4"
          component="p"
          color={
            tone === 'error' ? 'error.main' : tone === 'warning' ? 'warning.main' : 'text.primary'
          }
        >
          {value}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * The dashboard (FASE 10, screen 2): channel health, running distributions, the pending queue, alerts.
 *
 * The order of the page answers the questions in the order they cost money: can I send at all (channels),
 * what is going out right now (distributions), who is waiting for an answer (queue). The reach figure is
 * on top because it is the one number people are most often wrong about — §15 risco 3.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthPanel | null>(null);
  const [counters, setCounters] = useState<InboxCounters | null>(null);
  const [running, setRunning] = useState<Distribution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // In parallel: three independent reads, and the slowest should not serialise the others.
      const [healthData, countersData, distributions] = await Promise.all([
        auditService.health(14),
        inboxService.counters(),
        distributionService.list({ limit: 5 }),
      ]);
      setHealth(healthData);
      setCounters(countersData);
      setRunning(
        distributions.data.filter((item) => ['PLANNED', 'RUNNING', 'PAUSED'].includes(item.status)),
      );
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar o painel.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <Loading label="Carregando painel" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const atRisk = health?.channels.filter((channel) => channel.assessment === 'AT_RISK') ?? [];
  const watch = health?.channels.filter((channel) => channel.assessment === 'WATCH') ?? [];
  const sendable = health?.channels.filter((channel) => channel.status === 'CONNECTED') ?? [];

  return (
    <Box>
      <PageHeader
        title="Painel"
        description="Saúde dos canais, distribuições em andamento e a fila de pendências."
        actions={<Button onClick={load}>Atualizar</Button>}
      />

      {/* Alerts first: a degraded chip is the thing that silently ruins a campaign. */}
      <Stack spacing={1} sx={{ mb: 3 }}>
        {atRisk.map((channel) => (
          <Alert key={channel.channelId} severity="error" role="alert">
            <strong>{channel.label}</strong> — {channel.assessmentReason}
          </Alert>
        ))}
        {watch.map((channel) => (
          <Alert key={channel.channelId} severity="warning">
            <strong>{channel.label}</strong> — {channel.assessmentReason}
          </Alert>
        ))}
        {sendable.length === 0 ? (
          <Alert severity="error" role="alert">
            Nenhum canal conectado. Nada pode ser enviado até pareá-los na tela de Canais.
          </Alert>
        ) : null}
        {counters && counters.oldestAgeMinutes > 24 * 60 ? (
          <Alert severity="warning">
            Há uma conversa esperando resposta há {formatAge(counters.oldestAgeMinutes)}. Ignorar
            resposta é risco para o chip, não só imagem.
          </Alert>
        ) : null}
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Metric
            label="Alcance por dia"
            value={health?.dailyCapacity ?? 0}
            hint={`${sendable.length} canal(is) conectado(s)`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Metric
            label="Base roteável"
            value={health?.contactsRoutable ?? 0}
            hint={`de ${health?.contactsTotal ?? 0} contatos`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Metric
            label="Dias p/ cobrir a base"
            value={health?.daysToCoverBase ?? '—'}
            hint="No ritmo sustentável atual"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Metric
            label="Aguardando resposta"
            value={counters?.pendingReply ?? 0}
            hint={
              counters
                ? `idade média ${formatAge(counters.averageAgeMinutes)} · ${counters.highPriority} urgente(s)`
                : undefined
            }
            tone={counters && counters.highPriority > 0 ? 'warning' : 'default'}
          />
        </Grid>
      </Grid>

      <Box component="section" aria-label="Canais" sx={{ mb: 4 }}>
        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
          Canais
        </Typography>
        <Card variant="outlined">
          {health && health.channels.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Canal</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Cota hoje</TableCell>
                  <TableCell align="right">Entrega</TableCell>
                  <TableCell align="right">Opt-out</TableCell>
                  <TableCell>Avaliação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {health.channels.map((channel) => (
                  <TableRow key={channel.channelId} hover>
                    <TableCell>{channel.label}</TableCell>
                    <TableCell>
                      <StatusChip status={channel.status} />
                    </TableCell>
                    <TableCell align="right">
                      {channel.currentQuota}
                      <Typography variant="caption" color="text.secondary">
                        {' '}
                        / {channel.quotaCeiling}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{formatRate(channel.deliveryRate)}</TableCell>
                    <TableCell align="right">{formatRate(channel.optOutRate)}</TableCell>
                    <TableCell>
                      <StatusChip status={channel.assessment} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="Nenhum canal cadastrado"
              description="Um canal é um chip de WhatsApp. Sem pelo menos um pareado, nada sai."
              action={
                <Button variant="contained" onClick={() => router.push('/channels')}>
                  Cadastrar canal
                </Button>
              }
            />
          )}
        </Card>
      </Box>

      <Box component="section" aria-label="Distribuições em andamento">
        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
          Distribuições em andamento
        </Typography>
        <Card variant="outlined">
          {running.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Conteúdo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Janela</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {running.map((distribution) => (
                  <TableRow key={distribution.id} hover>
                    <TableCell>{distribution.contentTitle}</TableCell>
                    <TableCell>
                      <StatusChip status={distribution.status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        até {new Date(distribution.windowEnd).toLocaleString('pt-BR')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => router.push(`/distributions/${distribution.id}`)}
                      >
                        Acompanhar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="Nenhuma distribuição em andamento"
              action={
                <Button variant="contained" onClick={() => router.push('/distributions')}>
                  Planejar distribuição
                </Button>
              }
            />
          )}
        </Card>
      </Box>

      {health && health.inboundPerDay.length > 0 ? (
        <Box component="section" aria-label="Volume de inbound" sx={{ mt: 4 }}>
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            Mensagens recebidas por dia
          </Typography>
          <Card variant="outlined">
            <CardContent>
              {/*
                A bar per day, drawn with LinearProgress instead of a chart library. It answers the only
                question this panel needs to answer — "is inbound growing?" — without a dependency.
              */}
              <Stack spacing={1}>
                {health.inboundPerDay.map((day) => {
                  const max = Math.max(...health.inboundPerDay.map((entry) => entry.count), 1);
                  return (
                    <Stack key={day.date} direction="row" spacing={2} alignItems="center">
                      <Typography variant="caption" sx={{ width: 90 }}>
                        {day.date}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(day.count / max) * 100}
                        sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
                      />
                      <Typography variant="caption" sx={{ width: 40, textAlign: 'right' }}>
                        {day.count}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      ) : null}
    </Box>
  );
}
