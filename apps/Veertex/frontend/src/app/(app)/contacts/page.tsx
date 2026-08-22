'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import contactService from 'src/services/contactService';
import userService from 'src/services/userService';
import {
  AdminUser,
  Contact,
  ContactFieldDefinition,
  ContactType,
  CONTACT_TYPE_LABEL,
  PersonKind,
} from 'src/types/admin';

const ADMIN_MAX_WIDTH = 1200;

const TIPOS: ContactType[] = ['customer', 'supplier', 'carrier', 'reseller'];

interface FormState {
  types: ContactType[];
  personKind: PersonKind;
  legalName: string;
  tradeName: string;
  document: string;
  creditLimit: string;
  salesRepId: string;
  notes: string;
  email: string;
  phone: string;
}

const FORM_VAZIO: FormState = {
  types: ['customer'],
  personKind: 'company',
  legalName: '',
  tradeName: '',
  document: '',
  creditLimit: '',
  salesRepId: '',
  notes: '',
  email: '',
  phone: '',
};

/**
 * CONTATOS — §3.4 do CORE: cadastro único com tipos múltiplos.
 *
 * **A visibilidade dos campos vem do backend**, não daqui (§3.6). A tela lê o catálogo e mostra o que
 * `defaultVisible` mandar; manter uma segunda lista aqui divergiria da primeira no dia em que um
 * campo entrasse — e a tela passaria a esconder campo que existe ou a mostrar campo que não existe.
 *
 * **O aviso do limite de crédito vem no `hint` do catálogo, e aparece embaixo do campo.** Não é
 * decoração: o §3.4 diz que o limite bloqueia venda, os módulos que bloqueiam não existem, e um
 * número preenchido sem aviso é promessa que o sistema não cumpre. Comentário no código não serve —
 * quem preenche o campo lê a tela.
 *
 * **Vendedor vinculado (carteirização, §2.3 / ADR-0007):** o campo `salesRepId` aparece quando o
 * catálogo o marca visível (habilitado em Personalizar Campos). Com a carteirização LIGADA na conta,
 * a tela avisa o efeito — contato sem vendedor não é visto por representante nenhum.
 */
