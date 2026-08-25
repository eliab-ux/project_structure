'use client';

import { useState } from 'react';
import Link from 'next/link';
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

const schema = yup.object({
  email: yup.string().email('Email inválido').required('Email é obrigatório'),
});

type ForgotPasswordFormValues = yup.InferType<typeof schema>;

export function ForgotPasswordScreen() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: yupResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setStatus('loading');
    setMessage(undefined);

    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Não foi possível solicitar a redefinição');
      }

      setStatus('success');
      setMessage(
        payload?.message ?? 'Enviamos um link seguro para o email informado, caso exista.',
      );
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Erro inesperado');
    }
  });

  return (
    <Paper elevation={3} sx={{ p: { xs: 3, md: 6 }, borderRadius: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          Recuperar senha
        </Typography>
        <Typography color="text.secondary">
          Informe o email cadastrado para receber um link seguro de redefinição.
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

        <Box component="form" noValidate onSubmit={onSubmit} sx={{ display: 'grid', gap: 16 }}>
          <TextField
            label="Email cadastrado"
            type="email"
            {...register('email')}
            error={!!errors.email}
            helperText={errors.email?.message}
            fullWidth
          />

          <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
            Enviar link de redefinição
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Lembrou a senha?{' '}
          <Link href="/auth/login" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Voltar ao login
          </Link>
        </Typography>
      </Stack>
    </Paper>
  );
}
