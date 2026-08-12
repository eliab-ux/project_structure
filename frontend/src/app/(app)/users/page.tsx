'use client';

import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useSnackbar } from 'notistack';
import { IMaskInput } from 'react-imask';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import roleService from 'src/services/roleService';
import userService from 'src/services/userService';
import { AdminUser, Role } from 'src/types/admin';

/**
 * Usuários da conta (01_Veertex_Core §3.3).
 *
 * **O WhatsApp é obrigatório, e não por capricho de formulário.** A recuperação de senha é um
 * código enviado no WhatsApp (CLAUDE.md, regra 9); um usuário cadastrado sem número perde a conta
 * no primeiro esquecimento de senha, e só o suporte com acesso ao banco a devolve. Por isso o campo
 * é `required` aqui, o Request DTO do backend não o marca `@IsOptional()` e a coluna é `NOT NULL`.
 *
 * Usuário é desabilitado, nunca apagado: o histórico aponta para quem fez cada coisa.
 */

const MIN_PASSWORD = 8;

const schema = yup.object({
  name: yup.string().trim().required('Nome é obrigatório.').min(2).max(120),
  email: yup.string().trim().email('E-mail inválido.').required('E-mail é obrigatório.').max(255),
  phone: yup
    .string()
    .transform((_, original: string) => (original ?? '').replace(/\D/g, ''))
    .required('WhatsApp é obrigatório.')
    .matches(/^\d{10,11}$/, 'Informe DDD + número.'),
  roleId: yup.string().required('Papel é obrigatório.'),
  password: yup
    .string()
    .transform((value: string) => value ?? '')
    // Na EDIÇÃO a senha não é pedida; o schema é o mesmo e a obrigatoriedade é condicional.
    .when('$creating', {
      is: true,
      then: (rule) =>
        rule
          .required('Senha é obrigatória.')
          .min(MIN_PASSWORD, `A senha deve ter no mínimo ${MIN_PASSWORD} caracteres.`),
      otherwise: (rule) => rule.notRequired(),
    }),
});

type FormValues = yup.InferType<typeof schema>;

const EMPTY: FormValues = { name: '', email: '', phone: '', roleId: '', password: '' };

export default function UsersPage() {
  const { can, user: currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);

  const creating = !editing;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: EMPTY,
    context: { creating },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Em paralelo: a tela precisa das duas listas para renderizar uma linha, e encadeá-las
      // dobraria o tempo de abertura sem nenhum ganho.
      const [loadedUsers, loadedRoles] = await Promise.all([
        userService.list(),
        roleService.list(),
      ]);
      setUsers(loadedUsers);
      setRoles(loadedRoles);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar os usuários.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    reset(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditing(user);
    reset({
      name: user.name,
      email: user.email,
      // Chega em E.164 (+5562…); o campo mostra só DDD + número.
      phone: user.phone.replace(/^\+55/, ''),
      roleId: user.roleId,
      password: '',
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      if (editing) {
        await userService.update(editing.id, {
          name: values.name,
          email: values.email,
          phone: values.phone,
          roleId: values.roleId,
        });
        enqueueSnackbar('Usuário atualizado.', { variant: 'success' });
      } else {
        await userService.create({
          name: values.name,
          email: values.email,
          phone: values.phone,
          roleId: values.roleId,
          password: values.password as string,
        });
        enqueueSnackbar('Usuário criado.', { variant: 'success' });
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

  async function handleToggleActive(user: AdminUser) {
    const active = user.status === 'ACTIVE';
    try {
      await userService.setActive(user.id, !active);
      enqueueSnackbar(active ? 'Usuário desabilitado.' : 'Usuário reabilitado.', {
        variant: 'success',
      });
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    }
  }

  const roleName = (roleId: string) => roles.find((role) => role.id === roleId)?.name ?? '—';

  const state = (
    <DataState
      loading={loading}
      error={error}
      empty={users.length === 0}
      emptyMessage="Nenhum usuário cadastrado."
    />
  );

  return (
    <section aria-label="Usuários">
      <PageHeader
        title="Usuários"
        description="Quem entra no sistema, e com qual papel."
        action={
          can('users.create') ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Novo usuário
            </Button>
          ) : null
        }
      />

      {state ?? (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="Lista de usuários">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>E-mail</TableCell>
                <TableCell>WhatsApp</TableCell>
                <TableCell>Papel</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => {
                const active = user.status === 'ACTIVE';
                const isSelf = user.id === currentUser?.id;
                return (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {user.name}
                      </Typography>
                      {isSelf ? (
                        <Typography variant="caption" color="text.secondary">
                          você
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>{roleName(user.roleId)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={active ? 'Ativo' : 'Desabilitado'}
                        color={active ? 'success' : 'default'}
                        variant={active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {can('users.update') ? (
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              aria-label={`Editar ${user.name}`}
                              onClick={() => openEdit(user)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}

                        {can('users.disable') ? (
                          // Desabilitar a si mesmo tranca o usuário para fora na hora. O backend
                          // também recusa; aqui a diferença é não oferecer o botão.
                          <Tooltip
                            title={
                              isSelf
                                ? 'Você não pode desabilitar a si mesmo'
                                : active
                                  ? 'Desabilitar'
                                  : 'Reabilitar'
                            }
                          >
                            <span>
                              <Switch
                                size="small"
                                checked={active}
                                disabled={isSelf}
                                onChange={() => void handleToggleActive(user)}
                                inputProps={{
                                  'aria-label': `${active ? 'Desabilitar' : 'Reabilitar'} ${user.name}`,
                                }}
                              />
                            </span>
                          </Tooltip>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogTitle>{editing ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>

          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}>
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

              <Grid item xs={12} sm={7}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="E-mail"
                      type="email"
                      fullWidth
                      required
                      error={!!errors.email}
                      helperText={errors.email?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={5}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="WhatsApp"
                      fullWidth
                      required
                      error={!!errors.phone}
                      helperText={
                        errors.phone?.message ?? 'É por aqui que chega o código de recuperação.'
                      }
                      InputProps={{
                        inputComponent: IMaskInput as never,
                        inputProps: { mask: '(00) 00000-0000', unmask: true },
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={editing ? 12 : 6}>
                <Controller
                  name="roleId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Papel"
                      fullWidth
                      required
                      error={!!errors.roleId}
                      helperText={errors.roleId?.message}
                    >
                      {roles.map((role) => (
                        <MenuItem key={role.id} value={role.id}>
                          {role.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>

              {!editing ? (
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Senha inicial"
                        type="password"
                        fullWidth
                        required
                        autoComplete="new-password"
                        error={!!errors.password}
                        helperText={errors.password?.message}
                      />
                    )}
                  />
                </Grid>
              ) : null}
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
    </section>
  );
}
