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
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { PhoneField } from 'src/components/PhoneField/PhoneField';
import { useAuth } from 'src/context/AuthContext';
import { errorMessage } from 'src/services/api';
import authService from 'src/services/authService';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  phone: string;
}

const schema = yup.object({
  name: yup.string().min(2, 'Mínimo 2 caracteres').max(120).required('Nome obrigatório'),
  email: yup.string().email('E-mail inválido').required('E-mail obrigatório'),
  // 8 e 72 são os limites do backend (72 é o máximo real do bcrypt).
  password: yup
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(72, 'Máximo 72 caracteres')
    .required('Senha obrigatória'),
  // 15 caracteres = "(11) 91234-5678" completo. A regra de verdade (DDD, nono dígito) é do
  // backend; aqui só se cobra que a máscara esteja preenchida até o fim.
  phone: yup.string().min(15, 'Informe o WhatsApp com DDD').required('WhatsApp obrigatório'),
});

export default function RegisterPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: yupResolver(schema) });

  async function onSubmit(values: RegisterForm) {
    setError(null);
    try {
      await authService.register(values.name, values.email, values.password, values.phone);
      // Já entra logado: pedir para digitar a senha de novo não agrega nada.
      await signIn(values.email, values.password);
      enqueueSnackbar('Conta criada', { variant: 'success' });
      router.push('/whatsapp');
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível criar a conta'));
    }
  }

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 8 }}>
      <Box component="section" sx={{ mb: 3, textAlign: 'center' }}>
        <Typography component="h1" variant="h1" gutterBottom>
          Criar conta
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Depois você conecta seu WhatsApp e escolhe o grupo.
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
                label="Nome"
                fullWidth
                error={!!errors.name}
                helperText={errors.name?.message}
                {...register('name')}
              />
              <TextField
                label="E-mail"
                type="email"
                autoComplete="email"
                fullWidth
                error={!!errors.email}
                helperText={errors.email?.message}
                {...register('email')}
              />
              <PhoneField
                label="WhatsApp"
                fullWidth
                error={!!errors.phone}
                helperText={
                  errors.phone?.message ??
                  'Usado para recuperar sua senha, caso você esqueça. Não é o grupo — é o seu número.'
                }
                {...register('phone')}
              />
              <TextField
                label="Senha"
                type="password"
                autoComplete="new-password"
                fullWidth
                error={!!errors.password}
                helperText={errors.password?.message ?? 'Mínimo 8 caracteres'}
                {...register('password')}
              />
              <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                {isSubmitting ? 'Criando…' : 'Criar conta'}
              </Button>
              <Typography variant="body2" align="center" color="text.secondary">
                Já tem conta?{' '}
                <Link component={NextLink} href="/login">
                  Entrar
                </Link>
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
