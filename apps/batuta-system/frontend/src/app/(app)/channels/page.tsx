'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import SyncIcon from '@mui/icons-material/Sync';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  StatusChip,
  formatDateTime,
} from 'src/components/common/common';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import { channelService } from 'src/services/services';
import type { Channel, QrCode, WebhookDiagnosis } from 'src/types/api';

const channelSchema = yup.object({
  label: yup.string().min(2, 'Mínimo 2 caracteres').required('Nome obrigatório'),
  phone: yup
    .string()
    .matches(/^\+[1-9]\d{7,14}$/, 'Use E.164, ex.: +5511999998888')
    .required('Telefone obrigatório'),
  quotaFloor: yup.number().min(1).max(1000).required(),
  quotaCeiling: yup.number().min(1).max(1000).required(),
});

type ChannelForm = yup.InferType<typeof channelSchema>;

type TerminalAction = { channel: Channel; kind: 'BAN' | 'RETIRE' } | null;

/**
 * Channels (FASE 10, screen 3): state, QR pairing, quota band and history, retiring.
 *
 * Two things this screen refuses to do, both by design:
 *
 *  1. **There is no field for `current_quota`.** The throttle owns that number (§2.1) — the operator sets
 *     the floor and the ceiling, and the daily review moves the value inside them. A field here would let
 *     someone undo a protective cut with a click.
 *  2. **BANNED and RETIRED ask you to type the word.** They are terminal and human-only (§4), and a
 *     mis-click costs a chip that has to be replaced and re-warmed.
 */
