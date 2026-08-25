'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { apiErrorMessage } from 'src/services/api';
import { authService } from 'src/services/services';

const requestSchema = yup.object({
  email: yup.string().email('E-mail inválido').required('E-mail obrigatório'),
});

const resetSchema = yup.object({
  code: yup
    .string()
    .matches(/^\d{6}$/, 'O código tem 6 dígitos')
    .required('Código obrigatório'),
  password: yup
    .string()
    // Mirrors the backend policy (PASSWORD_POLICY.minLength = 10). Announcing 8 and then being
    // refused by the API is worse than being told the real rule while typing.
    .min(10, 'Mínimo 10 caracteres')
    .matches(/[A-Za-z]/, 'Inclua ao menos uma letra')
    .matches(/\d/, 'Inclua ao menos um número')
    .required('Senha obrigatória'),
  confirmation: yup
    .string()
    .oneOf([yup.ref('password')], 'As senhas não coincidem')
    .required('Confirme a senha'),
});

type RequestForm = yup.InferType<typeof requestSchema>;
type ResetForm = yup.InferType<typeof resetSchema>;

/**
 * Password recovery by a code sent over WhatsApp (FASE 10, screen 1).
 *
 * Two steps on ONE page, and no token in the URL. That is a consequence of the channel, not a style
 * choice: the code arrives on the phone, the person is already at the keyboard, and keeping both
 * steps together means they never have to find their way back to a second screen. It also removes
 * `useSearchParams`, and with it the Suspense boundary the previous magic-link version needed.
 *
 * Step 1 always reports the same thing, whatever the API says about that address: a form that
 * answers "this e-mail is not registered" is an account-enumeration oracle. The backend answers 204
 * to unknown e-mails for the same reason — this screen just refuses to undo that.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [step, setStep] = useState<'REQUEST' | 'CODE'>('REQUEST');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requestForm = useForm<RequestForm>({ resolver: yupResolver(requestSchema) });
  const resetForm = useForm<ResetForm>({ resolver: yupResolver(resetSchema) });

  async function onRequest(values: RequestForm) {
    setSubmitting(true);
    try {
      await authService.requestPasswordReset(values.email);
    } catch (error) {
      // A configuration failure of the channel DOES surface (the backend returns it deliberately,
      // and identically for every e-mail). Anything else is swallowed so the outcome stays uniform.
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível enviar o código agora.'), {
        variant: 'error',
      });
      setSubmitting(false);
      return;
    }

    setEmail(values.email);
    setStep('CODE');
    setSubmitting(false);
    enqueueSnackbar('Se este e-mail estiver cadastrado, o código chega no WhatsApp em instantes.', {
      variant: 'info',
    });
  }

  async function onReset(values: ResetForm) {
    setSubmitting(true);
    try {
      await authService.resetPassword(email, values.code, values.password);
      enqueueSnackbar('Senha redefinida. Faça login com a nova senha.', { variant: 'success' });
      router.replace('/login');
    } catch (error) {
      enqueueSnackbar(
        apiErrorMessage(error, 'Código inválido ou expirado. Solicite um novo código.'),
        { variant: 'error' },
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container
      component="main"
      maxWidth="xs"
      sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}
    >
      <Paper variant="outlined" sx={{ p: 4, width: '100%' }}>
        <Box component="header" sx={{ mb: 3 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Recuperar senha
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {step === 'REQUEST'
              ? 'Informe seu e-mail. O código de 6 dígitos chega no WhatsApp cadastrado.'
              : 'Digite o código que chegou no seu WhatsApp e escolha a nova senha.'}
          </Typography>
        </Box>

        {step === 'REQUEST' ? (
          <Box component="form" onSubmit={requestForm.handleSubmit(onRequest)} noValidate>
            <Stack spacing={2}>
              <TextField
                label="E-mail"
                type="email"
                autoComplete="email"
                autoFocus
                fullWidth
                {...requestForm.register('email')}
                error={Boolean(requestForm.formState.errors.email)}
                helperText={requestForm.formState.errors.email?.message}
              />
              <Button type="submit" variant="contained" size="large" disabled={submitting}>
                {submitting ? 'Enviando…' : 'Enviar código'}
              </Button>
              <Link href="/login" variant="body2" sx={{ alignSelf: 'center' }}>
                Voltar para o login
              </Link>
            </Stack>
          </Box>
        ) : (
          <Box component="form" onSubmit={resetForm.handleSubmit(onReset)} noValidate>
            <Stack spacing={2}>
              <Alert severity="info" role="status">
                O código vale por 15 minutos e só pode ser usado uma vez. Nós nunca enviamos link
                junto do código — mensagem com link não é nossa.
              </Alert>
              <TextField
                label="Código de 6 dígitos"
                autoComplete="one-time-code"
                autoFocus
                fullWidth
                inputProps={{ inputMode: 'numeric', maxLength: 6, pattern: '[0-9]*' }}
                {...resetForm.register('code')}
                error={Boolean(resetForm.formState.errors.code)}
                helperText={resetForm.formState.errors.code?.message}
              />
              <TextField
                label="Nova senha"
                type="password"
                autoComplete="new-password"
                fullWidth
                {...resetForm.register('password')}
                error={Boolean(resetForm.formState.errors.password)}
                helperText={
                  resetForm.formState.errors.password?.message ??
                  'Mínimo 10 caracteres, com letra e número'
                }
              />
              <TextField
                label="Confirme a nova senha"
                type="password"
                autoComplete="new-password"
                fullWidth
                {...resetForm.register('confirmation')}
                error={Boolean(resetForm.formState.errors.confirmation)}
                helperText={resetForm.formState.errors.confirmation?.message}
              />
              <Button type="submit" variant="contained" size="large" disabled={submitting}>
                {submitting ? 'Salvando…' : 'Redefinir senha'}
              </Button>
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={() => setStep('REQUEST')}
                sx={{ alignSelf: 'center' }}
              >
                Não recebi o código — enviar de novo
              </Link>
            </Stack>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
