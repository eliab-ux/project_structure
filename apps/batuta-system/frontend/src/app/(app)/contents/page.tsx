'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  StatusChip,
  formatDateTime,
} from 'src/components/common/common';
import { apiErrorMessage } from 'src/services/api';
import { contentService } from 'src/services/services';
import type { Content, Paginated } from 'src/types/api';

const contentSchema = yup.object({
  title: yup.string().min(3).max(200).required('Título obrigatório'),
  classification: yup
    .string()
    .oneOf(['INSTITUTIONAL', 'ELECTORAL'], 'Escolha a classificação')
    .required('Classificação obrigatória'),
  bodyBase: yup.string().min(1).max(4000).required('Texto obrigatório'),
  sourceUrl: yup
    .string()
    .url('URL inválida')
    .nullable()
    .transform((value) => value || null),
  includeSourceUrl: yup.boolean().default(false),
});

type ContentForm = yup.InferType<typeof contentSchema>;

/**
 * Content list and creation (FASE 10, screen 6 — the editor itself is on the detail page).
 *
 * The classification field has NO default and no "não sei" option. §1.3 makes it mandatory with no default
 * and no null, and the reason is legal rather than tidy: electoral content carries its own exposure in
 * Brazil (§15 risco 6), and a field that defaults to institutional would silently mislabel it.
 */
/**
 * Lê o arquivo como base64 puro, sem o prefixo `data:...;base64,`.
 *
 * Base64 em JSON e não multipart: o backend roda em Fastify, que não aceita multipart (CLAUDE.md).
 */
async function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

