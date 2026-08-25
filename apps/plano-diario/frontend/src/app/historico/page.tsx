'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { AppShell } from 'src/components/AppShell/AppShell';
import { StatusChip } from 'src/components/StatusChip/StatusChip';
import dispatchService from 'src/services/dispatchService';
import { DispatchLog } from 'src/types';

/** `2026-07-28` → `28/07/2026`. */
function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Hora local do navegador — o registro vem em UTC. */
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoricoPage() {
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dispatchService
      .history(page + 1, limit)
      .then((result) => {
        setLogs(result.data);
        setTotal(result.meta.total);
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [page, limit]);

  return (
    <AppShell>
      <Typography component="h1" variant="h2" gutterBottom>
        Histórico
      </Typography>

      {loading ? (
        <Box
          role="status"
          aria-label="Carregando"
          sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
        >
          <CircularProgress />
        </Box>
      ) : logs.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Nenhum envio registrado ainda.
          </Typography>
        </Card>
      ) : (
        <Card component="section">
          {/* overflow-x próprio: a tabela rola sozinha e a página nunca rola de lado. */}
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Data da leitura</TableCell>
                  <TableCell>Enviado às</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Dia</TableCell>
                  <TableCell>Mensagem enviada</TableCell>
                  <TableCell>Origem</TableCell>
                  <TableCell>Observação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell sx={{ fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' }}>
                      {formatDate(log.referenceDate)}
                    </TableCell>
                    {/* Hora de quando o envio aconteceu (ou da tentativa, se falhou) — a data da
                        leitura sozinha não diz se o disparo saiu no horário configurado. */}
                    <TableCell
                      sx={{
                        fontFamily: 'ui-monospace, monospace',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatTime(log.sentAt ?? log.createdAt)}
                      {!log.sentAt && (
                        <Box
                          component="span"
                          sx={{ color: 'text.secondary', ml: 0.5, fontSize: '.8em' }}
                        >
                          tent.
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={log.status} />
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {log.dayNumber ?? '—'}
                    </TableCell>
                    {/* O texto EXATO que foi enviado, preservando as quebras de linha: é a
                        única forma de conferir o formato da mensagem sem depender do WhatsApp. */}
                    <TableCell>
                      {log.messageSent ? (
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '0.78rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxWidth: 260,
                          }}
                        >
                          {log.messageSent}
                        </Box>
                      ) : log.url ? (
                        <Link
                          href={log.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}
                        >
                          abrir
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {log.trigger === 'manual' ? 'Manual' : 'Automático'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        {log.errorReason && (
                          <Typography variant="body2" color="error.main">
                            {log.errorReason}
                          </Typography>
                        )}
                        {log.attempts > 1 && (
                          <Typography variant="caption" color="text.secondary">
                            {log.attempts} tentativas
                          </Typography>
                        )}
                        {!log.errorReason && log.attempts <= 1 && '—'}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={limit}
            onRowsPerPageChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[20, 50, 100]}
            labelRowsPerPage="Por página"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
          />
        </Card>
      )}
    </AppShell>
  );
}
