'use client';

import { useCallback, useEffect, useState } from 'react';
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
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
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
import { contactService } from 'src/services/services';
import type { ChannelLoad, ConsentBasis, Contact, ContactImport, Paginated } from 'src/types/api';

/**
 * As bases de consentimento do enum `ConsentBasis` da API — exatamente estas quatro, com estes
 * valores. §6.1 exige uma, e não há opção "não sei" de propósito.
 *
 * Os rótulos descrevem o que cada uma significa no domínio, porque a escolha é uma declaração de
 * procedência que fica registrada com a importação, não um campo de formulário a esmo.
 */
const CONSENT_BASES: { value: ConsentBasis; label: string }[] = [
  { value: 'EXPLICIT_OPT_IN', label: 'Opt-in explícito — assinou, marcou ou pediu para entrar' },
  {
    value: 'EXISTING_RELATIONSHIP',
    label: 'Relação existente — atendimento, cliente anterior, base do gabinete',
  },
  { value: 'PUBLIC_SOURCE', label: 'Fonte pública — descreva a fonte na procedência' },
  { value: 'THIRD_PARTY', label: 'Terceiro — identifique quem forneceu, na procedência' },
];

/**
 * Contacts (FASE 10, screen 4): the list, the import with mapping and report, and the load per channel.
 *
 * The import dialog asks for a consent basis and an origin note before it accepts a file, and the field is
 * required. §2 forbids "importação sem registro de procedência e base de consentimento" — making it
 * optional in the UI would be the same thing as not having it.
 */
