'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { useSnackbar } from 'notistack';
import { AuthLayout } from 'src/components/AuthLayout/AuthLayout';
import authService from 'src/services/authService';
import { useI18n } from 'src/i18n/I18nProvider';

interface ForgotForm {
  email: string;
}

export default function ForgotPasswordPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useI18n();
  const [sent, setSent] = useState(false);

  const schema = yup.object({
    email: yup
      .string()
      .email(t('auth.validation.emailInvalid'))
      .required(t('auth.validation.emailRequired')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: yupResolver(schema) });

  async function onSubmit(values: ForgotForm) {
    try {
      await authService.requestPasswordReset(values.email);
      // Sempre responde igual (anti-enumeração) — a mensagem não revela se o e-mail existe.
      setSent(true);
    } catch {
      enqueueSnackbar(t('auth.forgot.error'), { variant: 'error' });
    }
  }

  return (
    <AuthLayout title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      {sent ? (
        <Alert severity="success" role="status">
          {t('auth.forgot.sent')}
        </Alert>
      ) : (
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
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={isSubmitting}
            sx={{ mt: 2 }}
          >
            {isSubmitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
          </Button>
        </Box>
      )}
      <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
        <Typography
          component={Link}
          href="/auth/login"
          variant="body2"
          sx={{ color: 'primary.main' }}
        >
          {t('auth.forgot.backToLogin')}
        </Typography>
      </Typography>
    </AuthLayout>
  );
}
