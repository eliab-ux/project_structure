'use client';

import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  ErrorState,
  Loading,
  PageHeader,
  StatusChip,
  formatDateTime,
  formatRate,
} from 'src/components/common/common';
import { apiErrorMessage } from 'src/services/api';
import { auditService } from 'src/services/services';
import type { AuditLogEntry, HealthPanel, Paginated } from 'src/types/api';

/**
 * Audit and reports (FASE 10, screen 11).
 *
 * The health panel comes FIRST and the trail second, because the panel is what someone acts on today while
 * the trail is what they consult when a question arrives. The panel shows each throttle decision WITH its
 * reason (§11 item 3) — a quota that fell without an explanation is indistinguishable from a bug.
 */
export default function AuditPage() {
  const [health, setHealth] = useState<HealthPanel | null>(null);
  const [logs, setLogs] = useState<Paginated<AuditLogEntry> | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [windowDays, setWindowDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthData, logsData, actionList] = await Promise.all([
        auditService.health(windowDays),
        auditService.logs({
          page: pageIndex + 1,
          limit: 25,
          action: actionFilter || undefined,
        }),
        auditService.actions(),
      ]);
      setHealth(healthData);
      setLogs(logsData);
      setActions(actionList);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar a auditoria.'));
    } finally {
      setLoading(false);
    }
  }, [pageIndex, actionFilter, windowDays]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !health) {
    return <Loading label="Carregando auditoria" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <Box>
      <PageHeader
        title="Auditoria e saúde"
        description="Sinais de cada canal com a decisão do throttle e o motivo, e a trilha completa de quem fez o quê. A trilha é append-only: nada aqui é editado ou apagado."
        actions={
          <TextField
            select
            size="small"
            label="Janela"
            value={windowDays}
            onChange={(event) => setWindowDays(Number(event.target.value))}
          >
            <MenuItem value={7}>7 dias</MenuItem>
            <MenuItem value={14}>14 dias</MenuItem>
            <MenuItem value={30}>30 dias</MenuItem>
            <MenuItem value={90}>90 dias</MenuItem>
          </TextField>
        }
      />

      {health ? (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="overline" color="text.secondary">
                  Alcance por dia
                </Typography>
                <Typography variant="h5" component="p">
                  {health.dailyCapacity}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="overline" color="text.secondary">
                  Dias p/ cobrir a base
                </Typography>
                <Typography variant="h5" component="p">
                  {health.daysToCoverBase ?? '—'}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="overline" color="text.secondary">
                  Opt-outs na janela
                </Typography>
                <Typography variant="h5" component="p">
                  {health.optOutsInWindow}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="overline" color="text.secondary">
                  Base roteável
                </Typography>
                <Typography variant="h5" component="p">
                  {health.contactsRoutable}
                </Typography>
              </Card>
            </Grid>
          </Grid>

          <Card variant="outlined" sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Saúde dos canais
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Canal</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Cota</TableCell>
                    {/* The denominator of every rate to its right. Without it "0% de entrega" reads as a
                        catastrophe whether it is 0 of 400 or 0 of 3. */}
                    <TableCell align="right">Envios</TableCell>
                    <TableCell align="right">Entrega</TableCell>
                    <TableCell align="right">Resposta</TableCell>
                    <TableCell align="right">Opt-out</TableCell>
                    <TableCell align="right">Falhas</TableCell>
                    <TableCell>Última decisão</TableCell>
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
                          ({channel.quotaFloor}–{channel.quotaCeiling})
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{channel.sentCount}</TableCell>
                      <TableCell align="right">{formatRate(channel.deliveryRate)}</TableCell>
                      <TableCell align="right">{formatRate(channel.inboundRate)}</TableCell>
                      <TableCell align="right">{formatRate(channel.optOutRate)}</TableCell>
                      <TableCell align="right">{formatRate(channel.failureRate)}</TableCell>
                      <TableCell>
                        {channel.lastDecision ? (
                          <>
                            <Typography variant="caption" component="p">
                              <strong>{channel.lastDecision.decision}</strong> em{' '}
                              {channel.lastDecision.date}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {channel.lastDecision.reason}
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            sem revisão ainda
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={channel.assessment} />
                        <Typography variant="caption" component="p" color="text.secondary">
                          {channel.assessmentReason}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {health.inboundPerDay.length > 0 ? (
            <Card variant="outlined" sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" component="h3" gutterBottom>
                  Inbound por dia
                </Typography>
                <Stack spacing={1}>
                  {health.inboundPerDay.map((day) => {
                    const max = Math.max(...health.inboundPerDay.map((entry) => entry.count), 1);
                    return (
                      <Stack key={day.date} direction="row" spacing={2} alignItems="center">
                        <Typography variant="caption" sx={{ width: 92 }}>
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
          ) : null}
        </>
      ) : null}

      <Box component="section" aria-label="Trilha de auditoria">
        <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
          <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
            Trilha
          </Typography>
          <TextField
            select
            size="small"
            label="Ação"
            value={actionFilter}
            onChange={(event) => {
              setActionFilter(event.target.value);
              setPageIndex(0);
            }}
            sx={{ minWidth: 260 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {actions.map((action) => (
              <MenuItem key={action} value={action}>
                {action.replace(/_/g, ' ')}
              </MenuItem>
            ))}
          </TextField>
          <Button onClick={load}>Atualizar</Button>
        </Stack>

        <Card variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Quando</TableCell>
                <TableCell>Ação</TableCell>
                <TableCell>Ator</TableCell>
                <TableCell>Entidade</TableCell>
                <TableCell>Detalhes</TableCell>
                <TableCell>IP</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs?.data.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell>
                    <Typography variant="caption">{formatDateTime(entry.createdAt)}</Typography>
                  </TableCell>
                  <TableCell>{entry.action.replace(/_/g, ' ')}</TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {entry.actorType === 'SYSTEM' ? 'sistema' : entry.actorType.toLowerCase()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{entry.entityType ?? '—'}</Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 420 }}>
                    <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>
                      {/*
                        The payload is shown raw. It was sanitised when written (§1.6), so there is nothing
                        to hide here — and abbreviating it would remove exactly the detail someone opened
                        this screen to find.
                      */}
                      {JSON.stringify(entry.payload)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{entry.ip ?? '—'}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {logs ? (
            <TablePagination
              component="div"
              count={logs.meta.total}
              page={pageIndex}
              rowsPerPage={logs.meta.limit}
              rowsPerPageOptions={[logs.meta.limit]}
              onPageChange={(_event, next) => setPageIndex(next)}
              labelRowsPerPage="Por página"
            />
          ) : null}
        </Card>
      </Box>
    </Box>
  );
}
