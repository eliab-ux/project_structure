'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

const schema = yup
  .object({
    newPassword: yup
      .string()
      .min(8, 'Senha precisa ter ao menos 8 caracteres')
      .required('Senha é obrigatória'),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref('newPassword')], 'As senhas precisam coincidir')
      .required('Confirmação é obrigatória'),
  })
  .required();

type ResetPasswordFormValues = yup.InferType<typeof schema>;

function resolveAccessTokenFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const queryToken = parsed.searchParams.get('token');
    if (queryToken) {
      return queryToken;
    }
  } catch {
    // ignore invalid URL while still falling back to the hash
  }

  const [, hashFragment] = url.split('#');
  if (!hashFragment) {
    return undefined;
  }

  const cleanHash = hashFragment.replace(/^[?&]/, '');
  const hashParams = new URLSearchParams(cleanHash);
  return hashParams.get('access_token') ?? undefined;
}

export function ResetPasswordScreen() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string>();
  const [tokenChecked, setTokenChecked] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>();
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const token = resolveAccessTokenFromUrl(window.location.href);
    setAccessToken(token);
    setTokenChecked(true);
  }, []);

  useEffect(
    () => () => {
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current);
      }
    },
    [],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    if (!accessToken) {
      setStatus('error');
      setMessage(
        'Não foi possível encontrar o token de acesso. Reabra o link enviado para o seu email.',
      );
      return;
    }

    setStatus('loading');
    setMessage(undefined);

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, newPassword }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Não foi possível redefinir a senha.');
      }

      setStatus('success');
      setMessage(payload?.message ?? 'Senha atualizada com sucesso! Redirecionando para o login.');
      redirectTimer.current = setTimeout(() => router.push('/auth/login'), 2500);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Erro inesperado');
    }
  });

  const isSubmitDisabled = isSubmitting || !accessToken;

  return (
    <Paper elevation={3} sx={{ p: { xs: 3, md: 6 }, borderRadius: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          Redefinir senha
        </Typography>
        <Typography color="text.secondary">
          Escolha uma nova senha segura. O link enviado por email já contém o token necessário.
        </Typography>

        {status === 'loading' && <LinearProgress />}

        {status === 'success' && message ? (
          <Alert severity="success" variant="outlined">
            {message}
          </Alert>
        ) : null}

        {status === 'error' && message ? (
          <Alert severity="error" variant="outlined">
            {message}
          </Alert>
        ) : null}

        {tokenChecked && !accessToken ? (
          <Alert severity="warning" variant="outlined">
            Não encontramos o token informado. Reabra o link enviado por email para continuar.
          </Alert>
        ) : null}

        <Box component="form" noValidate onSubmit={onSubmit} sx={{ display: 'grid', gap: 16 }}>
          <TextField
            label="Nova senha"
            type="password"
            {...register('newPassword')}
            error={!!errors.newPassword}
            helperText={errors.newPassword?.message}
            fullWidth
            disabled={isSubmitting}
          />
          <TextField
            label="Confirmar senha"
            type="password"
            {...register('confirmPassword')}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
            fullWidth
            disabled={isSubmitting}
          />
          <Button variant="contained" size="large" type="submit" disabled={isSubmitDisabled}>
            Atualizar senha
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" align="center">
          Lembrou a senha?{' '}
          <Link href="/auth/login" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Voltar ao login
          </Link>
        </Typography>
      </Stack>
    </Paper>
  );
}
