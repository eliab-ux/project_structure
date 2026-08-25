'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Alert,
  Box,
  Button,
  Container,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useResellerAuth } from '@/hooks/useResellerAuth';

const schema = yup.object({
  email: yup.string().email('Email inválido').required('Email é obrigatório'),
  password: yup
    .string()
    .min(8, 'Senha precisa ter ao menos 8 caracteres')
    .required('Senha é obrigatória'),
});

type LoginFormValues = yup.InferType<typeof schema>;

export function LoginScreen() {
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>();
  const [resellerPreview, setResellerPreview] = useState<{
    uniqueLink: string;
    status: string;
    level: string;
  }>();
  const { login } = useResellerAuth();

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
  } = useForm<LoginFormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus('loading');
    setMessage(undefined);
    setResellerPreview(undefined);

    try {
      const payload = await login(values.email, values.password);

      setStatus('success');
      setMessage('Login realizado. Redirecionando para o painel...');
      if (payload.reseller) {
        setResellerPreview({
          uniqueLink: payload.reseller.uniqueLink,
          status: payload.reseller.status,
          level: payload.reseller.level,
        });
      }

      // Redirect to dashboard after 1.5 seconds
      redirectTimer.current = setTimeout(() => {
        router.push('/reseller/dashboard');
      }, 1500);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Erro inesperado');
    }
  });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #F5F5F5 0%, #FFFFFF 40%)',
        display: 'flex',
        alignItems: 'center',
        py: 8,
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: { xs: 3, md: 6 }, borderRadius: 4 }}>
          <Stack spacing={3}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              component={Link}
              href="/"
              sx={{ textDecoration: 'none' }}
            >
              <ArrowBackIcon color="action" />
              <Typography variant="body2" color="text.secondary">
                Voltar para o catálogo
              </Typography>
            </Stack>

            <Typography variant="h4" component="h1">
              Portal do Revendedor
            </Typography>
            <Typography color="text.secondary">
              Acesse métricas, links únicos e suas comissões em um único lugar seguro.
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
              <Stack spacing={2}>
                <TextField
                  label="Email cadastrado"
                  type="email"
                  {...register('email')}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  fullWidth
                />
                <TextField
                  label="Senha"
                  type="password"
                  {...register('password')}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  fullWidth
                />
              </Stack>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={isSubmitting}
              >
                Entrar no portal
              </Button>
            </Box>

            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary" align="center">
                <Link href="/auth/forgot-password" style={{ textDecoration: 'underline' }}>
                  Esqueci minha senha
                </Link>
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center">
                <Link href="/admin/login" style={{ textDecoration: 'underline', color: '#1976d2' }}>
                  Acessar Portal Admin
                </Link>
              </Typography>
            </Stack>

            {resellerPreview ? (
              <Stack spacing={1} sx={{ pt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Link único
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  kazatem.shop/r/{resellerPreview.uniqueLink}
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Typography variant="body2">Status: {resellerPreview.status}</Typography>
                  <Typography variant="body2">Nível: {resellerPreview.level}</Typography>
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
