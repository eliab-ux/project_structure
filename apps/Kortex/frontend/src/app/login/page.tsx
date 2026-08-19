'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Button from '@mui/material/Button';
import MuiLink from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useSnackbar } from 'notistack';
import { AuthLayout } from 'src/components/AuthLayout';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import { homePathFor } from 'src/types/auth';

const schema = yup.object({
  email: yup.string().email('E-mail inválido').required('Informe o e-mail'),
  password: yup.string().required('Informe a senha'),
});

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: yupResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  // Quem já está autenticado não fica olhando a tela de login.
  useEffect(() => {
    if (!loading && user) {
      router.replace(user.mustChangePassword ? '/trocar-senha' : homePathFor(user.role));
    }
  }, [user, loading, router]);

  async function onSubmit(form: LoginForm) {
    try {
      const authenticated = await signIn(form.email, form.password);
      router.replace(
        authenticated.mustChangePassword ? '/trocar-senha' : homePathFor(authenticated.role),
      );
    } catch (error) {
      // A mensagem vem do backend e é a mesma para senha errada, e-mail inexistente e usuário
      // desligado — de propósito, para a tela não virar um verificador de quadro de funcionários.
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível entrar.'), { variant: 'error' });
    }
  }

  return (
    <AuthLayout
      title="Entrar no Kortex"
      description="Modelista, veja a fila do dia. Administrativo, abra a agenda."
      help="Esqueceu a senha? O código de 6 dígitos chega no seu WhatsApp e vale por 15 minutos."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="username"
            autoFocus
            fullWidth
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            fullWidth
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            {...register('password')}
          />
          {/* O link fica colado no campo de senha, não no rodapé: quem esquece a senha percebe
              isso ao olhar para o campo, e não depois de varrer a tela inteira. */}
          <MuiLink
            component={Link}
            href="/recuperar-senha"
            variant="body2"
            sx={{ alignSelf: 'flex-end', mt: -1.25, fontSize: 12.5, fontWeight: 500 }}
          >
            Esqueci a senha
          </MuiLink>
          <Button type="submit" size="large" disabled={isSubmitting} fullWidth>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
