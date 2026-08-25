'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';
import authService from 'src/services/authService';

type Step = 'request' | 'reset';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestReset() {
    setBusy(true);
    try {
      await authService.requestPasswordReset(email);
      enqueueSnackbar('Se o e-mail existir, enviamos um código.', { variant: 'info' });
      setStep('reset');
    } catch {
      enqueueSnackbar('Erro ao solicitar recuperação.', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function doReset() {
    if (senha.length < 6) {
      enqueueSnackbar('Senha deve ter no mínimo 6 caracteres.', { variant: 'warning' });
      return;
    }
    setBusy(true);
    try {
      await authService.resetPassword(code, senha);
      enqueueSnackbar('Senha alterada com sucesso!', { variant: 'success' });
      router.replace('/auth/login');
    } catch {
      enqueueSnackbar('Código inválido ou expirado.', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      component="main"
      sx={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent component="section">
          <Typography variant="h3" color="primary" gutterBottom>
            Recuperar senha
          </Typography>
          {step === 'request' ? (
            <Stack spacing={2}>
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button variant="contained" onClick={requestReset} disabled={busy || !email}>
                Enviar código
              </Button>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <TextField
                label="Código recebido"
                fullWidth
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <TextField
                label="Nova senha"
                type="password"
                fullWidth
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <Button variant="contained" onClick={doReset} disabled={busy || !code}>
                Alterar senha
              </Button>
            </Stack>
          )}
          <MuiLink
            component={Link}
            href="/auth/login"
            variant="body2"
            sx={{ mt: 2, display: 'inline-block' }}
          >
            Voltar ao login
          </MuiLink>
        </CardContent>
      </Card>
    </Box>
  );
}
