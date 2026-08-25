'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VideocamIcon from '@mui/icons-material/Videocam';
import SendIcon from '@mui/icons-material/Send';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import { useAuth } from 'src/context/AuthContext';
import pacienteService from 'src/services/pacienteService';
import sessionService from 'src/services/sessionService';
import { Paciente } from 'src/types';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [linkMenu, setLinkMenu] = useState<{ anchor: HTMLElement; paciente: Paciente } | null>(
    null,
  );
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [user, loading, router]);

  const loadPacientes = useCallback(async () => {
    try {
      setPacientes(await pacienteService.list());
    } catch {
      enqueueSnackbar('Erro ao carregar pacientes.', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (user) {
      void loadPacientes();
    }
  }, [user, loadPacientes]);

  // Presença dos pacientes (🟢 online) — poll a cada 5s enquanto o dashboard está aberto.
  useEffect(() => {
    if (!user) return undefined;
    const poll = () => {
      pacienteService
        .online()
        .then((ids) => setOnlineIds(new Set(ids)))
        .catch(() => undefined);
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [user]);

  async function startSession(paciente: Paciente) {
    try {
      const session = await sessionService.create(paciente.id);
      enqueueSnackbar('Sessão criada!', { variant: 'success' });
      router.push(`/emdr/${session.sessionCode}?role=psicologo`);
    } catch {
      enqueueSnackbar('Erro ao iniciar sessão.', { variant: 'error' });
    }
  }

  async function sendLink(paciente: Paciente, channel: 'whatsapp' | 'email') {
    setLinkMenu(null);
    setSending(true);
    try {
      await sessionService.sendLink(paciente.id, channel);
      enqueueSnackbar(
        channel === 'whatsapp'
          ? `Link enviado por WhatsApp para ${paciente.nome}.`
          : `Link enviado por e-mail para ${paciente.nome}.`,
        { variant: 'success' },
      );
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Erro ao enviar o link.';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSending(false);
    }
  }

  async function removePaciente(id: string) {
    try {
      await pacienteService.remove(id);
      await loadPacientes();
    } catch {
      enqueueSnackbar('Erro ao remover paciente.', { variant: 'error' });
    }
  }

  if (loading || !user) {
    return (
      <Box
        sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}
        role="status"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <AppBar position="static" color="primary" component="header">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            EMDR Remoto
          </Typography>
          <Tooltip title="Conexão WhatsApp">
            <IconButton
              color="inherit"
              onClick={() => router.push('/whatsapp')}
              aria-label="WhatsApp"
            >
              <WhatsAppIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="body2" sx={{ mx: 2 }}>
            {user.nome}
          </Typography>
          <Button color="inherit" onClick={logout}>
            Sair
          </Button>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="md" sx={{ py: 4 }}>
        <Card component="section">
          <CardContent>
            <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h3" sx={{ flexGrow: 1 }}>
                Meus pacientes
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => router.push('/pacientes/novo')}
              >
                Novo paciente
              </Button>
            </Stack>

            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>E-mail</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pacientes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{p.nome}</span>
                        {onlineIds.has(p.id) && (
                          <Chip
                            size="small"
                            color="success"
                            label="🟢 online"
                            sx={{ height: 20, fontWeight: 700 }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Enviar link da sessão">
                        <IconButton
                          color="success"
                          aria-label="Enviar link"
                          disabled={sending}
                          onClick={(e) => setLinkMenu({ anchor: e.currentTarget, paciente: p })}
                        >
                          <SendIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Iniciar sessão agora">
                        <IconButton
                          color="primary"
                          aria-label="Iniciar sessão"
                          onClick={() => startSession(p)}
                        >
                          <VideocamIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton
                          aria-label="Editar"
                          onClick={() => router.push(`/pacientes/${p.id}`)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remover">
                        <IconButton
                          color="error"
                          aria-label="Remover"
                          onClick={() => removePaciente(p.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {pacientes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      Nenhum paciente cadastrado ainda. Clique em “Novo paciente”.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Container>

      {/* Menu: enviar link por WhatsApp ou E-mail */}
      <Menu anchorEl={linkMenu?.anchor} open={Boolean(linkMenu)} onClose={() => setLinkMenu(null)}>
        <MenuItem onClick={() => linkMenu && sendLink(linkMenu.paciente, 'whatsapp')}>
          <ListItemIcon>
            <WhatsAppIcon fontSize="small" color="success" />
          </ListItemIcon>
          Enviar por WhatsApp
        </MenuItem>
        <MenuItem onClick={() => linkMenu && sendLink(linkMenu.paciente, 'email')}>
          <ListItemIcon>
            <EmailIcon fontSize="small" color="primary" />
          </ListItemIcon>
          Enviar por E-mail
        </MenuItem>
      </Menu>
    </>
  );
}