export default function ContactsPage() {
  const { can, account } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [catalog, setCatalog] = useState<ContactFieldDefinition[]>([]);
  const [sellers, setSellers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<ContactType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lista, campos] = await Promise.all([
        contactService.list({ search: search || undefined, type: tipoFiltro ?? undefined }),
        contactService.fieldCatalog(),
      ]);
      setContacts(lista);
      setCatalog(campos);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar os contatos.'));
    } finally {
      setLoading(false);
    }
  }, [search, tipoFiltro]);

  useEffect(() => {
    void load();
  }, [load]);

  // Lista de vendedores para o seletor de carteira. Silenciosa: quem não tem `users.read` recebe 403
  // e o seletor fica sem opções — o campo continua visível, só não há a quem vincular.
  useEffect(() => {
    let cancelled = false;
    userService
      .list()
      .then((list) => {
        if (!cancelled) setSellers(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const campo = useMemo(() => {
    const porNome = new Map(catalog.map((definition) => [definition.field, definition]));
    return (nome: string) => porNome.get(nome);
  }, [catalog]);

  const visivel = (nome: string) => campo(nome)?.visible ?? false;

  function abrirCriacao() {
    setEditing(null);
    setForm(FORM_VAZIO);
    setDialogOpen(true);
  }

  function abrirEdicao(contact: Contact) {
    setEditing(contact);
    setForm({
      types: contact.types,
      personKind: contact.personKind,
      legalName: contact.legalName,
      tradeName: contact.tradeName ?? '',
      document: contact.document ?? '',
      creditLimit: contact.creditLimit === null ? '' : String(contact.creditLimit),
      salesRepId: contact.salesRepId ?? '',
      notes: contact.notes ?? '',
      email: contact.emails[0]?.email ?? '',
      phone: contact.phones[0]?.phone ?? '',
    });
    setDialogOpen(true);
  }

  async function salvar() {
    if (form.types.length === 0) {
      enqueueSnackbar('Escolha ao menos um tipo.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        types: form.types,
        personKind: form.personKind,
        legalName: form.legalName,
        tradeName: form.tradeName || null,
        document: form.document.replace(/\D/g, '') || null,
        creditLimit: form.creditLimit === '' ? null : Number(form.creditLimit),
        salesRepId: form.salesRepId || null,
        notes: form.notes || null,
        emails: form.email ? [{ email: form.email }] : [],
        phones: form.phone ? [{ phone: form.phone.replace(/\D/g, '') }] : [],
      };

      if (editing) {
        await contactService.update(editing.id, payload);
        enqueueSnackbar('Contato atualizado.', { variant: 'success' });
      } else {
        await contactService.create(payload);
        enqueueSnackbar('Contato cadastrado.', { variant: 'success' });
      }
      setDialogOpen(false);
      await load();
    } catch (requestError) {
      // A mensagem do backend é preferida: é ela que sabe dizer "já existe um contato com este
      // documento nesta conta", que é acionável. Texto genérico jogaria isso fora.
      enqueueSnackbar(apiErrorMessage(requestError, 'Não foi possível salvar o contato.'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  const state = (
    <DataState
      loading={loading}
      error={error}
      empty={contacts.length === 0}
      emptyMessage={
        search || tipoFiltro ? 'Nenhum contato para este filtro.' : 'Nenhum contato cadastrado.'
      }
    />
  );

  return (
    <Box component="section" aria-label="Contatos" sx={{ maxWidth: ADMIN_MAX_WIDTH, mx: 'auto' }}>
      <PageHeader
        title="Contatos"
        description="Clientes, fornecedores, transportadoras e revendedores — um cadastro só."
        action={
          can('contacts.create') ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={abrirCriacao}>
              Novo contato
            </Button>
          ) : null
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5 }}>
        <TextField
          label="Buscar"
          placeholder="nome, documento ou telefone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ maxWidth: 360 }}
        />
        {/* Filtro por tipo — §5 do CORE. `null` = todos. */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={tipoFiltro}
          onChange={(_event, value: ContactType | null) => setTipoFiltro(value)}
          aria-label="Filtrar por tipo"
        >
          {TIPOS.map((tipo) => (
            <ToggleButton key={tipo} value={tipo}>
              {CONTACT_TYPE_LABEL[tipo]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {state ?? (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="Lista de contatos">
            <TableHead>
              <TableRow>
                <TableCell>Contato</TableCell>
                <TableCell>Tipos</TableCell>
                <TableCell>Documento</TableCell>
                <TableCell>Contato principal</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {contact.displayName}
                    </Typography>
                    {contact.tradeName ? (
                      <Typography variant="caption" color="text.secondary">
                        {contact.legalName}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                      {contact.types.map((tipo) => (
                        <Chip
                          key={tipo}
                          size="small"
                          variant="outlined"
                          label={CONTACT_TYPE_LABEL[tipo]}
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>{contact.documentFormatted ?? '—'}</TableCell>
                  <TableCell>
                    {contact.phones[0]?.masked ?? contact.emails[0]?.email ?? '—'}
                  </TableCell>
                  <TableCell align="right">
                    {can('contacts.update') ? (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => abrirEdicao(contact)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={dialogOpen}
        onClose={saving ? undefined : () => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editing ? 'Editar contato' : 'Novo contato'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                Tipos
              </Typography>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                {TIPOS.map((tipo) => (
                  <Chip
                    key={tipo}
                    label={CONTACT_TYPE_LABEL[tipo]}
                    color={form.types.includes(tipo) ? 'secondary' : 'default'}
                    variant={form.types.includes(tipo) ? 'filled' : 'outlined'}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        types: current.types.includes(tipo)
                          ? current.types.filter((t) => t !== tipo)
                          : [...current.types, tipo],
                      }))
                    }
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                O mesmo contato pode ser vários — cliente e fornecedor, por exemplo.
              </Typography>
            </Box>

            <TextField
              select
              label="Pessoa"
              value={form.personKind}
              onChange={(event) =>
                setForm((c) => ({ ...c, personKind: event.target.value as PersonKind }))
              }
            >
              <MenuItem value="company">Jurídica (CNPJ)</MenuItem>
              <MenuItem value="individual">Física (CPF)</MenuItem>
            </TextField>

            <TextField
              label={campo('legalName')?.label ?? 'Nome / Razão social'}
              value={form.legalName}
              onChange={(event) => setForm((c) => ({ ...c, legalName: event.target.value }))}
              required
            />

            {visivel('tradeName') ? (
              <TextField
                label={campo('tradeName')?.label ?? 'Nome fantasia'}
                value={form.tradeName}
                onChange={(event) => setForm((c) => ({ ...c, tradeName: event.target.value }))}
              />
            ) : null}

            {visivel('document') ? (
              <TextField
                label={form.personKind === 'individual' ? 'CPF' : 'CNPJ'}
                value={form.document}
                onChange={(event) => setForm((c) => ({ ...c, document: event.target.value }))}
                helperText="Opcional — o cadastro pode começar só com nome e telefone."
              />
            ) : null}

            <TextField
              label="E-mail"
              value={form.email}
              onChange={(event) => setForm((c) => ({ ...c, email: event.target.value }))}
            />

            <TextField
              label="Telefone"
              value={form.phone}
              onChange={(event) => setForm((c) => ({ ...c, phone: event.target.value }))}
            />

            {visivel('creditLimit') ? (
              <TextField
                label={campo('creditLimit')?.label ?? 'Limite de crédito'}
                value={form.creditLimit}
                onChange={(event) => setForm((c) => ({ ...c, creditLimit: event.target.value }))}
                inputProps={{ inputMode: 'decimal' }}
                /*
                 * O AVISO, e ele vem do backend — não é texto escrito à mão aqui. O `hint` do catálogo
                 * diz que o limite ainda não bloqueia venda, e some sozinho no dia em que o módulo VND
                 * aplicar de verdade. Um texto fixo na tela continuaria mentindo depois disso.
                 */
                helperText={campo('creditLimit')?.hint}
                FormHelperTextProps={{ sx: { color: 'vx.warn' } }}
              />
            ) : null}

            {visivel('salesRepId') ? (
              <Box>
                <TextField
                  select
                  fullWidth
                  label={campo('salesRepId')?.label ?? 'Vendedor vinculado'}
                  value={form.salesRepId}
                  onChange={(event) => setForm((c) => ({ ...c, salesRepId: event.target.value }))}
                  helperText={campo('salesRepId')?.hint}
                >
                  <MenuItem value="">Sem vendedor</MenuItem>
                  {sellers.map((seller) => (
                    <MenuItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </MenuItem>
                  ))}
                </TextField>
                {account?.preferences?.contactCarteirizacao ? (
                  <Alert severity="info" role="status" sx={{ mt: 1 }}>
                    Carteirização ligada: um contato <strong>sem vendedor</strong> não é visto por
                    nenhum representante — só por quem administra a conta.
                  </Alert>
                ) : null}
              </Box>
            ) : null}

            {visivel('notes') ? (
              <TextField
                label="Observações"
                value={form.notes}
                onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))}
                multiline
                minRows={2}
              />
            ) : null}

            {editing ? (
              <FormControlLabel
                control={
                  <Switch
                    checked={editing.active}
                    onChange={async (event) => {
                      await contactService.update(editing.id, { active: event.target.checked });
                      await load();
                      setDialogOpen(false);
                    }}
                  />
                }
                label="Ativo"
              />
            ) : null}

            {/*
              Os campos OPCIONAIS do §3.4 (Suframa, GLN, Pix, IM, site) não aparecem: eles nascem com
              `defaultVisible: false` no catálogo, e quem os liga é o `field_config` — que ainda não
              existe. Mostrar tudo por padrão encheria o formulário de campos que 95% das contas nunca
              preenchem.
            */}
            {catalog.some((definition) => definition.rule === 'optional') ? (
              <Alert severity="info" role="status">
                Campos como Suframa, GLN e Pix existem no cadastro e ficam ocultos até serem
                habilitados em Personalizar Campos — tela que chega com o módulo de configuração.
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void salvar()} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
