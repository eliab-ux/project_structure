'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { ErrorState, Loading, PageHeader, StatusChip } from 'src/components/common/common';
import { apiErrorMessage } from 'src/services/api';
import { approvalService, contentService } from 'src/services/services';
import type { ApprovalProgress, Content, ContentPreview } from 'src/types/api';

/**
 * The content editor (FASE 10, screen 6) and its approval tracking (part of screen 7).
 *
 * The screen is built around one fact the operator has to feel rather than read in a manual: **editing an
 * approved content undoes its approval** (§8.5). So the banner is loud, the save button says so, and after
 * an edit the page shows the content back in DRAFT with its approvals invalidated — instead of letting
 * someone discover it at distribution time.
 *
 * The rendered preview is not decoration either. §7.4 requires real contacts, "um sem `first_name` para
 * mostrar o fallback em ação", because the fallback is the case people forget until it goes out wrong.
 */
export default function ContentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [content, setContent] = useState<Content | null>(null);
  const [preview, setPreview] = useState<ContentPreview | null>(null);
  const [progress, setProgress] = useState<ApprovalProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [bodyBase, setBodyBase] = useState('');
  /** Link de origem. Editável aqui porque procedência se descobre depois — ver o campo. */
  const [sourceUrl, setSourceUrl] = useState('');
  const [includeSourceUrl, setIncludeSourceUrl] = useState(false);
  const [variantLabel, setVariantLabel] = useState('');
  const [variantBody, setVariantBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contentService.get(params.id);
      setContent(data);
      setTitle(data.title);
      setBodyBase(data.bodyBase);
      setSourceUrl(data.sourceUrl ?? '');
      setIncludeSourceUrl(data.includeSourceUrl);

      // Both are best-effort: a content with no contacts yet has no preview, and one never submitted has
      // no approval progress. Neither should break the editor.
      contentService
        .preview(params.id)
        .then(setPreview)
        .catch(() => setPreview(null));
      approvalService
        .progress(params.id)
        .then(setProgress)
        .catch(() => setProgress(null));
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar o conteúdo.'));
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Espelha o domínio: editável é tudo que não está ARQUIVADO.
   *
   * REJEITADO estava fora desta lista, e o efeito era travar a tela inteira justamente no estado em
   * que o autor PRECISA mexer — rejeição existe para ser respondida. O backend sempre permitiu; era a
   * interface que fechava a porta.
   */
  const editable = content ? content.status !== 'ARCHIVED' : false;
  const rejected = content?.status === 'REJECTED';
  /**
   * Se salvar agora derruba as aprovações.
   *
   * Depende do que MUDOU, não só do status: enquanto o link é só procedência ele não entra no
   * `content_hash` — corrigir um link não altera a mensagem que alguém aprovou, e o domínio não
   * invalida nada por isso. Rotular o botão como destrutivo em todo caso ensinaria o operador a não
   * corrigir o link por medo de perder a aprovação, que é o oposto do que a rastreabilidade precisa.
   *
   * Já com "enviar o link na mensagem" ligado o link É a mensagem, e mexer nele custa a aprovação —
   * de um lado e do outro, porque tanto ligar quanto desligar muda o que o contato recebe.
   */
  const linkIsPartOfMessage = includeSourceUrl || content?.includeSourceUrl === true;
  const linkChanged = content
    ? (content.sourceUrl ?? '') !== sourceUrl.trim() ||
      content.includeSourceUrl !== includeSourceUrl
    : false;
  const textChanged = content
    ? title !== content.title ||
      bodyBase !== content.bodyBase ||
      (linkIsPartOfMessage && linkChanged)
    : false;
  const willInvalidate = content
    ? ['PENDING_APPROVAL', 'APPROVED'].includes(content.status) && textChanged
    : false;

  async function save() {
    setSaving(true);
    try {
      // String vazia vira `null`: "sem link de origem" é ausência, não um link vazio — e é assim que
      // a coluna guarda. Mandar '' deixaria a procedência parecendo preenchida com nada.
      await contentService.update(params.id, {
        title,
        bodyBase,
        sourceUrl: sourceUrl.trim() === '' ? null : sourceUrl.trim(),
        includeSourceUrl,
      });
      enqueueSnackbar(
        willInvalidate
          ? 'Conteúdo salvo. As aprovações foram invalidadas e ele voltou para rascunho.'
          : 'Conteúdo salvo.',
        { variant: willInvalidate ? 'warning' : 'success' },
      );
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  /** Devolve um rejeitado a rascunho sem tocar no texto — para quem discorda e reenvia igual. */
  async function reopen() {
    try {
      await contentService.reopen(params.id);
      enqueueSnackbar(
        'Conteúdo voltou para rascunho. Você já pode enviar para aprovação de novo.',
        {
          variant: 'success',
        },
      );
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  async function addVariant() {
    try {
      await contentService.addVariant(params.id, { label: variantLabel, body: variantBody });
      setVariantLabel('');
      setVariantBody('');
      enqueueSnackbar('Variante adicionada.', { variant: 'success' });
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  async function uploadMedia(file: File) {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
        reader.readAsDataURL(file);
      });
      await contentService.attachMedia(params.id, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileBase64: base64,
      });
      enqueueSnackbar('Mídia anexada.', { variant: 'success' });
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  /**
   * Abre a mídia numa aba.
   *
   * Busca os bytes pela API (com o JWT) e abre um blob URL. Não dá para linkar a URL do storage: ela é
   * assinada com o endpoint INTERNO do MinIO, e o navegador responde ERR_NAME_NOT_RESOLVED.
   */
  async function openMedia(mediaId: string, fileName: string) {
    try {
      const url = await contentService.mediaObjectUrl(params.id, mediaId);
      const opened = window.open(url, '_blank', 'noopener');
      if (!opened) {
        enqueueSnackbar(`Permita pop-ups para ver ${fileName}.`, { variant: 'warning' });
      }
      // Libera depois de a aba ter carregado. Revogar na hora deixaria a aba em branco.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught, 'Não foi possível abrir a mídia.'), {
        variant: 'error',
      });
    }
  }

  async function submitForApproval() {
    try {
      const result = await approvalService.submit(params.id);
      if (result.notificationFailures.length > 0) {
        enqueueSnackbar(
          `Enviado, mas alguma notificação falhou: ${result.notificationFailures.join('; ')}`,
          { variant: 'warning', autoHideDuration: 9000 },
        );
      } else {
        enqueueSnackbar(
          `Enviado para ${result.requestsCreated} aprovador(es). São necessárias ${result.requiredApprovals} aprovação(ões).`,
          { variant: 'success' },
        );
      }
      await load();
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error', autoHideDuration: 9000 });
    }
  }

  if (loading) {
    return <Loading label="Carregando conteúdo" />;
  }
  if (error || !content) {
    return <ErrorState message={error ?? 'Conteúdo não encontrado.'} onRetry={load} />;
  }

  return (
    <Box>
      <PageHeader
        title={content.title}
        description={`Versão ${content.contentHash.slice(0, 12)}… · criado em ${new Date(content.createdAt).toLocaleDateString('pt-BR')}`}
        actions={
          <>
            <Button onClick={() => router.push('/contents')}>Voltar</Button>
            {/*
              Rejeitado NÃO pode ser submetido direto — a API exige rascunho. Oferecer "Enviar para
              aprovação" aqui era prometer um botão que responde erro; o caminho é reabrir (ou
              simplesmente editar, que já devolve para rascunho).
            */}
            {rejected ? (
              <Button variant="contained" onClick={reopen}>
                Reabrir como rascunho
              </Button>
            ) : content.status === 'DRAFT' ? (
              <Button variant="contained" startIcon={<SendIcon />} onClick={submitForApproval}>
                Enviar para aprovação
              </Button>
            ) : null}
          </>
        }
      />

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <StatusChip status={content.status} size="medium" />
        <Chip
          label={content.classification === 'ELECTORAL' ? 'Eleitoral' : 'Institucional'}
          color={content.classification === 'ELECTORAL' ? 'warning' : 'default'}
        />
        {content.status === 'APPROVED' ? (
          <Chip color="success" label="Pode ser distribuído" />
        ) : null}
      </Stack>

      {willInvalidate ? (
        <Alert severity="warning" sx={{ mb: 3 }} role="alert">
          Este conteúdo está {content.status === 'APPROVED' ? 'aprovado' : 'em aprovação'}. Qualquer
          edição invalida as aprovações e devolve o conteúdo para rascunho — os links já enviados
          param de funcionar e é preciso submeter de novo.
        </Alert>
      ) : null}

      {/* Rejeição é para ser respondida, então a tela diz como — não é um estado terminal. */}
      {rejected ? (
        <Alert severity="info" sx={{ mb: 3 }} role="status">
          Este conteúdo foi <strong>rejeitado</strong>. Corrija o texto e salve: ele volta para
          rascunho sozinho e você envia para aprovação de novo. Se discorda da rejeição e quer
          reenviar o mesmo texto, use <strong>Reabrir como rascunho</strong> — assim a versão
          continua sendo exatamente a mesma.
          {progress?.requests.some((request) => request.comment) ? (
            <Box component="span" sx={{ display: 'block', mt: 1 }}>
              Veja o comentário de quem rejeitou no acompanhamento das aprovações, abaixo.
            </Box>
          ) : null}
        </Alert>
      ) : null}

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Texto
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Título"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  fullWidth
                  disabled={!editable}
                />
                <TextField
                  label="Texto base"
                  value={bodyBase}
                  onChange={(event) => setBodyBase(event.target.value)}
                  fullWidth
                  multiline
                  minRows={6}
                  disabled={!editable}
                  helperText="{{primeiro_nome|amigo}} — o fallback depois do | é obrigatório"
                />
                {/*
                  O link de origem é editável aqui, e não só na criação: procedência é justamente o
                  que se descobre depois. A pessoa cola o texto de um print, cria o rascunho, e só
                  então acha o post original — sem este campo, o único caminho era recriar o conteúdo.
                */}
                <TextField
                  label="Link de origem (opcional)"
                  placeholder="https://instagram.com/p/..."
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  fullWidth
                  disabled={!editable}
                  helperText={
                    includeSourceUrl
                      ? 'Este link vai NA mensagem: alterá-lo invalida a aprovação. Vazio remove o link.'
                      : 'Só procedência, para o aprovador conferir. Vazio remove o link.'
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeSourceUrl}
                      onChange={(event) => setIncludeSourceUrl(event.target.checked)}
                      disabled={!editable}
                    />
                  }
                  label="Enviar este link na mensagem"
                />
                <Box>
                  <Button
                    variant="contained"
                    onClick={save}
                    disabled={!editable || saving}
                    color={willInvalidate ? 'warning' : 'primary'}
                  >
                    {willInvalidate ? 'Salvar e invalidar aprovações' : 'Salvar'}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Variantes
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Uma variante existe para adequar a mensagem a um público — nunca para driblar
                detecção de duplicidade. Toda variante é escrita ou revisada por uma pessoa.
              </Typography>

              <Stack spacing={2} divider={<Divider />}>
                {content.variants.map((variant) => (
                  <Box key={variant.id}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle2">{variant.label}</Typography>
                      {editable ? (
                        <IconButton
                          size="small"
                          aria-label={`Remover variante ${variant.label}`}
                          onClick={async () => {
                            await contentService.removeVariant(params.id, variant.id);
                            await load();
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </Stack>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {variant.body}
                    </Typography>
                    {variant.reviewedBy ? (
                      <Chip size="small" color="success" label="revisada" sx={{ mt: 0.5 }} />
                    ) : (
                      <Chip
                        size="small"
                        variant="outlined"
                        label="sem revisão humana"
                        sx={{ mt: 0.5 }}
                      />
                    )}
                  </Box>
                ))}

                {editable ? (
                  <Stack spacing={1}>
                    <TextField
                      label="Rótulo da variante"
                      placeholder="Zona Norte"
                      size="small"
                      value={variantLabel}
                      onChange={(event) => setVariantLabel(event.target.value)}
                    />
                    <TextField
                      label="Texto da variante"
                      size="small"
                      multiline
                      minRows={3}
                      value={variantBody}
                      onChange={(event) => setVariantBody(event.target.value)}
                    />
                    <Box>
                      <Button onClick={addVariant} disabled={!variantLabel || !variantBody}>
                        Adicionar variante
                      </Button>
                    </Box>
                  </Stack>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Mídias
              </Typography>
              <Stack spacing={1}>
                {content.media.map((asset) => (
                  <Stack key={asset.id} direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={asset.kind} />
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      {asset.originalName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(asset.sizeBytes / 1024)} KB
                    </Typography>
                    <Button size="small" onClick={() => openMedia(asset.id, asset.originalName)}>
                      Ver
                    </Button>
                    {editable ? (
                      <IconButton
                        size="small"
                        aria-label={`Remover ${asset.originalName}`}
                        onClick={async () => {
                          await contentService.removeMedia(params.id, asset.id);
                          await load();
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </Stack>
                ))}
                {editable ? (
                  <Button
                    component="label"
                    startIcon={<UploadFileIcon />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Anexar mídia
                    <input
                      type="file"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          uploadMedia(file);
                        }
                      }}
                    />
                  </Button>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                Como vai chegar
              </Typography>
              {preview ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Renderizado com contatos reais. {preview.fallbackCount} de{' '}
                    {preview.sampledContacts} da amostra caem no fallback.
                  </Typography>
                  <Stack spacing={2} divider={<Divider />}>
                    {preview.samples.map((sample, index) => (
                      <Box key={`${sample.label}-${index}`}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {sample.contactName ?? 'contato sem nome'} · {sample.label}
                          </Typography>
                          {sample.usedFallback ? (
                            <Chip size="small" variant="outlined" label="fallback" />
                          ) : null}
                        </Stack>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {sample.renderedBody}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  A prévia usa contatos reais. Importe uma lista para vê-la.
                </Typography>
              )}
            </CardContent>
          </Card>

          {progress ? (
            <Card variant="outlined" sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" component="h3" gutterBottom>
                  Aprovação
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {progress.approvedCount} de {progress.requiredApprovals} aprovações desta versão
                  {progress.pendingCount > 0 ? ` · ${progress.pendingCount} pendente(s)` : ''}
                </Typography>
                <Stack spacing={1.5} divider={<Divider />}>
                  {progress.requests.map((request) => (
                    <Box key={request.id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                          {request.approverName}
                        </Typography>
                        <StatusChip status={request.status} />
                      </Stack>
                      {request.contentHash !== progress.contentHash ? (
                        <Typography variant="caption" color="text.secondary">
                          decisão sobre uma versão anterior — não conta para esta
                        </Typography>
                      ) : null}
                      {request.comment ? (
                        <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                          “{request.comment}”
                        </Typography>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ) : null}
        </Grid>
      </Grid>
    </Box>
  );
}
