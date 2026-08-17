'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import userService from 'src/services/userService';
import { apiErrorMessage } from 'src/services/api';
import { USER_ROLE_LABELS, UserRole } from 'src/types/auth';
import { TeamUser, formatLastLogin, formatPhone } from 'src/types/user';
import { numericSx } from 'src/theme/theme';

interface UserForm {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  initialPassword: string;
}

const EMPTY_FORM: UserForm = {
  name: '',
  email: '',
  phone: '',
  role: 'modelista',
  initialPassword: '',
};

export default function TeamPage() {
  const { user: currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [open, setOpen] = useState(false);

  // Só o dono cria ou edita outro dono (§5). O admin não vê a opção — e o backend recusa de
  // qualquer forma, com 403, mesmo que alguém force a requisição.
  const canManageOwners = currentUser?.role === 'owner';
  const availableRoles: UserRole[] = canManageOwners
    ? ['modelista', 'admin', 'owner']
    : ['modelista', 'admin'];

  /**
   * Telefone de terceiro é exclusivo do dono (spec §6.12): trocar o número de alguém equivale a
   * tomar a conta dele, porque é para lá que vai o código de recuperação de senha.
   *
   * Desabilitar o campo é cortesia, não proteção — quem manda é o 403 do backend. O que a tela
   * evita é o Administrativo digitar um número novo, salvar e só então descobrir que não podia.
   */
  const editingSomeoneElse = Boolean(editing && editing.id !== currentUser?.id);
  const phoneLocked = editingSomeoneElse && !canManageOwners;

  const load = useCallback(async () => {
    try {
      setUsers(await userService.list());
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar a equipe.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(target: TeamUser) {
    setEditing(target);
    setForm({
      name: target.name,
      email: target.email,
      phone: formatPhone(target.phone),
      role: target.role,
      initialPassword: '',
    });
    setOpen(true);
  }

  async function submit() {
    try {
      if (editing) {
        const saved = await userService.update(editing.id, {
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
        });
        setUsers((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        enqueueSnackbar('Usuário atualizado.', { variant: 'success' });
      } else {
        const created = await userService.create(form);
        setUsers((current) => [...current, created]);
        enqueueSnackbar('Usuário criado. Ele troca a senha no primeiro login.', {
          variant: 'success',
        });
      }
      setOpen(false);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível salvar o usuário.'), {
        variant: 'error',
      });
    }
  }

  async function toggleActive(target: TeamUser) {
    try {
      const saved = await userService.setActive(target.id, !target.isActive);
      setUsers((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível alterar a situação.'), {
        variant: 'error',
      });
    }
  }

  if (loading) {
    return (
      <Box
        role="status"
        aria-label="Carregando"
        sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Todo mundo da equipe é usuário do sistema — não existe nome sem login."
        action={<Button onClick={openCreate}>+ Novo usuário</Button>}
      />

      <Paper variant="outlined" component="section" aria-label="Usuários" sx={{ p: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>E-mail (login)</TableCell>
              <TableCell>WhatsApp</TableCell>
              <TableCell>Papel</TableCell>
              <TableCell>Último acesso</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((item) => (
              <TableRow key={item.id} sx={{ opacity: item.isActive ? 1 : 0.6 }}>
                <TableCell sx={{ fontWeight: 600 }}>{item.name}</TableCell>
                <TableCell>{item.email}</TableCell>
                <TableCell sx={numericSx}>{formatPhone(item.phone)}</TableCell>
                <TableCell>{USER_ROLE_LABELS[item.role]}</TableCell>
                <TableCell sx={numericSx}>{formatLastLogin(item.lastLoginAt)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={item.isActive ? 'Ativo' : 'Inativo'}
                    color={item.isActive ? 'success' : 'default'}
                    variant={item.isActive ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="outlined" onClick={() => openEdit(item)}>
                      Editar
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => toggleActive(item)}>
                      {item.isActive ? 'Inativar' : 'Reativar'}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: '80ch' }}>
        Desligamento inativa, nunca apaga. Os apontamentos e pagamentos guardam quem fez — apagar o
        usuário quebraria a autoria do histórico.
      </Typography>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
        <DialogContent>
          {!editing && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Você cria o acesso; ele troca a senha no primeiro login.
            </Alert>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome completo"
              fullWidth
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <TextField
              label="E-mail (será o login)"
              type="email"
              fullWidth
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <TextField
              label="WhatsApp"
              fullWidth
              value={form.phone}
              disabled={phoneLocked}
              helperText={
                phoneLocked
                  ? 'Só o dono altera o telefone de outra pessoa — é para esse número que vai o código de recuperação de senha. Cada um altera o seu em Meu perfil.'
                  : 'Obrigatório: é por ele que chega o código de recuperação de senha.'
              }
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            <TextField
              select
              label="Papel"
              fullWidth
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
            >
              {availableRoles.map((role) => (
                <MenuItem key={role} value={role}>
                  {USER_ROLE_LABELS[role]}
                </MenuItem>
              ))}
            </TextField>
            {!editing && (
              <TextField
                label="Senha inicial"
                type="password"
                fullWidth
                value={form.initialPassword}
                helperText="Mínimo de 8 caracteres."
                onChange={(event) => setForm({ ...form, initialPassword: event.target.value })}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{editing ? 'Salvar' : 'Criar usuário'}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