export default function ContentsPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [page, setPage] = useState<Paginated<Content> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [creating, setCreating] = useState(false);
  /** Mídias escolhidas no diálogo. Só sobem depois de o conteúdo existir — a API anexa a um id. */
  const [files, setFiles] = useState<File[]>([]);

  const form = useForm<ContentForm>({ resolver: yupResolver(contentSchema) });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPage(
        await contentService.list({
          page: pageIndex + 1,
          limit: 20,
          status: statusFilter || undefined,
        }),
      );
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar os conteúdos.'));
    } finally {
      setLoading(false);
    }
  }, [pageIndex, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(values: ContentForm) {
    try {
      const created = await contentService.create({
        title: values.title,
        classification: values.classification,
        origin: 'MANUAL',
        bodyBase: values.bodyBase,
        sourceUrl: values.sourceUrl ?? null,
        includeSourceUrl: values.includeSourceUrl ?? false,
      });

      // As mídias sobem DEPOIS de o conteúdo existir, porque a API anexa a um id. Se alguma falhar, o
      // rascunho continua lá e a tela diz qual — perder o texto por causa de um anexo seria pior.
      const failed: string[] = [];
      for (const file of files) {
        try {
          await contentService.attachMedia(created.id, {
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileBase64: await readBase64(file),
          });
        } catch {
          failed.push(file.name);
        }
      }

      enqueueSnackbar(
        failed.length > 0
          ? `Rascunho criado, mas estas mídias falharam: ${failed.join(', ')}. Anexe de novo na tela do conteúdo.`
          : 'Conteúdo criado como rascunho.',
        { variant: failed.length > 0 ? 'warning' : 'success' },
      );
      setCreating(false);
      setFiles([]);
      form.reset();
      router.push(`/contents/${created.id}`);
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  /**
   * Duplica e abre a cópia para validação.
   *
   * A cópia nasce em RASCUNHO mesmo que a origem esteja aprovada — herdar a aprovação seria um jeito
   * de enviar texto novo sob uma aprovação dada para outras palavras. Texto, variantes e mídias vêm;
   * cada mídia ganha a própria cópia no storage, então apagar a de um conteúdo não afeta o outro.
   */
  async function duplicate(content: Content) {
    try {
      const copy = await contentService.duplicate(content.id);

      // Compara o que chegou com o que a origem tinha: se faltou mídia, a cópia do arquivo falhou e o
      // operador precisa saber ANTES de submeter para aprovação.
      const missing = content.media.length - copy.media.length;
      enqueueSnackbar(
        missing > 0
          ? `Cópia criada, mas ${missing} mídia(s) não foram copiadas. Anexe-as aqui antes de submeter.`
          : 'Cópia criada como rascunho. Revise e salve.',
        { variant: missing > 0 ? 'warning' : 'success', autoHideDuration: 8000 },
      );
      router.push(`/contents/${copy.id}`);
    } catch (caught) {
      enqueueSnackbar(apiErrorMessage(caught), { variant: 'error' });
    }
  }

  if (loading && !page) {
    return <Loading label="Carregando conteúdos" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <Box>
      <PageHeader
        title="Conteúdo"
        description="Um conteúdo é o que será enviado: o texto base, variantes por público e mídias. Só conteúdo APROVADO pode ser distribuído."
        actions={
          <Button variant="contained" onClick={() => setCreating(true)}>
            Novo conteúdo
          </Button>
        }
      />

      <TextField
        select
        size="small"
        label="Situação"
        value={statusFilter}
        onChange={(event) => {
          setStatusFilter(event.target.value);
          setPageIndex(0);
        }}
        sx={{ mb: 2, minWidth: 220 }}
      >
        <MenuItem value="">Todas</MenuItem>
        <MenuItem value="DRAFT">Rascunho</MenuItem>
        <MenuItem value="PENDING_APPROVAL">Em aprovação</MenuItem>
        <MenuItem value="APPROVED">Aprovado</MenuItem>
        <MenuItem value="REJECTED">Rejeitado</MenuItem>
        <MenuItem value="ARCHIVED">Arquivado</MenuItem>
      </TextField>

      <Card variant="outlined">
        {page && page.data.length > 0 ? (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Título</TableCell>
                  <TableCell>Classificação</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell align="right">Variantes</TableCell>
                  <TableCell align="right">Mídias</TableCell>
                  <TableCell>Criado</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {page.data.map((content) => (
                  <TableRow
                    key={content.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/contents/${content.id}`)}
                  >
                    <TableCell>{content.title}</TableCell>
                    <TableCell>
                      <StatusChip
                        status={
                          content.classification === 'ELECTORAL' ? 'ELEITORAL' : 'INSTITUCIONAL'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={content.status} />
                    </TableCell>
                    <TableCell align="right">{content.variants.length}</TableCell>
                    <TableCell align="right">{content.media.length}</TableCell>
                    <TableCell>
                      <Typography variant="caption">{formatDateTime(content.createdAt)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Criar uma cópia em rascunho para editar">
                        <Button
                          size="small"
                          startIcon={<ContentCopyIcon fontSize="small" />}
                          // `stopPropagation`: a linha inteira navega para o conteúdo, e sem isto o
                          // clique duplicaria E abriria o original.
                          onClick={(event) => {
                            event.stopPropagation();
                            duplicate(content);
                          }}
                        >
                          Duplicar
                        </Button>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={page.meta.total}
              page={pageIndex}
              rowsPerPage={page.meta.limit}
              rowsPerPageOptions={[page.meta.limit]}
              onPageChange={(_event, next) => setPageIndex(next)}
              labelRowsPerPage="Por página"
            />
          </>
        ) : (
          <EmptyState
            title="Nenhum conteúdo"
            description="Crie o texto que será enviado. Ele nasce como rascunho e precisa de aprovação antes de qualquer distribuição."
            action={
              <Button variant="contained" onClick={() => setCreating(true)}>
                Novo conteúdo
              </Button>
            }
          />
        )}
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} fullWidth maxWidth="sm">
        <DialogTitle>Novo conteúdo</DialogTitle>
        <Box component="form" onSubmit={form.handleSubmit(onCreate)} noValidate>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Título"
                fullWidth
                {...form.register('title')}
                error={Boolean(form.formState.errors.title)}
                helperText={form.formState.errors.title?.message ?? 'Só para você localizar depois'}
              />
              <TextField
                select
                label="Classificação"
                defaultValue=""
                fullWidth
                {...form.register('classification')}
                error={Boolean(form.formState.errors.classification)}
                helperText={
                  form.formState.errors.classification?.message ??
                  'Obrigatória e sem padrão: conteúdo eleitoral tem regra própria e trilha mais exigente.'
                }
              >
                <MenuItem value="INSTITUTIONAL">Institucional</MenuItem>
                <MenuItem value="ELECTORAL">Eleitoral</MenuItem>
              </TextField>
              <TextField
                label="Texto base"
                fullWidth
                multiline
                minRows={5}
                placeholder="Olá {{primeiro_nome|amigo}}, ..."
                {...form.register('bodyBase')}
                error={Boolean(form.formState.errors.bodyBase)}
                helperText={
                  form.formState.errors.bodyBase?.message ??
                  'Use {{primeiro_nome|amigo}} para personalizar. O fallback depois do | é obrigatório.'
                }
              />
              <TextField
                label="Link de origem (opcional)"
                placeholder="https://instagram.com/p/..."
                fullWidth
                {...form.register('sourceUrl')}
                error={Boolean(form.formState.errors.sourceUrl)}
                helperText={
                  form.formState.errors.sourceUrl?.message ??
                  'Por padrão é só procedência, para o aprovador conferir.'
                }
              />
              <FormControlLabel
                control={<Checkbox {...form.register('includeSourceUrl')} />}
                label="Enviar este link na mensagem"
              />
              {/*
                Ligado, o link deixa de ser metadado e vira texto que o contato recebe — e por isso
                passa a contar no content_hash. Trocar o link depois disso invalida a aprovação, que é
                exatamente o ponto: quem aprovou aprovou um destino.
              */}
              {/*
                Mídia no próprio diálogo: o fluxo real é "escrevi a mensagem e tenho a imagem dela".
                Obrigar a criar o rascunho e só então anexar numa segunda tela é um passo que se
                esquece — e conteúdo submetido sem a imagem volta da aprovação.
              */}
              <Box>
                <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                  Anexar mídia
                  <input
                    hidden
                    multiple
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    onChange={(event) => {
                      setFiles((current) => [...current, ...Array.from(event.target.files ?? [])]);
                      // Zera o input para que escolher o mesmo arquivo de novo dispare o onChange.
                      event.target.value = '';
                    }}
                  />
                </Button>
                <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 0.5 }}>
                  Imagem, vídeo ou PDF. Sobem depois de o rascunho ser criado.
                </Typography>

                {files.length > 0 ? (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {files.map((file, index) => (
                      <Chip
                        key={`${file.name}-${index}`}
                        label={`${file.name} (${Math.ceil(file.size / 1024)} kB)`}
                        onDelete={() =>
                          setFiles((current) => current.filter((_, at) => at !== index))
                        }
                      />
                    ))}
                  </Stack>
                ) : null}
              </Box>

              <Alert severity="info">
                O único campo de personalização é <code>{'{{primeiro_nome|fallback}}'}</code>. Um
                campo sem fallback é recusado — mensagem que chega com &quot;Olá ,&quot; é pior que
                sem nome.
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setCreating(false);
                setFiles([]);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="contained">
              Criar rascunho
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
