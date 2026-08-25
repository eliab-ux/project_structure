'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  ConfirmDialog,
  ErrorState,
  Loading,
  PageHeader,
  StatusChip,
} from 'src/components/common/common';
import { apiErrorMessage } from 'src/services/api';
import { channelService, migrationService } from 'src/services/services';
import type { Channel, MigrationPreview } from 'src/types/api';

/**
 * Sender migration (FASE 10, screen 5).
 *
 * The screen exists because §6.4 makes migration the ONLY exception to "um contato, um remetente" — and
 * hedges it with conditions this page has to enforce visibly:
 *
 *  - **Only a terminal channel can be migrated from.** `DISCONNECTED` is transient (a phone that is off, a
 *    QR that expired) and does NOT qualify: migrating on a temporary drop would move a base for nothing
 *    and burn the trust of contacts who suddenly hear from a new number.
 *  - **Preview before executing, always.** The preview says how many people move and where to.
 *  - **Typing the word to confirm.** This is thousands of contacts changing the number that talks to them.
 */
export default function MigrationsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromChannelId, setFromChannelId] = useState('');
  const [strategy, setStrategy] = useState<'ALL_TO_ONE' | 'REDISTRIBUTE'>('REDISTRIBUTE');
  const [toChannelId, setToChannelId] = useState('');
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setChannels(await channelService.list());
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar os canais.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Only terminal states qualify (§6.4). The list itself is the enforcement the operator sees.
  const migratable = channels.filter((channel) => ['BANNED', 'RETIRED'].includes(channel.status));
  const destinations = channels.filter((channel) => channel.status === 'CONNECTED');

  async function runPreview() {
    try {
      const result = await migrationService.preview({
        fromChannelId,
        strategy,
        toChannelId: strategy === 'ALL_TO_ONE' ? toChannelId : undefined,
      });
      setPreview(result);
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  async function execute() {
    try {
      await migrationService.execute({
        fromChannelId,
        strategy,
        toChannelId: strategy === 'ALL_TO_ONE' ? toChannelId : undefined,
        // Sem `confirmation`: a API roda com forbidNonWhitelisted, então campo a mais é 400. A palavra
        // digitada é fricção de interface, e o diálogo acima já a exigiu.
      });
      enqueueSnackbar(
        'Migração executada. O histórico de remetente foi gravado e as conversas abertas seguiram os contatos.',
        { variant: 'success' },
      );
      setConfirming(false);
      setPreview(null);
      setFromChannelId('');
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
      setConfirming(false);
    }
  }

  if (loading) {
    return <Loading label="Carregando canais" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <Box>
      <PageHeader
        title="Migração de remetente"
        description="Move os contatos de um chip terminal para outro. É a única exceção à regra de que um contato recebe sempre pelo mesmo número — e por isso exige um canal BANIDO ou APOSENTADO, prévia e confirmação."
      />

      <Alert severity="warning" sx={{ mb: 3 }}>
        Um canal <strong>DISCONNECTED</strong> não aparece aqui de propósito: desconexão é
        transitória (celular desligado, QR expirado). Migrar uma base por causa de uma queda
        temporária troca o número que fala com milhares de pessoas sem necessidade.
      </Alert>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              select
              label="Canal de origem (terminal)"
              value={fromChannelId}
              onChange={(event) => {
                setFromChannelId(event.target.value);
                setPreview(null);
              }}
              fullWidth
              helperText={
                migratable.length === 0
                  ? 'Nenhum canal em estado terminal. Nada a migrar — e isso é uma boa notícia.'
                  : 'Só canais BANIDO ou APOSENTADO podem ser migrados.'
              }
              disabled={migratable.length === 0}
            >
              {migratable.map((channel) => (
                <MenuItem key={channel.id} value={channel.id}>
                  {channel.label} ({channel.status}) — {channel.phoneMasked}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Estratégia"
              value={strategy}
              onChange={(event) => {
                setStrategy(event.target.value as 'ALL_TO_ONE' | 'REDISTRIBUTE');
                setPreview(null);
              }}
              fullWidth
            >
              <MenuItem value="REDISTRIBUTE">
                Redistribuir — equilibra entre os canais conectados
              </MenuItem>
              <MenuItem value="ALL_TO_ONE">Todos para um — escolho o canal de destino</MenuItem>
            </TextField>

            {strategy === 'ALL_TO_ONE' ? (
              <TextField
                select
                label="Canal de destino"
                value={toChannelId}
                onChange={(event) => {
                  setToChannelId(event.target.value);
                  setPreview(null);
                }}
                fullWidth
                helperText="Atenção à cota: concentrar uma base grande num chip só aumenta o risco dele."
              >
                {destinations.map((channel) => (
                  <MenuItem key={channel.id} value={channel.id}>
                    {channel.label} — cota {channel.currentQuota}/dia
                  </MenuItem>
                ))}
              </TextField>
            ) : null}

            <Box>
              <Button
                variant="outlined"
                onClick={runPreview}
                disabled={!fromChannelId || (strategy === 'ALL_TO_ONE' && !toChannelId)}
              >
                Ver prévia
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {preview ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h3" gutterBottom>
              Prévia da migração
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              <strong>{preview.contactsToMigrate}</strong> contato(s) de {preview.fromChannelLabel}{' '}
              vão passar a receber por outro número.
            </Typography>

            {preview.blockedReason ? (
              <Alert severity="warning" role="alert" sx={{ mb: 2 }}>
                {preview.blockedReason}
              </Alert>
            ) : null}

            {/* Antes e depois lado a lado: é o que mostra para onde os contatos vão, e é a diferença
                entre confiar na estratégia e conferi-la. */}
            <Table size="small" sx={{ mb: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Canal</TableCell>
                  <TableCell align="right">Antes</TableCell>
                  <TableCell align="right">Depois</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.loadsAfter.map((after) => {
                  const before = preview.loadsBefore.find(
                    (load) => load.channelId === after.channelId,
                  );
                  return (
                    <TableRow key={after.channelId}>
                      <TableCell>
                        {after.channelLabel} <StatusChip status={after.channelStatus} />
                      </TableCell>
                      <TableCell align="right">{before?.contacts ?? 0}</TableCell>
                      <TableCell align="right">
                        <strong>{after.contacts}</strong>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Button
              variant="contained"
              color="warning"
              onClick={() => setConfirming(true)}
              disabled={Boolean(preview.blockedReason) || preview.contactsToMigrate === 0}
            >
              Executar migração
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Box component="section" aria-label="Canais" sx={{ mt: 4 }}>
        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
          Estado dos canais
        </Typography>
        <Card variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Canal</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Cota</TableCell>
                <TableCell>Pode migrar?</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {channels.map((channel) => (
                <TableRow key={channel.id}>
                  <TableCell>{channel.label}</TableCell>
                  <TableCell>
                    <StatusChip status={channel.status} />
                  </TableCell>
                  <TableCell align="right">{channel.currentQuota}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {['BANNED', 'RETIRED'].includes(channel.status)
                        ? 'Sim — estado terminal'
                        : channel.status === 'DISCONNECTED'
                          ? 'Não — desconexão é transitória'
                          : 'Não — canal em operação'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Box>

      <ConfirmDialog
        open={confirming}
        title="Confirmar migração de remetente"
        description={`${preview?.contactsToMigrate ?? 0} contato(s) vão passar a receber por outro número. A mudança é registrada no histórico de cada contato, os envios pendentes do canal antigo são resolvidos e as conversas abertas seguem os contatos. Isto não se desfaz com um clique.`}
        confirmationWord="MIGRAR"
        confirmLabel="Migrar contatos"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={execute}
      />
    </Box>
  );
}
