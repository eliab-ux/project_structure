'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import roleService from 'src/services/roleService';
import { PermissionCatalog, Role } from 'src/types/admin';

/**
 * Papéis e permissões (01_Veertex_Core §3.3).
 *
 * A árvore de permissões vem de `/roles/catalog`, nunca de uma cópia local. Uma permissão só é real
 * se algum guard do backend a verifica; uma lista duplicada aqui ofereceria caixinhas que não
 * concedem nada, e o sintoma seria "marquei e o usuário continua sem acesso".
 *
 * **Papel de sistema é EDITÁVEL, e só a exclusão é bloqueada.** O §3.3 do `01_Veertex_Core.md` diz
 * que os sete papéis padrão são "ajustáveis por conta": cada negócio decide o que um Gerente pode
 * fazer, e um catálogo fixo obrigaria a criar um papel novo só para mudar uma permissão. `isSystem`
 * significa "o produto conta com a existência deste papel", não "as permissões dele são intocáveis".
 *
 * Uma versão anterior desta tela bloqueava as duas coisas — leitura minha, não do documento. O
 * cadeado que sobrou indica apenas que o papel não pode ser excluído.
 *
 * Quem impede o tiro no pé é o backend, não esta tela: uma conta não pode ficar sem nenhum usuário
 * ativo capaz de administrar papéis, e a recusa vem com mensagem explicando por quê.
 */

const schema = yup.object({
  code: yup
    .string()
    .trim()
    .required('Código é obrigatório.')
    .matches(/^[A-Za-z0-9_]{2,30}$/, 'Use 2–30 caracteres: letras, números ou _.'),
  name: yup.string().trim().required('Nome é obrigatório.').min(2).max(80),
  description: yup.string().trim().max(200).nullable(),
});

type FormValues = yup.InferType<typeof schema>;

const EMPTY: FormValues = { code: '', name: '', description: '' };

/** `companies.read` → `Ler`. O prefixo já é o título do grupo; repeti-lo em cada linha é ruído. */
function actionLabel(permission: string): string {
  const action = permission.split('.').slice(1).join('.');
  const labels: Record<string, string> = {
    read: 'Ler',
    create: 'Criar',
    update: 'Editar',
    delete: 'Excluir',
    disable: 'Desabilitar',
  };
  return labels[action] ?? action;
}

const AREA_LABEL: Record<string, string> = {
  account: 'Conta',
  companies: 'Empresas',
  users: 'Usuários',
  roles: 'Papéis',
};

export default function RolesPage() {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalog>({ areas: [], permissions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Role | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: yupResolver(schema), defaultValues: EMPTY });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedRoles, loadedCatalog] = await Promise.all([
        roleService.list(),
        roleService.permissionCatalog(),
      ]);
      setRoles(loadedRoles);
      setCatalog(loadedCatalog);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar os papéis.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Permissões agrupadas por área, na ordem que o backend mandou. */
  const grouped = useMemo(() => {
    return catalog.areas.map((area) => ({
      area,
      permissions: catalog.permissions.filter((permission) => permission.startsWith(`${area}.`)),
    }));
  }, [catalog]);

  function openCreate() {
    setEditing(null);
    setSelected([]);
    reset(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setSelected(role.permissions);
    reset({ code: role.code, name: role.name, description: role.description ?? '' });
    setDialogOpen(true);
  }

  function togglePermission(permission: string) {
    setSelected((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }

  async function onSubmit(values: FormValues) {
    if (selected.length === 0) {
      enqueueSnackbar('Selecione ao menos uma permissão.', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const description = (values.description ?? '').trim() || null;
      if (editing) {
        // O código não vai no update: ele identifica o papel, e trocá-lo seria criar outro.
        await roleService.update(editing.id, {
          name: values.name,
          description,
          permissions: selected,
        });
        enqueueSnackbar('Papel atualizado.', { variant: 'success' });
      } else {
        await roleService.create({
          code: values.code.toUpperCase(),
          name: values.name,
          description,
          permissions: selected,
        });
        enqueueSnackbar('Papel criado.', { variant: 'success' });
      }
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!removing) {
      return;
    }
    try {
      await roleService.remove(removing.id);
      enqueueSnackbar('Papel excluído.', { variant: 'success' });
      setRemoving(null);
      await load();
    } catch (requestError) {
      // O caso comum: o papel ainda tem usuários. O backend nomeia o motivo.
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
      setRemoving(null);
    }
  }

  const state = (
    <DataState
      loading={loading}
      error={error}
      empty={roles.length === 0}
      emptyMessage="Nenhum papel cadastrado."
    />
  );

  return (
    <section aria-label="Papéis">
      <PageHeader
        title="Papéis"
        description="O que cada perfil de usuário pode fazer."
        action={
          can('roles.create') ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Novo papel
            </Button>
          ) : null
        }
      />

      {state ?? (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="Lista de papéis">
            <TableHead>
              <TableRow>
                <TableCell>Papel</TableCell>
                <TableCell>Código</TableCell>
                <TableCell>Permissões</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {role.name}
                      </Typography>
                      {role.isSystem ? (
                        <Tooltip title="Papel de sistema — as permissões são ajustáveis, mas ele não pode ser excluído">
                          <LockIcon fontSize="inherit" color="disabled" />
                        </Tooltip>
                      ) : null}
                    </Stack>
                    {role.description ? (
                      <Typography variant="caption" color="text.secondary">
                        {role.description}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={role.code} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {role.permissions.includes('*')
                      ? 'Todas'
                      : `${role.permissions.length} permissão(ões)`}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {can('roles.update') ? (
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            aria-label={`Editar ${role.name}`}
                            onClick={() => openEdit(role)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}

                      {can('roles.delete') && !role.isSystem ? (
                        <Tooltip title="Excluir">
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Excluir ${role.name}`}
                            onClick={() => setRemoving(role)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogTitle>{editing ? 'Editar papel' : 'Novo papel'}</DialogTitle>

          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Controller
                  name="code"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Código"
                      fullWidth
                      required
                      disabled={!!editing}
                      error={!!errors.code}
                      helperText={
                        errors.code?.message ??
                        (editing ? 'O código não muda depois de criado.' : 'Ex.: SUPERVISOR_LOJA')
                      }
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={8}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Nome"
                      fullWidth
                      required
                      error={!!errors.name}
                      helperText={errors.name?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      label="Descrição"
                      fullWidth
                      error={!!errors.description}
                      helperText={errors.description?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Permissões
                </Typography>
              </Grid>

              {grouped.map((group) => (
                <Grid item xs={12} sm={6} md={3} key={group.area}>
                  <Typography variant="caption" color="text.secondary">
                    {AREA_LABEL[group.area] ?? group.area}
                  </Typography>
                  <FormGroup>
                    {group.permissions.map((permission) => (
                      <FormControlLabel
                        key={permission}
                        control={
                          <Checkbox
                            size="small"
                            checked={selected.includes(permission)}
                            onChange={() => togglePermission(permission)}
                          />
                        }
                        label={actionLabel(permission)}
                      />
                    ))}
                  </FormGroup>
                </Grid>
              ))}
            </Grid>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={!!removing} onClose={() => setRemoving(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir papel</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Excluir <strong>{removing?.name}</strong>? Usuários que ainda usam este papel impedem a
            exclusão — mova-os para outro antes.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoving(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={() => void confirmRemove()}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