export default function ChannelsPage() {
  const { isAdmin } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [qr, setQr] = useState<{ channel: Channel; code: QrCode } | null>(null);
  const [band, setBand] = useState<Channel | null>(null);
  const [terminal, setTerminal] = useState<TerminalAction>(null);
  const [diagnosisFor, setDiagnosisFor] = useState<Channel | null>(null);
  const [diagnosis, setDiagnosis] = useState<WebhookDiagnosis | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  const form = useForm<ChannelForm>({
    resolver: yupResolver(channelSchema),
    defaultValues: { quotaFloor: 20, quotaCeiling: 150 },
  });

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

  async function onCreate(values: ChannelForm) {
    try {
      const channel = await channelService.create(values);
      enqueueSnackbar('Canal criado. Pareie o número lendo o QR code.', { variant: 'success' });
      setCreating(false);
      form.reset({ quotaFloor: 20, quotaCeiling: 150 });
      await load();
      await openQr(channel);
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  async function openQr(channel: Channel) {
    try {
      setQr({ channel, code: await channelService.qrCode(channel.id) });
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught, 'Não foi possível obter o QR code.'), {
        variant: 'error',
      });
    }
  }

  /**
   * Abre o diagnóstico do webhook — leitura primeiro, sem consertar nada.
   *
   * Ler antes de consertar é o ponto: um diálogo que reparasse silenciosamente o que foi aberto para
   * inspecionar nunca deixaria ninguém VER o defeito, e é justamente o defeito que precisa aparecer.
   */
  async function openDiagnosis(channel: Channel) {
    setDiagnosisFor(channel);
    setDiagnosis(null);
    setDiagnosing(true);
    try {
      setDiagnosis(await channelService.webhookDiagnosis(channel.id));
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught, 'Não foi possível consultar o webhook.'), {
        variant: 'error',
      });
    } finally {
      setDiagnosing(false);
    }
  }

  async function reconfigureWebhook() {
    if (!diagnosisFor) {
      return;
    }
    setDiagnosing(true);
    try {
      const result = await channelService.webhookDiagnosis(diagnosisFor.id, true);
      setDiagnosis(result);
      enqueueSnackbar(
        result.problem === null
          ? 'Webhook reconfigurado e funcionando.'
          : 'Reconfigurado, mas ainda há um problema — veja o detalhe.',
        { variant: result.problem === null ? 'success' : 'warning' },
      );
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught, 'Não foi possível reconfigurar o webhook.'), {
        variant: 'error',
      });
    } finally {
      setDiagnosing(false);
    }
  }

  async function syncState(channel: Channel) {
    try {
      await channelService.syncState(channel.id);
      enqueueSnackbar('Estado reconciliado com o servidor.', { variant: 'success' });
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  async function reinstate(channel: Channel) {
    try {
      await channelService.reinstate(channel.id);
      // Back as DISCONNECTED, not CONNECTED: the real state is whatever the instance reports next.
      enqueueSnackbar('Canal reativado. Ele volta como DISCONNECTED até reconectar.', {
        variant: 'success',
      });
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  async function confirmTerminal(reason: string) {
    if (!terminal) {
      return;
    }
    try {
      if (terminal.kind === 'BAN') {
        await channelService.markBanned(
          terminal.channel.id,
          reason || 'Declarado banido pelo operador',
        );
      } else {
        await channelService.retire(terminal.channel.id, reason || 'Aposentado pelo operador');
      }
      enqueueSnackbar(
        'Estado terminal registrado. Os contatos deste canal podem ser migrados na tela de Migração.',
        { variant: 'success' },
      );
      setTerminal(null);
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  async function saveBand(floor: number, ceiling: number) {
    if (!band) {
      return;
    }
    try {
      await channelService.changeQuotaBand(band.id, floor, ceiling);
      enqueueSnackbar('Faixa de cota atualizada.', { variant: 'success' });
      setBand(null);
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
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
        title="Canais"
        description="Cada canal é um chip de WhatsApp. A cota do dia é ajustada automaticamente dentro da faixa que você define — o piso e o teto são seus, o valor corrente é do sistema."
        actions={
          isAdmin ? (
            <Button variant="contained" onClick={() => setCreating(true)}>
              Novo canal
            </Button>
          ) : undefined
        }
      />

      <Card variant="outlined">
        {channels.length === 0 ? (
          <EmptyState
            title="Nenhum canal cadastrado"
            description="Sem um chip pareado, nenhuma mensagem pode sair."
            action={
              isAdmin ? (
                <Button variant="contained" onClick={() => setCreating(true)}>
                  Cadastrar o primeiro
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Canal</TableCell>
                <TableCell>Número</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Cota</TableCell>
                <TableCell align="right">Falhas</TableCell>
                <TableCell>Último envio</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {channels.map((channel) => (
                <TableRow key={channel.id} hover>
                  <TableCell>{channel.label}</TableCell>
                  <TableCell>{channel.phoneMasked}</TableCell>
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
                  <TableCell align="right">{channel.consecutiveFailures}</TableCell>
                  <TableCell>
                    <Typography variant="caption">{formatDateTime(channel.lastSendAt)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={0.5}
                      justifyContent="flex-end"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {['AWAITING_QR', 'DISCONNECTED', 'PROVISIONING'].includes(channel.status) ? (
                        <Button
                          size="small"
                          startIcon={<QrCode2Icon />}
                          onClick={() => openQr(channel)}
                        >
                          QR
                        </Button>
                      ) : null}
                      <Button
                        size="small"
                        startIcon={<SyncIcon />}
                        onClick={() => syncState(channel)}
                      >
                        Sincronizar
                      </Button>
                      {isAdmin ? (
                        <Button size="small" onClick={() => openDiagnosis(channel)}>
                          Webhook
                        </Button>
                      ) : null}
                      {isAdmin ? (
                        <Button size="small" onClick={() => setBand(channel)}>
                          Faixa
                        </Button>
                      ) : null}
                      {isAdmin && channel.status === 'DEGRADED' ? (
                        <Button size="small" color="success" onClick={() => reinstate(channel)}>
                          Reativar
                        </Button>
                      ) : null}
                      {isAdmin && !['BANNED', 'RETIRED'].includes(channel.status) ? (
                        <>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => setTerminal({ channel, kind: 'BAN' })}
                          >
                            Banido
                          </Button>
                          <Button
                            size="small"
                            onClick={() => setTerminal({ channel, kind: 'RETIRE' })}
                          >
                            Aposentar
                          </Button>
                        </>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ---- new channel ---- */}
      <Dialog open={creating} onClose={() => setCreating(false)} fullWidth maxWidth="sm">
        <DialogTitle>Novo canal</DialogTitle>
        <Box component="form" onSubmit={form.handleSubmit(onCreate)} noValidate>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Nome do canal"
                placeholder="Chip Principal"
                fullWidth
                {...form.register('label')}
                error={Boolean(form.formState.errors.label)}
                helperText={form.formState.errors.label?.message}
              />
              <TextField
                label="Telefone (E.164)"
                placeholder="+5511999998888"
                fullWidth
                {...form.register('phone')}
                error={Boolean(form.formState.errors.phone)}
                helperText={form.formState.errors.phone?.message}
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Piso da cota"
                  type="number"
                  fullWidth
                  {...form.register('quotaFloor')}
                  error={Boolean(form.formState.errors.quotaFloor)}
                  helperText={form.formState.errors.quotaFloor?.message ?? 'Onde o chip começa'}
                />
                <TextField
                  label="Teto da cota"
                  type="number"
                  fullWidth
                  {...form.register('quotaCeiling')}
                  error={Boolean(form.formState.errors.quotaCeiling)}
                  helperText={
                    form.formState.errors.quotaCeiling?.message ?? 'Máximo que pode alcançar'
                  }
                />
              </Stack>
              <Alert severity="info">
                O canal começa no piso e sobe sozinho, só com sinais limpos. Um número novo que
                dispara no teto é o perfil que cai.
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreating(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">
              Criar e parear
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ---- QR ---- */}
      <Dialog open={Boolean(qr)} onClose={() => setQr(null)} fullWidth maxWidth="xs">
        <DialogTitle>Parear {qr?.channel.label}</DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          {qr ? (
            <Stack spacing={2} alignItems="center">
              {qr.code.qrCodeBase64 ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI da API, sem loader */}
                  <img
                    src={qr.code.qrCodeBase64}
                    alt="QR code para pareamento"
                    style={{ width: '100%', maxWidth: 260 }}
                  />
                </>
              ) : (
                // Vazio significa duas coisas opostas — provisionando ou já conectado — e o status
                // desempata. Renderizar um <img> com src vazio mostraria um ícone de imagem quebrada.
                <Alert severity="info" role="status">
                  {qr.code.status === 'CONNECTED'
                    ? 'Este canal já está conectado. Não há QR para ler.'
                    : 'Gerando o QR code… feche e abra de novo em alguns segundos.'}
                </Alert>
              )}
              {qr.code.pairingCode ? (
                <Typography variant="body2">
                  Ou use o código: <strong>{qr.code.pairingCode}</strong>
                </Typography>
              ) : null}
              <Typography variant="caption" color="text.secondary">
                No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. O QR expira em
                poucos minutos; feche e abra de novo para gerar outro.
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQr(null)}>Fechar</Button>
          <Button
            onClick={async () => {
              if (qr) {
                await syncState(qr.channel);
                setQr(null);
              }
            }}
            variant="contained"
          >
            Já pareei
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- quota band ---- */}
      <BandDialog channel={band} onClose={() => setBand(null)} onSave={saveBand} />

      {/* ---- terminal states ---- */}
      <ConfirmDialog
        open={Boolean(terminal)}
        title={terminal?.kind === 'BAN' ? 'Declarar canal banido' : 'Aposentar canal'}
        description={
          terminal?.kind === 'BAN'
            ? `"${terminal?.channel.label}" será marcado como BANIDO. É um estado terminal e irreversível: o chip não envia mais nada, e os contatos dele precisam ser migrados para outro número.`
            : `"${terminal?.channel.label}" será APOSENTADO. É um estado terminal: use quando o número sai de operação por decisão sua.`
        }
        confirmationWord={terminal?.kind === 'BAN' ? 'BANIDO' : 'APOSENTAR'}
        confirmLabel={terminal?.kind === 'BAN' ? 'Declarar banido' : 'Aposentar'}
        destructive
        onCancel={() => setTerminal(null)}
        onConfirm={confirmTerminal}
      />

      {/* ---- diagnóstico do webhook ---- */}
      <Dialog
        open={Boolean(diagnosisFor)}
        onClose={() => setDiagnosisFor(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Webhook de {diagnosisFor?.label}</DialogTitle>
        <DialogContent>
          {diagnosing && !diagnosis ? <Loading /> : null}
          {diagnosis ? (
            <Stack spacing={2}>
              {/*
                Um problema por vez, e não uma lista: as causas são sequenciais — um webhook que não
                existe não pode também estar sem um evento — e cinco reclamações para uma causa só
                leem como cinco defeitos.
              */}
              {diagnosis.problem ? (
                <Alert severity="error" role="alert">
                  {diagnosis.problem}
                </Alert>
              ) : (
                <Alert severity="success">
                  Webhook ativo e completo, e {diagnosis.inboundCount} resposta(s) já foram gravadas
                  neste canal. A cadeia inteira está funcionando.
                </Alert>
              )}

              {/*
                A configuração na Evolution é só a primeira metade. Os dois últimos itens são os elos
                DEPOIS do POST, e existem porque "tudo verde e inbox vazio" foi um estado real: a
                atribuição da instância a uma conta e a chegada efetiva de alguma resposta.
              */}
              <Stack spacing={0.5}>
                {[
                  { label: 'Configurado na Evolution', ok: diagnosis.configured },
                  { label: 'Habilitado', ok: diagnosis.enabled },
                  { label: 'Envia o cabeçalho de autenticação', ok: diagnosis.hasAuthHeader },
                  { label: 'Recebe respostas (MESSAGES_UPSERT)', ok: diagnosis.receivesInbound },
                  { label: 'Recebe recibos (MESSAGES_UPDATE)', ok: diagnosis.receivesAcks },
                  {
                    label: 'Instância atribuível a esta conta',
                    ok: diagnosis.instanceNameAttributable,
                  },
                  { label: 'Alguma resposta já chegou', ok: diagnosis.inboundCount > 0 },
                ].map((check) => (
                  <Typography key={check.label} variant="body2">
                    {check.ok ? '✔' : '✘'} {check.label}
                  </Typography>
                ))}
              </Stack>

              <Box>
                <Typography variant="overline" color="text.secondary" component="p">
                  Respostas recebidas
                </Typography>
                <Typography variant="body2">
                  {diagnosis.inboundCount === 0
                    ? 'nenhuma até agora'
                    : `${diagnosis.inboundCount}, a última em ${formatDateTime(diagnosis.lastInboundAt)}`}
                </Typography>
                {/*
                  Só aparece quando há suspeita: um número de 12 dígitos pode ser fixo legítimo, então
                  isto é informação para um humano ler, nunca uma regra que o sistema aplica sozinho.
                */}
                {diagnosis.contactsWithoutNinthDigit > 0 ? (
                  <Typography variant="caption" color="warning.main" component="p">
                    {diagnosis.contactsWithoutNinthDigit} de {diagnosis.contactsTotal} contato(s)
                    deste canal estão sem o nono dígito — nesses, o envio funciona e só a resposta
                    não volta.
                  </Typography>
                ) : null}
                {diagnosis.invalidTokenRejections > 0 ? (
                  <Typography variant="caption" color="error.main" component="p">
                    {diagnosis.invalidTokenRejections} chamada(s) recusadas por token inválido desde
                    o último restart do backend, a última em{' '}
                    {formatDateTime(diagnosis.lastInvalidTokenAt)}. A Evolution está chamando; o
                    valor do token é que não bate.
                  </Typography>
                ) : null}
              </Box>

              <Box>
                <Typography variant="overline" color="text.secondary" component="p">
                  Instância
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {diagnosis.instanceName}
                </Typography>
              </Box>

              <Box>
                <Typography variant="overline" color="text.secondary" component="p">
                  URL configurada
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {diagnosis.url ?? '— nenhuma —'}
                </Typography>
              </Box>

              {diagnosis.events.length > 0 ? (
                <Box>
                  <Typography variant="overline" color="text.secondary" component="p">
                    Eventos assinados
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {diagnosis.events.map((event: string) => (
                      <Chip key={event} size="small" label={event} />
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiagnosisFor(null)}>Fechar</Button>
          <Button variant="contained" onClick={reconfigureWebhook} disabled={diagnosing}>
            Reconfigurar webhook
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Separate component so the two numbers can have local state without re-rendering the table. */
function BandDialog({
  channel,
  onClose,
  onSave,
}: {
  channel: Channel | null;
  onClose: () => void;
  onSave: (floor: number, ceiling: number) => void;
}) {
  const [floor, setFloor] = useState(20);
  const [ceiling, setCeiling] = useState(150);

  useEffect(() => {
    if (channel) {
      setFloor(channel.quotaFloor);
      setCeiling(channel.quotaCeiling);
    }
  }, [channel]);

  return (
    <Dialog open={Boolean(channel)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Faixa de cota — {channel?.label}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Piso"
            type="number"
            value={floor}
            onChange={(event) => setFloor(Number(event.target.value))}
            fullWidth
          />
          <TextField
            label="Teto"
            type="number"
            value={ceiling}
            onChange={(event) => setCeiling(Number(event.target.value))}
            fullWidth
          />
          <Alert severity="info">
            A cota corrente ({channel?.currentQuota}) não é editável aqui: ela é recalculada todo
            dia a partir dos sinais do canal. Baixar o teto tem efeito imediato; subir não dá ao
            chip um salto que ele não conquistou.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={() => onSave(floor, ceiling)}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
