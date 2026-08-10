'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useSnackbar } from 'notistack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MuiLink from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AuthLayout } from 'src/components/AuthLayout';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';

const validationSchema = yup.object({
  email: yup.string().email('E-mail inválido').required('E-mail obrigatório'),
  password: yup.string().required('Senha obrigatória'),
});

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginFormValues) {
    setSubmitting(true);
    try {
      await signIn(values.email, values.password);
      router.replace('/dashboard');
    } catch (error) {
      // The API answers the same "E-mail ou senha inválidos" for an unknown e-mail and a wrong
      // password, and this shows it verbatim — distinguishing them here would undo that.
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível entrar.'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Entrar" subtitle="Acesse com seu e-mail e senha.">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2}>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            autoFocus
            error={!!errors.email}
            helperText={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={!!errors.password}
            helperText={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </Stack>
      </Box>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <MuiLink component={Link} href="/forgot-password" variant="body2">
          Esqueci minha senha
        </MuiLink>
      </Box>
    </AuthLayout>
  );
}
