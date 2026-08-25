'use client';

import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSnackbar } from 'notistack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';
import { useAuth } from 'src/context/AuthContext';

interface LoginForm {
  email: string;
  senha: string;
}

const schema = yup.object({
  email: yup.string().email('E-mail inválido').required('E-mail obrigatório'),
  senha: yup.string().min(6, 'Mínimo 6 caracteres').required('Senha obrigatória'),
});

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: yupResolver(schema) });

  async function onSubmit(values: LoginForm) {
    try {
      await login(values.email, values.senha);
      router.replace('/dashboard');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Não foi possível entrar. Verifique suas credenciais.';
      enqueueSnackbar(message, { variant: 'error' });
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
          <Typography variant="h2" color="primary" gutterBottom>
            EMDR Remoto
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Acesso do psicólogo
          </Typography>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2}>
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message}
              />
              <TextField
                label="Senha"
                type="password"
                fullWidth
                {...register('senha')}
                error={!!errors.senha}
                helperText={errors.senha?.message}
              />
              <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                Entrar
              </Button>
            </Stack>
          </form>
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
            <MuiLink component={Link} href="/auth/forgot-password" variant="body2">
              Esqueci a senha
            </MuiLink>
            <MuiLink component={Link} href="/auth/register" variant="body2">
              Criar conta
            </MuiLink>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
