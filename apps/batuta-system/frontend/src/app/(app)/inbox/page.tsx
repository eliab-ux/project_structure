'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import BoltIcon from '@mui/icons-material/Bolt';
import SendIcon from '@mui/icons-material/Send';
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  StatusChip,
  formatAge,
  formatDateTime,
} from 'src/components/common/common';
import { apiErrorMessage } from 'src/services/api';
import { inboxService } from 'src/services/services';
import type {
  ConversationDetail,
  ConversationSummary,
  InboxCounters,
  QuickReply,
} from 'src/types/api';

/**
 * The inbox (FASE 10, screen 10).
 *
 * Shaped as a WORK QUEUE and not as WhatsApp Web, which §10.1 is explicit about: the operator opens, sees
 * the next pending item, answers, and it leaves the list. Three consequences visible in this file:
 *
 *  - the list is ordered by the API (priority, then oldest first) and this screen never re-sorts it;
 *  - the AGE is shown on every row, because §10.3 says an item sitting for three days is worse than not
 *    having the queue at all;
 *  - opening an item takes the LOCK, so two operators never answer the same person. When someone else
 *    holds it, the API refuses and the message says so.
 *
 * The chip that will carry the reply is shown but not selectable — §10.4: the reply leaves through the
 * number the contact already knows, and the operator does not choose it.
 */
