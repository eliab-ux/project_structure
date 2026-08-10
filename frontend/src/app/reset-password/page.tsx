'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import authService from 'src/services/authService';
import { apiErrorMessage } from 'src/services/api';

/** Mirrors the backend's PASSWORD_POLICY. Length only — see the policy's docblock for why. */
const MIN_PASSWORD_LENGTH = 8;

const validationSchema = yup.object({
  email: yup.string().email('E-mail inválido').required('E-mail obrigatório'),
  code: yup
    .string()
    .matches(/^\d{6}$/, 'O código tem 6 dígitos')
    .required('Código obrigatório'),
  newPassword: yup
    .string()
    .min(MIN_PASSWORD_LENGTH, `Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`)
    .required('Nova senha obrigatória'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'As senhas não conferem')
    .required('Confirme a nova senha'),
});

interface ResetPasswordFormValues {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      // Pre-filled when the user came from the previous screen, typed when they came from WhatsApp
      // on another device.
      email: searchParams.get('email') ?? '',
      code: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    setSubmitting(true);
    try {
      await authService.resetPassword(values.email, values.code, values.newPassword);
      enqueueSnackbar('Senha redefinida. Entre com a nova senha.', { variant: 'success' });
      router.replace('/login');
    } catch (error) {
      // The API gives one message for every failure — wrong, expired, used, attempts exhausted.
      // Showing it as-is is what keeps the screen from telling an attacker which one it was.
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível redefinir a senha.'), {
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Redefinir senha"
      subtitle="Informe o código de 6 dígitos que enviamos no WhatsApp."
    >
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2}>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            error={!!errors.email}
            helperText={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Código"
            inputProps={{ inputMode: 'numeric', maxLength: 6, autoComplete: 'one-time-code' }}
            autoFocus
            error={!!errors.code}
            helperText={errors.code?.message}
            {...register('code')}
          />
          <TextField
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            error={!!errors.newPassword}
            helperText={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <TextField
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting}>
            {submitting ? 'Redefinindo…' : 'Redefinir senha'}
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

/**
 * `useSearchParams` opts the route into client-side rendering, and Next requires a Suspense
 * boundary around it — without one the production build fails rather than degrading.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthLayout title="Redefinir senha">{null}</AuthLayout>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
