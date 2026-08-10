'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MuiLink from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AuthLayout } from 'src/components/AuthLayout';
import authService from 'src/services/authService';
import { apiErrorMessage } from 'src/services/api';

const validationSchema = yup.object({
  email: yup.string().email('E-mail inválido').required('E-mail obrigatório'),
});

interface ForgotPasswordFormValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    setSubmitting(true);
    try {
      await authService.requestPasswordReset(values.email);
      // Shown whether or not the account exists — the API answers 204 either way, and saying "esse
      // e-mail não está cadastrado" would turn this screen into a list of who has an account.
      setSent(true);
    } catch (error) {
      // Only a genuinely broken channel reaches here (the API surfaces that one deliberately).
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível enviar o código agora.'), {
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Código enviado">
        <Alert severity="success" role="status" sx={{ mb: 2 }}>
          Se houver uma conta com esse e-mail, enviamos um código de 6 dígitos para o WhatsApp
          cadastrado. Ele vale por 15 minutos.
        </Alert>
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={() =>
            router.push(`/reset-password?email=${encodeURIComponent(getValues('email'))}`)
          }
        >
          Já tenho o código
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle="Enviaremos um código de 6 dígitos para o WhatsApp cadastrado na sua conta."
    >
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
          <Button type="submit" variant="contained" size="large" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Enviar código'}
          </Button>
        </Stack>
      </Box>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <MuiLink component={Link} href="/login" variant="body2">
          Voltar para o login
        </MuiLink>
      </Box>
    </AuthLayout>
  );
}
