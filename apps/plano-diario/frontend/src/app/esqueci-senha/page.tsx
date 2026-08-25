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
import { errorMessage } from 'src/services/api';
import authService from 'src/services/authService';

interface EmailForm {
  email: string;
}

interface CodeForm {
  code: string;
  newPassword: string;
}

const emailSchema = yup.object({
  email: yup.string().email('E-mail inválido').required('E-mail obrigatório'),
});

const codeSchema = yup.object({
  code: yup
    .string()
    .matches(/^\d{6}$/, 'O código tem 6 dígitos')
    .required('Código obrigatório'),
  newPassword: yup
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(72, 'Máximo 72 caracteres')
    .required('Nova senha obrigatória'),
});

/**
 * Recuperação de senha em duas etapas: pede o código, depois troca a senha.
 *
 * A etapa 1 avança SEMPRE, mesmo que o e-mail não exista — o backend responde igual nos dois
 * casos de propósito, e travar a tela quando a conta não existe entregaria essa informação.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailForm = useForm<EmailForm>({ resolver: yupResolver(emailSchema) });
  const codeForm = useForm<CodeForm>({ resolver: yupResolver(codeSchema) });

  async function onRequestCode(values: EmailForm) {
    setError(null);
    try {
      const message = await authService.forgotPassword(values.email);
      setEmail(values.email);
      setNotice(message);
      setStep('code');
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível solicitar o código'));
    }
  }

  async function onResetPassword(values: CodeForm) {
    setError(null);
    try {
      await authService.resetPassword(email, values.code, values.newPassword);
      enqueueSnackbar('Senha alterada. Entre com a senha nova.', { variant: 'success' });
      router.push('/login');
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível redefinir a senha'));
    }
  }

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 8 }}>
      <Box component="section" sx={{ mb: 3, textAlign: 'center' }}>
        <Typography component="h1" variant="h1" gutterBottom>
          Esqueci minha senha
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {step === 'email'
            ? 'Enviaremos um código pelo WhatsApp para o número cadastrado na sua conta.'
            : 'Digite o código que chegou no seu WhatsApp e escolha a nova senha.'}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          {error && (
            <Alert role="alert" severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {step === 'email' ? (
            <Box component="form" onSubmit={emailForm.handleSubmit(onRequestCode)} noValidate>
              <Stack spacing={2}>
                <TextField
                  label="E-mail da conta"
                  type="email"
                  autoComplete="email"
                  fullWidth
                  error={!!emailForm.formState.errors.email}
                  helperText={emailForm.formState.errors.email?.message}
                  {...emailForm.register('email')}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={emailForm.formState.isSubmitting}
                >
                  {emailForm.formState.isSubmitting ? 'Enviando…' : 'Enviar código'}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box component="form" onSubmit={codeForm.handleSubmit(onResetPassword)} noValidate>
              <Stack spacing={2}>
                {notice && (
                  <Alert role="status" severity="info">
                    {notice}
                  </Alert>
                )}
                <TextField
                  label="Código de 6 dígitos"
                  autoComplete="one-time-code"
                  fullWidth
                  inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                  error={!!codeForm.formState.errors.code}
                  helperText={codeForm.formState.errors.code?.message ?? 'Vale por 15 minutos'}
                  {...codeForm.register('code')}
                />
                <TextField
                  label="Nova senha"
                  type="password"
                  autoComplete="new-password"
                  fullWidth
                  error={!!codeForm.formState.errors.newPassword}
                  helperText={
                    codeForm.formState.errors.newPassword?.message ?? 'Mínimo 8 caracteres'
                  }
                  {...codeForm.register('newPassword')}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={codeForm.formState.isSubmitting}
                >
                  {codeForm.formState.isSubmitting ? 'Salvando…' : 'Redefinir senha'}
                </Button>
                <Button
                  variant="text"
                  onClick={() => {
                    setStep('email');
                    setNotice(null);
                  }}
                >
                  Não recebi o código
                </Button>
              </Stack>
            </Box>
          )}

          <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 2 }}>
            <Link component={NextLink} href="/login">
              Voltar para o login
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
