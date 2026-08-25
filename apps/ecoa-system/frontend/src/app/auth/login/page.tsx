'use client';

import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { AuthLayout } from 'src/components/AuthLayout/AuthLayout';
import { useAuth } from 'src/context/AuthContext';
import { useI18n } from 'src/i18n/I18nProvider';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useI18n();

  const schema = yup.object({
    email: yup
      .string()
      .email(t('auth.validation.emailInvalid'))
      .required(t('auth.validation.emailRequired')),
    password: yup.string().required(t('auth.validation.passwordRequired')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: yupResolver(schema) });

  async function onSubmit(values: LoginForm) {
    try {
      await login(values.email, values.password);
      router.replace('/dashboard');
    } catch (error) {
      enqueueSnackbar(resolveError(error, t('auth.login.error')), { variant: 'error' });
    }
  }

  return (
    <AuthLayout title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label={t('auth.fields.email')}
          type="email"
          fullWidth
          margin="normal"
          autoComplete="email"
          error={!!errors.email}
          helperText={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label={t('auth.fields.password')}
          type="password"
          fullWidth
          margin="normal"
          autoComplete="current-password"
          error={!!errors.password}
          helperText={errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={isSubmitting}
          sx={{ mt: 2 }}
        >
          {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Typography
          variant="body2"
          component={Link}
          href="/auth/forgot-password"
          sx={{ color: 'primary.main' }}
        >
          {t('auth.login.forgot')}
        </Typography>
        <Typography
          variant="body2"
          component={Link}
          href="/auth/register"
          sx={{ color: 'primary.main' }}
        >
          {t('auth.login.createAccount')}
        </Typography>
      </Box>
    </AuthLayout>
  );
}

function resolveError(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data
    ?.message;
  return message || fallback;
}
