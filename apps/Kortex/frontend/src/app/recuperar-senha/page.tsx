'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MuiLink from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useSnackbar } from 'notistack';
import { AuthLayout } from 'src/components/AuthLayout';
import authService from 'src/services/authService';
import { apiErrorMessage } from 'src/services/api';

const requestSchema = yup.object({
  email: yup.string().email('E-mail inválido').required('Informe o e-mail'),
});

const resetSchema = yup.object({
  code: yup
    .string()
    .matches(/^\d{6}$/, 'O código tem 6 dígitos')
    .required('Informe o código'),
  newPassword: yup.string().min(8, 'Mínimo de 8 caracteres').required('Informe a nova senha'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'As senhas não conferem')
    .required('Repita a nova senha'),
});

interface RequestForm {
  email: string;
}

interface ResetForm {
  code: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Recuperação em dois passos: pedir o código e usá-lo.
 *
 * O passo 1 avança para o passo 2 **sempre**, exista o e-mail ou não — o backend responde 204 nos
 * dois casos, e a tela precisa acompanhar. Se ela mostrasse "e-mail não encontrado", devolveria
 * pela interface a informação que a API se recusa a dar.
 */
export default function RecoverPasswordPage() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const requestForm = useForm<RequestForm>({
    resolver: yupResolver(requestSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetForm>({
    resolver: yupResolver(resetSchema),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
  });

  async function onRequest(form: RequestForm) {
    try {
      await authService.requestPasswordReset(form.email);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível concluir.'), { variant: 'error' });
      return;
    }
    setEmail(form.email);
  }

  async function onReset(form: ResetForm) {
    try {
      await authService.resetPassword(email!, form.code, form.newPassword);
      enqueueSnackbar('Senha redefinida. Faça login com a nova senha.', { variant: 'success' });
      router.replace('/login');
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Código inválido ou expirado.'), { variant: 'error' });
    }
  }

  if (!email) {
    return (
      <AuthLayout
        title="Recuperar senha"
        description="Enviamos um código de 6 dígitos no WhatsApp cadastrado."
      >
        <form onSubmit={requestForm.handleSubmit(onRequest)} noValidate>
          <Stack spacing={2.5}>
            <TextField
              label="E-mail"
              type="email"
              autoComplete="username"
              autoFocus
              fullWidth
              error={Boolean(requestForm.formState.errors.email)}
              helperText={requestForm.formState.errors.email?.message}
              {...requestForm.register('email')}
            />
            <Button
              type="submit"
              size="large"
              disabled={requestForm.formState.isSubmitting}
              fullWidth
            >
              {requestForm.formState.isSubmitting ? 'Enviando…' : 'Enviar código'}
            </Button>
          </Stack>
        </form>

        <MuiLink
          component={Link}
          href="/login"
          variant="body2"
          sx={{ display: 'block', mt: 2.5, textAlign: 'center' }}
        >
          Voltar para o login
        </MuiLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Digite o código"
      description={`Se houver uma conta com ${email}, o código chegou no WhatsApp cadastrado.`}
    >
      <Alert severity="info" sx={{ mb: 3 }}>
        O código vale por 15 minutos e só pode ser usado uma vez. O Kortex nunca envia link junto do
        código.
      </Alert>

      <form onSubmit={resetForm.handleSubmit(onReset)} noValidate>
        <Stack spacing={2.5}>
          <TextField
            label="Código de 6 dígitos"
            autoFocus
            fullWidth
            inputProps={{ inputMode: 'numeric', maxLength: 6 }}
            error={Boolean(resetForm.formState.errors.code)}
            helperText={resetForm.formState.errors.code?.message}
            {...resetForm.register('code')}
          />
          <TextField
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            fullWidth
            error={Boolean(resetForm.formState.errors.newPassword)}
            helperText={
              resetForm.formState.errors.newPassword?.message ?? 'Mínimo de 8 caracteres.'
            }
            {...resetForm.register('newPassword')}
          />
          <TextField
            label="Repita a nova senha"
            type="password"
            autoComplete="new-password"
            fullWidth
            error={Boolean(resetForm.formState.errors.confirmPassword)}
            helperText={resetForm.formState.errors.confirmPassword?.message}
            {...resetForm.register('confirmPassword')}
          />
          <Button type="submit" size="large" disabled={resetForm.formState.isSubmitting} fullWidth>
            {resetForm.formState.isSubmitting ? 'Salvando…' : 'Redefinir senha'}
          </Button>
          <Button variant="text" onClick={() => setEmail(null)}>
            Usar outro e-mail
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