export default function InboxPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [counters, setCounters] = useState<InboxCounters | null>(null);
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [reply, setReply] = useState('');
  const [usedQuickReply, setUsedQuickReply] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('PENDING_REPLY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [queue, countersData, replies] = await Promise.all([
        inboxService.queue({ limit: 50, status: statusFilter || undefined }),
        inboxService.counters(),
        inboxService.quickReplies(),
      ]);
      setItems(queue.data);
      setCounters(countersData);
      setQuickReplies(replies);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar a caixa de entrada.'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function openItem(summary: ConversationSummary) {
    try {
      const detail = await inboxService.open(summary.id);
      setSelected(detail);
      setReply('');
      setUsedQuickReply(null);
    } catch (caught) {
      // The most common cause is someone else holding the lock; the API says exactly that.
      enqueueSnackbar(apiErrorMessage(caught, 'Não foi possível abrir esta conversa.'), {
        variant: 'warning',
      });
      await load();
    }
  }

  async function send(resolve: boolean) {
    if (!selected || reply.trim().length === 0) {
      return;
    }
    setSending(true);
    try {
      await inboxService.reply(selected.id, {
        body: reply,
        quickReplyId: usedQuickReply,
        resolve,
      });
      enqueueSnackbar(resolve ? 'Respondido e resolvido.' : 'Resposta enviada.', {
        variant: 'success',
      });
      setSelected(null);
      setReply('');
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error', autoHideDuration: 8000 });
    } finally {
      setSending(false);
    }
  }

  async function act(action: 'RESOLVE' | 'ARCHIVE' | 'RELEASE') {
    if (!selected) {
      return;
    }
    try {
      await inboxService.action(selected.id, action);
      enqueueSnackbar(
        action === 'RELEASE' ? 'Item devolvido para a fila.' : 'Conversa atualizada.',
        { variant: 'success' },
      );
      setSelected(null);
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  if (loading && items.length === 0) {
    return <Loading label="Carregando fila" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <Box>
      <PageHeader
        title="Caixa de entrada"
        description="Fila de trabalho: prioridade primeiro, depois o item mais antigo. Cada conversa é UM item, com todas as mensagens daquela pessoa dentro."
        actions={<Button onClick={load}>Atualizar</Button>}
      />

      {counters ? (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Chip label={`${counters.pendingReply} aguardando`} color="warning" />
          <Chip label={`${counters.inProgress} em atendimento`} color="info" />
          {counters.highPriority > 0 ? (
            <Chip label={`${counters.highPriority} urgente(s)`} color="error" />
          ) : null}
          <Chip variant="outlined" label={`idade média ${formatAge(counters.averageAgeMinutes)}`} />
          <Chip variant="outlined" label={`mais antigo ${formatAge(counters.oldestAgeMinutes)}`} />
        </Stack>
      ) : null}

      <TextField
        select
        size="small"
        label="Mostrar"
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
        sx={{ mb: 2, minWidth: 220 }}
      >
        <MenuItem value="PENDING_REPLY">Aguardando resposta</MenuItem>
        <MenuItem value="IN_PROGRESS">Em atendimento</MenuItem>
        <MenuItem value="RESOLVED">Resolvidas</MenuItem>
        <MenuItem value="ARCHIVED">Arquivadas (sem resposta)</MenuItem>
        <MenuItem value="">Todas</MenuItem>
      </TextField>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card variant="outlined">
            {items.length === 0 ? (
              <EmptyState
                title="Fila vazia"
                description="Nada aguardando resposta. Mensagens de agradecimento e pedidos de saída se resolvem sozinhos e não chegam aqui."
              />
            ) : (
              <List disablePadding>
                {items.map((item) => (
                  <ListItemButton
                    key={item.id}
                    selected={selected?.id === item.id}
                    onClick={() => openItem(item)}
                    divider
                    disabled={item.locked && selected?.id !== item.id}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Badge badgeContent={item.unreadCount} color="primary" max={9}>
                            <Typography variant="body2" sx={{ pr: 1 }}>
                              {item.contactName ?? item.contactPhoneMasked}
                            </Typography>
                          </Badge>
                          {item.priority === 'HIGH' ? (
                            <Chip size="small" color="error" label="urgente" />
                          ) : null}
                          {item.locked ? <Chip size="small" label="em atendimento" /> : null}
                        </Stack>
                      }
                      secondary={
                        <>
                          <Typography variant="caption" color="text.secondary" component="span">
                            {formatAge(item.ageMinutes)} esperando
                            {item.intentClass
                              ? ` · ${item.intentClass.replace(/_/g, ' ').toLowerCase()}`
                              : ''}
                          </Typography>
                          <Typography
                            variant="body2"
                            component="span"
                            sx={{ display: 'block' }}
                            noWrap
                          >
                            {item.lastMessagePreview ??
                              (item.lastMessageKind === 'AUDIO' ? '🎤 áudio' : 'mídia recebida')}
                          </Typography>
                        </>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          {selected ? (
            <Card variant="outlined">
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  sx={{ mb: 1 }}
                >
                  <Box>
                    <Typography variant="h6" component="h3">
                      {selected.contactName ?? selected.contactPhoneMasked}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selected.contactPhoneMasked} · recebido por {selected.channelLabel} ·{' '}
                      {formatAge(selected.ageMinutes)} esperando
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <StatusChip status={selected.status} />
                    {selected.priority === 'HIGH' ? (
                      <Chip size="small" color="error" label="urgente" />
                    ) : null}
                  </Stack>
                </Stack>

                {selected.contactTags.length > 0 ? (
                  <Stack direction="row" spacing={0.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                    {selected.contactTags.map((tag) => (
                      <Chip key={tag} size="small" label={tag} variant="outlined" />
                    ))}
                  </Stack>
                ) : null}

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    maxHeight: 380,
                    overflowY: 'auto',
                    bgcolor: 'background.default',
                    mb: 2,
                  }}
                >
                  <Stack spacing={1.5}>
                    {selected.messages.map((message) => (
                      <Box
                        key={message.id}
                        sx={{
                          alignSelf: message.direction === 'INBOUND' ? 'flex-start' : 'flex-end',
                          maxWidth: '85%',
                          bgcolor:
                            message.direction === 'INBOUND' ? 'background.paper' : 'primary.main',
                          color:
                            message.direction === 'INBOUND'
                              ? 'text.primary'
                              : 'primary.contrastText',
                          p: 1.5,
                          borderRadius: 2,
                          border: 1,
                          borderColor: 'divider',
                        }}
                      >
                        {message.body ? (
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {message.body}
                          </Typography>
                        ) : null}

                        {/* Audio inline is a v1 requirement (§10.2 item 3): much Brazilian inbound is voice. */}
                        {message.kind === 'AUDIO' && message.mediaUrl ? (
                          <audio
                            controls
                            src={message.mediaUrl}
                            style={{ width: '100%', marginTop: 4 }}
                          >
                            Seu navegador não suporta áudio.
                          </audio>
                        ) : null}
                        {message.kind === 'IMAGE' && message.mediaUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- signed URL from the API
                          <img
                            src={message.mediaUrl}
                            alt="Imagem recebida"
                            style={{ maxWidth: '100%', marginTop: 4, borderRadius: 4 }}
                          />
                        ) : null}
                        {message.kind !== 'TEXT' && !message.mediaUrl ? (
                          <Typography variant="caption">
                            {message.kind.toLowerCase()} recebido — o arquivo não pôde ser baixado
                          </Typography>
                        ) : null}

                        <Typography
                          variant="caption"
                          sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}
                        >
                          {formatDateTime(message.occurredAt)}
                          {message.fromDistribution ? ' · da campanha' : ''}
                          {message.sentBy ? ' · resposta do operador' : ''}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>

                {quickReplies.length > 0 ? (
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                    {quickReplies.slice(0, 6).map((quick) => (
                      <Chip
                        key={quick.id}
                        icon={<BoltIcon />}
                        label={quick.title}
                        onClick={() => {
                          // Inserted for the operator to EDIT, never sent as-is: §2 forbids automatic replies.
                          setReply(quick.body);
                          setUsedQuickReply(quick.id);
                        }}
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                ) : null}

                <TextField
                  label="Resposta"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  helperText={`Sai por ${selected.channelLabel} — o mesmo número que falou com esta pessoa.`}
                />

                <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained"
                    startIcon={<SendIcon />}
                    onClick={() => send(true)}
                    disabled={sending || reply.trim().length === 0}
                  >
                    Responder e resolver
                  </Button>
                  <Button
                    onClick={() => send(false)}
                    disabled={sending || reply.trim().length === 0}
                  >
                    Só responder
                  </Button>
                  <Button onClick={() => act('RESOLVE')}>Resolver sem responder</Button>
                  <Button onClick={() => act('ARCHIVE')}>Arquivar</Button>
                  <Button onClick={() => act('RELEASE')}>Devolver para a fila</Button>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <Card variant="outlined">
              <EmptyState
                title="Escolha um item da fila"
                description="Ao abrir, o item fica travado para você por alguns minutos, para que ninguém responda a mesma pessoa duas vezes."
              />
            </Card>
          )}

          <Alert severity="info" sx={{ mt: 2 }}>
            Responder não é cortesia: a proporção entre falar e ouvir é um dos sinais que o sistema
            usa para decidir a cota de cada chip. Número que só fala e nunca ouve é o perfil que
            cai.
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
}
