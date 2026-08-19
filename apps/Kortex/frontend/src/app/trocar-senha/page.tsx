'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useSnackbar } from 'notistack';
import { AuthLayout } from 'src/components/AuthLayout';
import { RequireAuth } from 'src/components/RequireAuth';
import { useAuth } from 'src/contexts/AuthContext';
import authService from 'src/services/authService';
import { apiErrorMessage } from 'src/services/api';
import { homePathFor } from 'src/types/auth';

const schema = yup.object({
  currentPassword: yup.string().required('Informe a senha atual'),
  newPassword: yup.string().min(8, 'Mínimo de 8 caracteres').required('Informe a nova senha'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'As senhas não conferem')
    .required('Repita a nova senha'),
});

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function ChangePasswordForm() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: yupResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmit(form: ChangePasswordForm) {
    try {
      await authService.changePassword(form.currentPassword, form.newPassword);
      await refreshUser();
      enqueueSnackbar('Senha alterada.', { variant: 'success' });
      router.replace(homePathFor(user!.role));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível alterar a senha.'), {
        variant: 'error',
      });
    }
  }

  const obrigatoria = user?.mustChangePassword ?? false;

  return (
    <AuthLayout
      title={obrigatoria ? 'Defina sua senha' : 'Trocar senha'}
      description={
        obrigatoria
          ? 'Sua senha atual foi criada por outra pessoa. Escolha uma que só você conheça.'
          : undefined
      }
    >
      {obrigatoria && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Enquanto a senha provisória valer, ela é conhecida por duas pessoas.
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          <TextField
            label={obrigatoria ? 'Senha provisória' : 'Senha atual'}
            type="password"
            autoComplete="current-password"
            autoFocus
            fullWidth
            error={Boolean(errors.currentPassword)}
            helperText={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <TextField
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            fullWidth
            error={Boolean(errors.newPassword)}
            helperText={errors.newPassword?.message ?? 'Mínimo de 8 caracteres.'}
            {...register('newPassword')}
          />
          <TextField
            label="Repita a nova senha"
            type="password"
            autoComplete="new-password"
            fullWidth
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" size="large" disabled={isSubmitting} fullWidth>
            {isSubmitting ? 'Salvando…' : 'Salvar senha'}
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}

export default function ChangePasswordPage() {
  return (
    <RequireAuth>
      <ChangePasswordForm />
    </RequireAuth>
  );
}
