'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useSnackbar } from 'notistack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';

const loginSchema = yup.object({
  email: yup.string().email('E-mail inválido').required('E-mail obrigatório'),
  // Only "present" — no strength rule at login. Enforcing the current policy here would refuse a
  // password that predates it, and telling a stranger what the policy is has no upside.
  password: yup.string().required('Senha obrigatória'),
});

type LoginForm = yup.InferType<typeof loginSchema>;

/**
 * Login (FASE 10, screen 1).
 *
 * Recovery lives on its own route, `/reset-password`, because it is now two steps: ask for a code,
 * then type the code that arrived on WhatsApp. Keeping a copy of step one here would mean two forms
 * to keep in sync with the same endpoint.
 */
export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);

  const loginForm = useForm<LoginForm>({ resolver: yupResolver(loginSchema) });

  // Already signed in: send them on. Inside an effect, because redirecting during render is a React
  // warning waiting to happen.
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  async function onLogin(values: LoginForm) {
    setSubmitting(true);
    try {
      await signIn(values.email, values.password);
      router.replace('/dashboard');
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'E-mail ou senha inválidos.'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container
      component="main"
      maxWidth="xs"
      sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}
    >
      <Paper sx={{ p: 4, width: '100%' }} elevation={0} variant="outlined">
        <Box component="header" sx={{ mb: 3 }}>
          <Typography variant="h1" sx={{ fontSize: '1.75rem' }} gutterBottom>
            Batuta
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Entre com sua conta do gabinete.
          </Typography>
        </Box>

        <Box component="form" onSubmit={loginForm.handleSubmit(onLogin)} noValidate>
          <Stack spacing={2}>
            <TextField
              label="E-mail"
              type="email"
              autoComplete="email"
              autoFocus
              fullWidth
              {...loginForm.register('email')}
              error={Boolean(loginForm.formState.errors.email)}
              helperText={loginForm.formState.errors.email?.message}
            />
            <TextField
              label="Senha"
              type="password"
              autoComplete="current-password"
              fullWidth
              {...loginForm.register('password')}
              error={Boolean(loginForm.formState.errors.password)}
              helperText={loginForm.formState.errors.password?.message}
            />
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
            <Link href="/reset-password" variant="body2" sx={{ alignSelf: 'center' }}>
              Esqueci minha senha
            </Link>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
