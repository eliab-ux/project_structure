'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useAuth } from 'src/context/AuthContext';
import whatsappService, { WhatsappStatus } from 'src/services/whatsappService';

export default function WhatsappConfigPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [status, setStatus] = useState<WhatsappStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    try {
      setStatus(await whatsappService.status());
    } catch {
      enqueueSnackbar('Erro ao carregar status do WhatsApp.', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  // Enquanto for instância própria não pareada, faz polling para detectar a conexão.
  useEffect(() => {
    if (status?.mode === 'own' && !status.connected) {
      pollRef.current = setInterval(refresh, 4000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    return undefined;
  }, [status?.mode, status?.connected, refresh]);

  async function setup(mode: 'shared' | 'own') {
    setBusy(true);
    try {
      setStatus(await whatsappService.setup(mode));
      enqueueSnackbar(
        mode === 'shared' ? 'Usando a conexão compartilhada.' : 'Instância criada. Leia o QR Code.',
        { variant: 'success' },
      );
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Erro ao configurar WhatsApp.';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await whatsappService.disconnect();
      await refresh();
      enqueueSnackbar('WhatsApp desconectado.', { variant: 'info' });
    } finally {
      setBusy(false);
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

  const qrSrc = status?.qrBase64
    ? status.qrBase64.startsWith('data:')
      ? status.qrBase64
      : `data:image/png;base64,${status.qrBase64}`
    : null;

  return (
    <>
      <AppBar position="static" color="primary" component="header">
        <Toolbar>
          <Button
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/dashboard')}
          >
            Voltar
          </Button>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 1 }}>
            WhatsApp
          </Typography>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="sm" sx={{ py: 4 }}>
        <Card component="section">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <WhatsAppIcon color="success" />
              <Typography variant="h3" sx={{ flexGrow: 1 }}>
                Conexão WhatsApp
              </Typography>
              {status?.configured && (
                <Chip
                  size="small"
                  color={status.connected ? 'success' : 'warning'}
                  label={status.connected ? 'Conectado' : 'Aguardando'}
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Envie o link das sessões por WhatsApp. Use a conexão compartilhada da clínica ou
              conecte o seu próprio número.
            </Typography>

            {!status ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Stack spacing={2}>
                {status.configured && (
                  <Chip
                    label={`Modo atual: ${status.mode === 'own' ? 'Meu número (instância própria)' : 'Compartilhado (emdr)'}`}
                    variant="outlined"
                    sx={{ alignSelf: 'flex-start' }}
                  />
                )}

                {/* QR da instância própria não pareada */}
                {status.mode === 'own' && !status.connected && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho → leia o
                      QR:
                    </Typography>
                    {qrSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrSrc}
                        alt="QR Code do WhatsApp"
                        style={{ width: 240, height: 240 }}
                      />
                    ) : (
                      <CircularProgress />
                    )}
                    <Typography variant="caption" display="block" color="text.secondary">
                      Detectando conexão automaticamente…
                    </Typography>
                  </Box>
                )}

                <Divider />

                <Stack spacing={1}>
                  {status.hasShared && (
                    <Button
                      variant={status.mode === 'shared' ? 'contained' : 'outlined'}
                      onClick={() => setup('shared')}
                      disabled={busy}
                    >
                      Usar conexão compartilhada (emdr)
                    </Button>
                  )}
                  <Button
                    variant={status.mode === 'own' ? 'contained' : 'outlined'}
                    startIcon={<WhatsAppIcon />}
                    onClick={() => setup('own')}
                    disabled={busy || !status.canCreateOwn}
                  >
                    Conectar meu número (QR Code)
                  </Button>
                  {!status.canCreateOwn && (
                    <Typography variant="caption" color="text.secondary">
                      Instância própria indisponível — a chave global do Evolution não está
                      configurada no servidor.
                    </Typography>
                  )}
                  {status.configured && (
                    <Button color="error" onClick={disconnect} disabled={busy}>
                      Desconectar
                    </Button>
                  )}
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Container>
    </>
  );
}
