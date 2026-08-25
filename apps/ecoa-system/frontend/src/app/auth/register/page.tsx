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

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useI18n();

  const schema = yup.object({
    name: yup
      .string()
      .min(2, t('auth.validation.nameMin'))
      .max(100, t('auth.validation.nameMax'))
      .required(t('auth.validation.nameRequired')),
    email: yup
      .string()
      .email(t('auth.validation.emailInvalid'))
      .required(t('auth.validation.emailRequired')),
    password: yup
      .string()
      .min(8, t('auth.validation.passwordMin'))
      .required(t('auth.validation.passwordRequired')),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref('password')], t('auth.validation.passwordsNoMatch'))
      .required(t('auth.validation.confirmRequired')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: yupResolver(schema) });

  async function onSubmit(values: RegisterForm) {
    try {
      await registerUser(values.name, values.email, values.password);
      enqueueSnackbar(t('auth.register.success'), { variant: 'success' });
      router.replace('/connection');
    } catch (error) {
      enqueueSnackbar(resolveError(error, t('auth.register.error')), { variant: 'error' });
    }
  }

  return (
    <AuthLayout title={t('auth.register.title')} subtitle={t('auth.register.subtitle')}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label={t('auth.fields.name')}
          fullWidth
          margin="normal"
          error={!!errors.name}
          helperText={errors.name?.message}
          {...register('name')}
        />
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
          autoComplete="new-password"
          error={!!errors.password}
          helperText={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label={t('auth.fields.confirmPassword')}
          type="password"
          fullWidth
          margin="normal"
          autoComplete="new-password"
          error={!!errors.confirmPassword}
          helperText={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={isSubmitting}
          sx={{ mt: 2 }}
        >
          {isSubmitting ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>
      </Box>
      <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
        {t('auth.register.haveAccount')}{' '}
        <Typography
          component={Link}
          href="/auth/login"
          variant="body2"
          sx={{ color: 'primary.main' }}
        >
          {t('auth.register.signIn')}
        </Typography>
      </Typography>
    </AuthLayout>
  );
}

function resolveError(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data
    ?.message;
  return message || fallback;
}
