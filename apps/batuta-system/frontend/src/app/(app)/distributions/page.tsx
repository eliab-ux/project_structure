'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
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
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  StatusChip,
  formatDateTime,
} from 'src/components/common/common';
import { apiErrorMessage } from 'src/services/api';
import { contactService, contentService, distributionService } from 'src/services/services';
import type {
  ContactTag,
  Content,
  Distribution,
  DistributionPreview,
  Paginated,
} from 'src/types/api';

function isoLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Distribution (FASE 10, screen 9): audience builder, window, preview, confirmation.
 *
 * The flow on this screen IS the requirement of §9.3 — "prévia obrigatória antes de confirmar". It runs in
 * three steps and the middle one persists the plan without queueing anything, so confirmation always acts
 * on something the operator has already seen. The confirm button sends back the `content_hash` from the
 * preview, which is what makes editing the content between the two a refusal rather than a surprise.
 */
export default function DistributionsPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [page, setPage] = useState<Paginated<Distribution> | null>(null);
  const [approved, setApproved] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, contents] = await Promise.all([
        distributionService.list({ limit: 20 }),
        contentService.list({ status: 'APPROVED', limit: 50 }),
      ]);
      setPage(list);
      setApproved(contents.data);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar as distribuições.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !page) {
    return <Loading label="Carregando distribuições" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <Box>
      <PageHeader
        title="Distribuição"
        description="Planeja o envio de um conteúdo aprovado para um público, dentro de uma janela. O sistema espalha os envios respeitando a cota de cada chip, o horário permitido e o teto da conta."
        actions={
          <Button
            variant="contained"
            onClick={() => setPlanning(true)}
            disabled={approved.length === 0}
          >
            Nova distribuição
          </Button>
        }
      />

      {approved.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          Nenhum conteúdo aprovado. Só conteúdo APROVADO pode ser distribuído — crie o texto, envie
          para aprovação e volte aqui.
        </Alert>
      ) : null}

      <Card variant="outlined">
        {page && page.data.length > 0 ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Conteúdo</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell>Público</TableCell>
                <TableCell>Janela</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {page.data.map((distribution) => (
                <TableRow
                  key={distribution.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/distributions/${distribution.id}`)}
                >
                  <TableCell>{distribution.contentTitle}</TableCell>
                  <TableCell>
                    <StatusChip status={distribution.status} />
                  </TableCell>
                  <TableCell>
                    {distribution.tags.length === 0 ? (
                      <Typography variant="caption">base inteira</Typography>
                    ) : (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {distribution.tags.map((tag) => (
                          <Chip key={tag} size="small" label={tag} />
                        ))}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {formatDateTime(distribution.windowStart)} →{' '}
                      {formatDateTime(distribution.windowEnd)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small">Abrir</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="Nenhuma distribuição"
            description="Uma distribuição pega um conteúdo aprovado e o entrega ao público, no ritmo que os chips suportam."
            action={
              approved.length > 0 ? (
                <Button variant="contained" onClick={() => setPlanning(true)}>
                  Planejar a primeira
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>

      <PlanDialog
        open={planning}
        approved={approved}
        onClose={() => setPlanning(false)}
        onConfirmed={async (id) => {
          setPlanning(false);
          enqueueSnackbar('Distribuição confirmada. Os envios entraram na fila.', {
            variant: 'success',
          });
          await load();
          router.push(`/distributions/${id}`);
        }}
        onError={(message) =>
          enqueueSnackbar(message, { variant: 'error', autoHideDuration: 9000 })
        }
      />
    </Box>
  );
}

/** The three-step planner: audience and window → preview → confirm. */
function PlanDialog({
  open,
  approved,
  onClose,
  onConfirmed,
  onError,
}: {
  open: boolean;
  approved: Content[];
  onClose: () => void;
  onConfirmed: (distributionId: string) => void;
  onError: (message: string) => void;
}) {
  const [contentId, setContentId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<ContactTag[]>([]);
  const [tagsError, setTagsError] = useState(false);
  const [windowStart, setWindowStart] = useState(isoLocal(new Date(Date.now() + 10 * 60_000)));
  const [windowEnd, setWindowEnd] = useState(isoLocal(new Date(Date.now() + 5 * 86_400_000)));
  const [preview, setPreview] = useState<DistributionPreview | null>(null);
  const [persisted, setPersisted] = useState<DistributionPreview | null>(null);
  const [busy, setBusy] = useState(false);

  function payload() {
    return {
      contentId,
      windowStart: new Date(windowStart).toISOString(),
      windowEnd: new Date(windowEnd).toISOString(),
      tags,
    };
  }

  /**
   * Carrega as tags que existem na base.
   *
   * Best-effort: se falhar, o campo continua aceitando texto livre em vez de travar a distribuição
   * inteira. O `freeSolo` do Autocomplete é o que garante isso — e a lista é uma comodidade, não a
   * única forma de informar um público.
   */
  useEffect(() => {
    let active = true;
    contactService
      .tags()
      .then((loaded) => {
        if (active) {
          setAvailableTags(loaded);
          setTagsError(false);
        }
      })
      .catch(() => {
        if (active) {
          setTagsError(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function runPreview() {
    setBusy(true);
    try {
      setPreview(await distributionService.preview(payload()));
      setPersisted(null);
    } catch (caught) {
      onError(apiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function persist() {
    setBusy(true);
    try {
      setPersisted(await distributionService.create(payload()));
    } catch (caught) {
      onError(apiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!persisted?.distributionId) {
      return;
    }
    setBusy(true);
    try {
      // The hash the operator saw: if the content changed in between, the backend refuses (§8.5).
      await distributionService.confirm(persisted.distributionId, persisted.contentHash);
      onConfirmed(persisted.distributionId);
    } catch (caught) {
      onError(apiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const shown = persisted ?? preview;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Nova distribuição</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Conteúdo aprovado"
            value={contentId}
            onChange={(event) => {
              setContentId(event.target.value);
              setPreview(null);
              setPersisted(null);
            }}
            fullWidth
          >
            {approved.map((content) => (
              <MenuItem key={content.id} value={content.id}>
                {content.title} (
                {content.classification === 'ELECTORAL' ? 'eleitoral' : 'institucional'})
              </MenuItem>
            ))}
          </TextField>

          {/*
            Escolher da lista em vez de digitar de memória: uma tag inexistente produz uma campanha
            vazia e nenhum erro, e o operador não tem como distinguir um erro de digitação de um
            segmento que realmente não tem ninguém. A contagem ao lado é o tamanho do público, dito
            ANTES da prévia — escolher uma tag e descobrir depois que ela tem dois contatos é uma ida
            e volta desperdiçada.

            `freeSolo` continua: se o endpoint de tags cair, o campo aceita texto e a distribuição não
            fica bloqueada por causa de uma comodidade.
          */}
          <Autocomplete
            multiple
            freeSolo
            options={availableTags.map((tag) => tag.tag)}
            value={tags}
            onChange={(_event, selected) => {
              setTags(selected.map((tag) => tag.trim()).filter(Boolean));
              setPreview(null);
              setPersisted(null);
            }}
            renderOption={(props, option) => {
              const found = availableTags.find((tag) => tag.tag === option);
              return (
                <li {...props} key={option}>
                  {option}
                  {found ? (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      {found.contacts} contato(s)
                    </Typography>
                  ) : null}
                </li>
              );
            }}
            renderTags={(selected, getTagProps) =>
              selected.map((option, index) => {
                const { key, ...chipProps } = getTagProps({ index });
                return <Chip key={key} size="small" label={option} {...chipProps} />;
              })
            }
            renderInput={(inputParams) => (
              <TextField
                {...inputParams}
                label="Tags do público"
                placeholder={tags.length === 0 ? 'Todas (base inteira)' : ''}
                helperText={
                  tagsError
                    ? 'Não foi possível carregar as tags existentes — digite e pressione Enter.'
                    : 'Nenhuma selecionada = base inteira. Contatos com opt-out ou inativos nunca entram.'
                }
              />
            )}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Início da janela"
              type="datetime-local"
              value={windowStart}
              onChange={(event) => {
                setWindowStart(event.target.value);
                setPreview(null);
                setPersisted(null);
              }}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Fim da janela"
              type="datetime-local"
              value={windowEnd}
              onChange={(event) => {
                setWindowEnd(event.target.value);
                setPreview(null);
                setPersisted(null);
              }}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Nada é enviado depois deste horário."
            />
          </Stack>

          {!shown ? (
            <Box>
              <Button variant="outlined" onClick={runPreview} disabled={!contentId || busy}>
                Ver prévia
              </Button>
            </Box>
          ) : null}

          {shown ? (
            <>
              <Divider />
              <Typography variant="h6" component="h3">
                Prévia
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Card variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="overline" color="text.secondary">
                      Vão receber
                    </Typography>
                    <Typography variant="h5" component="p">
                      {shown.scheduledCount}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="overline" color="text.secondary">
                      Não couberam
                    </Typography>
                    <Typography
                      variant="h5"
                      component="p"
                      color={shown.overflowCount > 0 ? 'warning.main' : 'text.primary'}
                    >
                      {shown.overflowCount}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="overline" color="text.secondary">
                      Bloqueados
                    </Typography>
                    <Typography
                      variant="h5"
                      component="p"
                      color={shown.blockedCount > 0 ? 'error.main' : 'text.primary'}
                    >
                      {shown.blockedCount}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="overline" color="text.secondary">
                      Conclusão
                    </Typography>
                    <Typography variant="h5" component="p">
                      {shown.estimatedDays} dia(s)
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              {/*
                Nomeia o TETO que amarrou, não "a janela" genérica.
                A versão anterior dizia "não cabem nesta janela" e sugeria estendê-la para qualquer
                causa — inclusive para uma cota diária esgotada, onde estender a janela é a ação certa
                por um motivo completamente diferente do que a frase dava a entender. Levou um operador
                a concluir que o sistema não consegue enviar 6 mensagens em uma hora.
              */}
              {shown.overflowCount > 0 ? (
                <Alert severity="warning">
                  <strong>
                    {shown.overflowCount} contato(s) não entram neste plano e não serão enviados.
                  </strong>
                  <Typography variant="body2" component="p" sx={{ mt: 0.5 }}>
                    {shown.bindingReason}
                  </Typography>
                  {shown.overflowOptions.length > 0 ? (
                    <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
                      {shown.overflowOptions.map((option) => (
                        <Typography key={option} component="li" variant="body2">
                          {option}
                        </Typography>
                      ))}
                    </Box>
                  ) : null}
                </Alert>
              ) : null}

              {/*
                Sem overflow o teto ainda interessa: é o que responde "por que a estimativa é de N dias".
                É o caso do Adendo 02 §3.1 — o cliente adiciona um chip esperando mais vazão e não vê
                ganho nenhum, porque o teto da conta é que estava amarrando.
              */}
              {shown.overflowCount === 0 && shown.estimatedDays > 1 ? (
                <Alert severity="info">{shown.bindingReason}</Alert>
              ) : null}

              {shown.fallbackCount > 0 ? (
                <Alert severity="info">
                  {shown.fallbackCount} contato(s) vão receber o texto do fallback por não terem
                  primeiro nome.
                </Alert>
              ) : null}

              <Alert severity="info" icon={false}>
                {shown.attachments.length > 0 ? (
                  <>
                    Cada contato recebe <strong>uma mensagem</strong> com o arquivo e o texto como
                    legenda:{' '}
                    {shown.attachments
                      .map(
                        (attachment) =>
                          `${attachment.label} → ${attachment.fileName} (${attachment.kind})`,
                      )
                      .join(' · ')}
                    .
                  </>
                ) : (
                  <>Campanha somente de texto — nenhum arquivo será enviado junto.</>
                )}
              </Alert>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Canal</TableCell>
                    <TableCell align="right">Vão receber</TableCell>
                    <TableCell align="right">1º dia</TableCell>
                    <TableCell align="right">Já enviou hoje</TableCell>
                    <TableCell align="right">Cota / permitido</TableCell>
                    <TableCell align="right">Não couberam</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.perChannel.map((channel) => (
                    <TableRow key={channel.channelId}>
                      <TableCell>{channel.channelLabel}</TableCell>
                      <TableCell align="right">{channel.scheduled}</TableCell>
                      <TableCell align="right">{channel.firstDayLoad}</TableCell>
                      {/*
                        "Já enviou hoje" vinha da API e a tabela descartava. É o número que explica
                        uma campanha que fica PLANNED sem enviar: se ele bate no permitido, o resto
                        foi agendado para amanhã — e sem essa coluna isso parecia defeito.
                      */}
                      <TableCell align="right">{channel.alreadySentToday}</TableCell>
                      <TableCell align="right">
                        {channel.dailyQuota} / {channel.campaignAllowance}
                      </TableCell>
                      <TableCell align="right">{channel.overflow}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {shown.blocked.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Bloqueados, com motivo
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      {shown.blocked.slice(0, 10).map((item) => (
                        <TableRow key={item.contactId}>
                          <TableCell>{item.contactName ?? item.phoneMasked}</TableCell>
                          <TableCell>
                            <Typography variant="caption">{item.detail}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {shown.blocked.length > 10 ? (
                    <Typography variant="caption" color="text.secondary">
                      e mais {shown.blocked.length - 10}. Todos ficam registrados e aparecem no
                      relatório.
                    </Typography>
                  ) : null}
                </Box>
              ) : null}

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Amostra real
                </Typography>
                <Stack spacing={1}>
                  {shown.samples.map((sample, index) => (
                    <Card key={index} variant="outlined" sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {sample.contactName ?? 'contato sem nome'} · {sample.label}
                        {sample.usedFallback ? ' · usa fallback' : ''}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {sample.renderedBody}
                      </Typography>
                    </Card>
                  ))}
                </Stack>
              </Box>

              {persisted ? (
                <Alert severity="success">
                  Plano salvo. Nada foi enfileirado ainda — confirme para os envios começarem.
                </Alert>
              ) : null}
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
        {preview && !persisted ? (
          <Button variant="outlined" onClick={persist} disabled={busy}>
            Salvar plano
          </Button>
        ) : null}
        {persisted ? (
          <Button variant="contained" onClick={confirm} disabled={busy}>
            Confirmar e enviar
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