export default function ContactsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [page, setPage] = useState<Paginated<Contact> | null>(null);
  const [loads, setLoads] = useState<ChannelLoad[]>([]);
  const [imports, setImports] = useState<ContactImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  /** Contato que o operador pediu para excluir e ainda não confirmou. */
  const [toDelete, setToDelete] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  /**
   * Contato cuja entrada/saída dos envios está em voo, para desabilitar só aquele botão.
   *
   * Um booleano global desabilitaria a coluna inteira e faria a tabela piscar a cada clique.
   */
  const [routingBusyId, setRoutingBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contacts, channelLoads, importList] = await Promise.all([
        contactService.list({ page: pageIndex + 1, limit: 25, search: search || undefined }),
        contactService.channelLoads(),
        contactService.listImports(),
      ]);
      setPage(contacts);
      setLoads(channelLoads);
      setImports(importList);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar os contatos.'));
    } finally {
      setLoading(false);
    }
  }, [pageIndex, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    if (!toDelete) {
      return;
    }
    setDeleting(true);
    try {
      await contactService.remove(toDelete.id);
      enqueueSnackbar('Contato excluído.', { variant: 'success' });
      setToDelete(null);
      await load();
    } catch (caught) {
      // O backend recusa quem já recebeu envio e quem pediu para sair, com o motivo no texto — é
      // isso que o operador precisa ler, não "erro ao excluir".
      enqueueSnackbar(apiErrorMessage(caught, 'Não foi possível excluir o contato.'), {
        variant: 'error',
        style: { whiteSpace: 'pre-line' },
      });
    } finally {
      setDeleting(false);
    }
  }

  /**
   * Tira o contato dos envios, ou o devolve.
   *
   * Sem diálogo de confirmação de propósito: as duas direções são reversíveis com um clique, e é
   * justamente isso que dispensa a pergunta. Confirmação existe para o que não tem volta — excluir.
   *
   * A resposta traz o contato atualizado, então a linha é trocada no lugar em vez de recarregar a
   * página inteira: recarregar perderia a posição da lista de quem está limpando uma base grande.
   */
  async function toggleRouting(contact: Contact) {
    setRoutingBusyId(contact.id);
    const removing = contact.active;
    try {
      const updated = removing
        ? await contactService.deactivate(contact.id)
        : await contactService.reactivate(contact.id);
      setPage((current) =>
        current
          ? {
              ...current,
              data: current.data.map((row) => (row.id === updated.id ? updated : row)),
            }
          : current,
      );
      enqueueSnackbar(
        removing
          ? 'Contato removido dos envios. O histórico dele continua.'
          : 'Contato devolvido aos envios.',
        { variant: 'success' },
      );
    } catch (caught) {
      // O backend recusa reativar quem pediu para sair, e explica por quê — o texto dele é a resposta.
      enqueueSnackbar(apiErrorMessage(caught, 'Não foi possível alterar a situação do contato.'), {
        variant: 'error',
        style: { whiteSpace: 'pre-line' },
      });
    } finally {
      setRoutingBusyId(null);
    }
  }

  const fallbackCount =
    page?.data.filter((contact) => contact.willUseFirstNameFallback).length ?? 0;

  if (loading && !page) {
    return <Loading label="Carregando contatos" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <Box>
      <PageHeader
        title="Contatos"
        description="Cada contato pertence a UM canal e recebe sempre por ele. A alocação é automática e equilibra a carga entre os chips conectados."
        actions={
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => setImportOpen(true)}
          >
            Importar lista
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {loads.map((entry) => (
          <Grid item xs={12} sm={6} md={3} key={entry.channelId}>
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                {entry.channelLabel}
              </Typography>
              <Typography variant="h5" component="p">
                {entry.contacts}
              </Typography>
              <StatusChip status={entry.channelStatus} />
              {!entry.acceptsNewContacts ? (
                <Typography variant="caption" component="p" color="text.secondary">
                  Não recebe contatos novos
                </Typography>
              ) : null}
            </Card>
          </Grid>
        ))}
      </Grid>

      {fallbackCount > 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {fallbackCount} contato(s) desta página não têm primeiro nome e vão receber o texto do
          fallback (ex.: &quot;Olá, amigo&quot;). Isso é esperado — a prévia do conteúdo mostra como
          fica.
        </Alert>
      ) : null}

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Buscar por nome"
          size="small"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPageIndex(0);
          }}
          helperText="Telefone não é buscável por fragmento, de propósito"
        />
      </Stack>

      <Card variant="outlined">
        {page && page.data.length > 0 ? (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Telefone</TableCell>
                  <TableCell>Tags</TableCell>
                  <TableCell>Remetente</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {page.data.map((contact) => (
                  <TableRow key={contact.id} hover>
                    <TableCell>
                      {contact.name ?? <em>sem nome</em>}
                      {contact.willUseFirstNameFallback ? (
                        <Chip size="small" label="usa fallback" variant="outlined" sx={{ ml: 1 }} />
                      ) : null}
                    </TableCell>
                    <TableCell>{contact.phoneMasked}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {contact.tags.map((tag) => (
                          <Chip key={tag} size="small" label={tag} />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {loads.find((entry) => entry.channelId === contact.currentChannelId)
                          ?.channelLabel ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {contact.optedOutAt ? (
                        <Chip size="small" color="error" label="opt-out" />
                      ) : contact.active ? (
                        <Chip size="small" color="success" label="ativo" />
                      ) : (
                        // Mesma palavra da ação que produz este estado, para o operador ligar as duas.
                        <Chip size="small" label="fora dos envios" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {/*
                        Duas ações distintas, e a distinção importa:

                        - EXCLUIR apaga a linha. Serve para número errado ou duplicata, onde deixar um
                          registro desativado é só ruído que o operador rola para sempre. O backend
                          recusa quem já recebeu envio (o dispatch é prova do que foi enviado) e quem
                          pediu para sair, e diz por quê.
                        - REMOVER DOS ENVIOS é `active = false`: para quem não pode mais receber mas
                          cujo histórico tem de sobreviver. É a saída que a recusa acima oferece.

                        Opt-out não aparece aqui: ele é definitivo, então não há o que alternar.
                      */}
                      {contact.optedOutAt ? null : (
                        <Tooltip
                          title={
                            contact.active
                              ? 'Remover dos envios (mantém o histórico)'
                              : 'Devolver aos envios'
                          }
                        >
                          <IconButton
                            size="small"
                            disabled={routingBusyId === contact.id}
                            aria-label={
                              contact.active
                                ? `Remover ${contact.name ?? 'contato'} dos envios`
                                : `Devolver ${contact.name ?? 'contato'} aos envios`
                            }
                            onClick={() => toggleRouting(contact)}
                          >
                            {contact.active ? (
                              <PauseCircleOutlineIcon fontSize="small" />
                            ) : (
                              <PlayCircleOutlineIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Excluir contato">
                        <IconButton
                          size="small"
                          aria-label={`Excluir ${contact.name ?? 'contato'}`}
                          onClick={() => setToDelete(contact)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
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
            title="Nenhum contato"
            description="Importe uma lista para começar. A importação exige a base de consentimento e a procedência."
            action={
              <Button variant="contained" onClick={() => setImportOpen(true)}>
                Importar lista
              </Button>
            }
          />
        )}
      </Card>

      {imports.length > 0 ? (
        <Box component="section" aria-label="Importações" sx={{ mt: 4 }}>
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            Importações recentes
          </Typography>
          <Card variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Arquivo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Linhas</TableCell>
                  <TableCell align="right">Importados</TableCell>
                  <TableCell align="right">Duplicados</TableCell>
                  <TableCell align="right">Inválidos</TableCell>
                  <TableCell align="right">Sem 1º nome</TableCell>
                  <TableCell>Quando</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {imports.map((entry) => (
                  <TableRow key={entry.id} hover>
                    <TableCell>{entry.fileName}</TableCell>
                    <TableCell>
                      <StatusChip status={entry.status} />
                    </TableCell>
                    <TableCell align="right">{entry.totalRows}</TableCell>
                    <TableCell align="right">{entry.importedCount}</TableCell>
                    <TableCell align="right">{entry.duplicatedCount}</TableCell>
                    <TableCell align="right">{entry.invalidCount}</TableCell>
                    <TableCell align="right">{entry.missingFirstNameCount}</TableCell>
                    <TableCell>
                      <Typography variant="caption">{formatDateTime(entry.createdAt)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Box>
      ) : null}

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={async (message) => {
          enqueueSnackbar(message, { variant: 'success' });
          setImportOpen(false);
          await load();
        }}
        onError={(message) => enqueueSnackbar(message, { variant: 'error' })}
      />

      {/*
        Confirmação explícita, e não um `confirm()` do navegador: o diálogo nomeia QUEM vai sumir e
        diz o que vai junto. Excluir por engano o contato errado numa lista de linhas parecidas é o
        acidente que um "Tem certeza?" genérico não evita.
      */}
      <Dialog open={toDelete !== null} onClose={() => setToDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle>Excluir contato</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{toDelete?.name ?? 'Contato sem nome'}</strong> ({toDelete?.phoneMasked}) será
            apagado da base.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            A conversa e o histórico de remetente dele vão junto, e não há como desfazer. Contatos
            que já receberam algum envio ou que pediram para sair não podem ser excluídos — nesses
            casos o sistema recusa e explica o motivo.
          </Typography>
          {/*
            A alternativa dita ANTES da recusa acontecer. Quem só quer que o contato pare de receber
            não precisa descobrir isso levando um erro primeiro.
          */}
          {toDelete?.active ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Se a intenção é apenas que ele <strong>pare de receber</strong>, use{' '}
              <strong>Remover dos envios</strong> (o botão de pausa na linha): ele fica fora de toda
              distribuição nova, o histórico continua, e dá para desfazer.
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          {toDelete?.active ? (
            <Button
              onClick={async () => {
                const contact = toDelete;
                setToDelete(null);
                await toggleRouting(contact);
              }}
              disabled={deleting}
            >
              Remover dos envios
            </Button>
          ) : null}
          <Button onClick={() => setToDelete(null)} disabled={deleting}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/**
 * The import dialog.
 *
 * The file is read in the browser and sent as base64 in JSON — the backend runs on Fastify and does not
 * accept multipart (CLAUDE.md). The column mapping is asked for rather than guessed: a header called
 * "celular" or "fone" is normal, and guessing wrong imports a column of nonsense as phone numbers.
 */
function ImportDialog({
  open,
  onClose,
  onDone,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [consentBasis, setConsentBasis] = useState<ConsentBasis>(CONSENT_BASES[0].value);
  const [originNote, setOriginNote] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [phoneColumn, setPhoneColumn] = useState('telefone');
  const [nameColumn, setNameColumn] = useState('nome');
  const [tagsColumn, setTagsColumn] = useState('tags');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!file) {
      onError('Escolha um arquivo CSV ou XLSX.');
      return;
    }
    // Dez caracteres é o mínimo que a API exige. Validar aqui com o MESMO número evita o 400 que
    // chega depois de o navegador já ter lido e codificado um arquivo de 15 MB.
    if (originNote.trim().length < 10) {
      onError(
        'Descreva a procedência da lista com pelo menos 10 caracteres. Sem isso a importação não é rastreável.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
        reader.readAsDataURL(file);
      });

      const started = await contactService.startImport({
        fileName: file.name,
        fileBase64: base64,
        fileMimeType: file.type || 'text/csv',
        consentBasis,
        originNote,
        hasHeader,
        mapping: {
          phone: phoneColumn,
          name: nameColumn || undefined,
          tags: tagsColumn || undefined,
        },
      });

      onDone(
        `Importação iniciada (${started.fileName}). O processamento roda em segundo plano e o relatório aparece na lista.`,
      );
    } catch (caught) {
      onError(apiErrorMessage(caught, 'Não foi possível iniciar a importação.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Importar contatos</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
            {file ? file.name : 'Escolher arquivo CSV ou XLSX'}
            <input
              type="file"
              accept=".csv,.xlsx,text/csv"
              hidden
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Button>

          <TextField
            select
            label="Base de consentimento"
            value={consentBasis}
            onChange={(event) => setConsentBasis(event.target.value as ConsentBasis)}
            helperText="Obrigatório. Fica registrado com a importação."
            fullWidth
          >
            {CONSENT_BASES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Procedência da lista"
            placeholder="Ex.: cadastro do evento de 12/07, planilha da assessoria"
            value={originNote}
            onChange={(event) => setOriginNote(event.target.value)}
            helperText="De onde vieram estes números. Obrigatório."
            fullWidth
            multiline
            minRows={2}
          />

          <Typography variant="subtitle2">Mapeamento de colunas</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Coluna do telefone"
              value={phoneColumn}
              onChange={(event) => setPhoneColumn(event.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Coluna do nome"
              value={nameColumn}
              onChange={(event) => setNameColumn(event.target.value)}
              fullWidth
            />
            <TextField
              label="Coluna das tags"
              value={tagsColumn}
              onChange={(event) => setTagsColumn(event.target.value)}
              fullWidth
            />
          </Stack>

          <TextField
            select
            label="O arquivo tem cabeçalho?"
            value={hasHeader ? 'yes' : 'no'}
            onChange={(event) => setHasHeader(event.target.value === 'yes')}
            fullWidth
          >
            <MenuItem value="yes">Sim, a primeira linha é o cabeçalho</MenuItem>
            <MenuItem value="no">Não, use índices (0, 1, 2…)</MenuItem>
          </TextField>

          <Alert severity="info">
            Números repetidos não criam contatos novos e mantêm o remetente original — reimportar a
            mesma lista é seguro e não muda por qual chip a pessoa recebe.
          </Alert>
          {submitting ? <LinearProgress /> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={submit} disabled={submitting}>
          Importar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
