'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from 'src/components/AppShell/AppShell';
import { StatusChip } from 'src/components/StatusChip/StatusChip';
import { errorMessage } from 'src/services/api';
import whatsappService from 'src/services/whatsappService';
import { ConnectionStatus } from 'src/types';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

export default function WhatsappPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [status, setStatus] = useState<ConnectionStatus>(null);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [pollingSince, setPollingSince] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setPollingSince(null);
  }, []);

  useEffect(() => {
    whatsappService
      .getInstance()
      .then((data) => {
        setStatus(data.status);
        setConnectedNumber(data.connectedNumber);
      })
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
    return stopPolling;
  }, [stopPolling]);

  // Polling do status enquanto o QR está na tela (máx. 2 min, como a spec pede).
  useEffect(() => {
    if (!qrCode || timer.current) {
      return;
    }
    const startedAt = Date.now();
    setPollingSince(startedAt);
    timer.current = setInterval(async () => {
      try {
        const data = await whatsappService.getStatus();
        setStatus(data.status);
        setConnectedNumber(data.connectedNumber);
        if (data.status === 'connected') {
          setQrCode(null);
          stopPolling();
          enqueueSnackbar('WhatsApp conectado', { variant: 'success' });
        } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setQrCode(null);
          stopPolling();
        }
      } catch {
        // Falha momentânea de rede não interrompe o pareamento — a próxima tentativa resolve.
      }
    }, POLL_INTERVAL_MS);
  }, [qrCode, stopPolling, enqueueSnackbar]);

  async function handleConnect() {
    setWorking(true);
    try {
      const qr = await whatsappService.connect();
      setStatus(qr.status as ConnectionStatus);
      setQrCode(qr.qrCodeBase64 ?? null);
      if (!qr.qrCodeBase64 && qr.status === 'connected') {
        enqueueSnackbar('Seu WhatsApp já está conectado', { variant: 'info' });
      }
    } catch (err) {
      enqueueSnackbar(errorMessage(err, 'Não foi possível gerar o QR Code'), { variant: 'error' });
    } finally {
      setWorking(false);
    }
  }

  async function handleDisconnect() {
    if (
      !window.confirm(
        'Desconectar o WhatsApp? O envio diário para de funcionar até você parear de novo.',
      )
    ) {
      return;
    }
    setWorking(true);
    try {
      await whatsappService.logout();
      setStatus('disconnected');
      setConnectedNumber(null);
      setQrCode(null);
      stopPolling();
      enqueueSnackbar('WhatsApp desconectado', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    } finally {
      setWorking(false);
    }
  }

  async function handleRemove() {
    if (
      !window.confirm('Remover a conexão por completo? Você precisará ler um QR Code novo depois.')
    ) {
      return;
    }
    setWorking(true);
    try {
      await whatsappService.remove();
      setStatus(null);
      setConnectedNumber(null);
      setQrCode(null);
      stopPolling();
      enqueueSnackbar('Conexão removida', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    } finally {
      setWorking(false);
    }
  }

  return (
    <AppShell>
      <Typography component="h1" variant="h2" gutterBottom>
        WhatsApp
      </Typography>

      {loading ? (
        <Box
          role="status"
          aria-label="Carregando"
          sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          <Card component="section">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Stack spacing={0.5}>
                  <Typography variant="overline" color="text.secondary">
                    Status da conexão
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <StatusChip status={status} />
                    {connectedNumber && (
                      <Typography variant="body2" color="text.secondary">
                        {connectedNumber}
                      </Typography>
                    )}
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={1}>
                  {status === 'connected' ? (
                    <>
                      <Button size="small" onClick={handleDisconnect} disabled={working}>
                        Desconectar
                      </Button>
                      <Button size="small" color="error" onClick={handleRemove} disabled={working}>
                        Remover
                      </Button>
                    </>
                  ) : (
                    <Button variant="contained" onClick={handleConnect} disabled={working}>
                      {qrCode ? 'Gerar novo QR' : 'Conectar WhatsApp'}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {qrCode && (
            <Card component="section">
              <CardContent>
                <Stack spacing={2} alignItems="center">
                  <Typography variant="h4" component="h2">
                    Escaneie no seu celular
                  </Typography>
                  <Typography variant="body2" color="text.secondary" align="center">
                    WhatsApp → <strong>Aparelhos conectados</strong> → Conectar um aparelho. O
                    código expira em cerca de 60 segundos.
                  </Typography>
                  <Box
                    component="img"
                    src={qrCode}
                    alt="QR Code para conectar o WhatsApp"
                    sx={{
                      width: { xs: 260, sm: 300 },
                      height: { xs: 260, sm: 300 },
                      p: 1,
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  />
                  {pollingSince && (
                    <Stack role="status" direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Aguardando o pareamento…
                      </Typography>
                    </Stack>
                  )}
                  <Button size="small" onClick={handleConnect} disabled={working}>
                    Gerar novo QR
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {status === 'connected' && (
            <Alert
              severity="success"
              action={
                <Button size="small" onClick={() => router.push('/configuracao')}>
                  Configurar envio
                </Button>
              }
            >
              WhatsApp conectado. Agora escolha o grupo e o horário.
            </Alert>
          )}
        </Stack>
      )}
    </AppShell>
  );
}
