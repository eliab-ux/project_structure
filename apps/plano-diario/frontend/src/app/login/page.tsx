'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { useAuth } from 'src/context/AuthContext';
import { errorMessage } from 'src/services/api';

interface LoginForm {
  email: string;
  password: string;
}

const schema = yup.object({
  email: yup.string().email('E-mail inválido').required('E-mail obrigatório'),
  password: yup.string().required('Senha obrigatória'),
});

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: yupResolver(schema) });

  async function onSubmit(values: LoginForm) {
    setError(null);
    try {
      await signIn(values.email, values.password);
      router.push('/');
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível entrar'));
    }
  }

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 8 }}>
      <Box component="section" sx={{ mb: 3, textAlign: 'center' }}>
        <Typography component="h1" variant="h1" gutterBottom>
          Plano Diário
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Entre para configurar o envio automático da leitura no seu grupo.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2}>
              {error && (
                <Alert role="alert" severity="error">
                  {error}
                </Alert>
              )}
              <TextField
                label="E-mail"
                type="email"
                autoComplete="email"
                fullWidth
                error={!!errors.email}
                helperText={errors.email?.message}
                {...register('email')}
              />
              <TextField
                label="Senha"
                type="password"
                autoComplete="current-password"
                fullWidth
                error={!!errors.password}
                helperText={errors.password?.message}
                {...register('password')}
              />
              <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                {isSubmitting ? 'Entrando…' : 'Entrar'}
              </Button>
              <Typography variant="body2" align="center">
                <Link component={NextLink} href="/esqueci-senha">
                  Esqueci minha senha
                </Link>
              </Typography>
              <Typography variant="body2" align="center" color="text.secondary">
                Não tem conta?{' '}
                <Link component={NextLink} href="/registrar">
                  Criar conta
                </Link>
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
