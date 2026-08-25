'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSnackbar } from 'notistack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';
import authService from 'src/services/authService';
import { DDIS, DEFAULT_DDI_KEY, ddiKey } from 'src/constants/ddis';

interface RegisterForm {
  nome: string;
  sobrenome: string;
  email: string;
  telefone: string;
  senha: string;
  confsenha: string;
}

const schema = yup.object({
  nome: yup.string().min(2, 'Nome muito curto').required('Nome obrigatório'),
  sobrenome: yup.string().min(2, 'Sobrenome muito curto').required('Sobrenome obrigatório'),
  email: yup.string().email('E-mail inválido').required('E-mail obrigatório'),
  telefone: yup.string().min(8, 'Telefone inválido').required('Telefone obrigatório'),
  senha: yup.string().min(6, 'Mínimo 6 caracteres').required('Senha obrigatória'),
  confsenha: yup
    .string()
    .oneOf([yup.ref('senha')], 'As senhas não conferem')
    .required('Confirme a senha'),
});

export default function RegisterPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [ddi, setDdi] = useState(DEFAULT_DDI_KEY);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: yupResolver(schema) });

  async function onSubmit(values: RegisterForm) {
    const selected = DDIS.find((d) => ddiKey(d) === ddi) ?? DDIS[0];
    try {
      await authService.register({
        email: values.email,
        nome: `${values.nome.trim()} ${values.sobrenome.trim()}`.trim(),
        telefone: `${selected.dial} ${values.telefone.trim()}`,
        senha: values.senha,
        confsenha: values.confsenha,
      });
      enqueueSnackbar('Conta criada! Verifique seu e-mail para ativá-la.', { variant: 'success' });
      router.replace('/auth/login');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Não foi possível criar a conta.';
      enqueueSnackbar(message, { variant: 'error' });
    }
  }

  return (
    <Box
      component="main"
      sx={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 460 }}>
        <CardContent component="section">
          <Typography variant="h2" color="primary" gutterBottom>
            Criar conta
          </Typography>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Nome"
                  fullWidth
                  {...register('nome')}
                  error={!!errors.nome}
                  helperText={errors.nome?.message}
                />
                <TextField
                  label="Sobrenome"
                  fullWidth
                  {...register('sobrenome')}
                  error={!!errors.sobrenome}
                  helperText={errors.sobrenome?.message}
                />
              </Stack>
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message}
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  select
                  label="DDI / País"
                  value={ddi}
                  onChange={(e) => setDdi(e.target.value)}
                  sx={{ minWidth: 150 }}
                >
                  {DDIS.map((d) => (
                    <MenuItem key={ddiKey(d)} value={ddiKey(d)}>
                      {d.flag} {d.dial} {d.country}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Telefone"
                  fullWidth
                  {...register('telefone')}
                  error={!!errors.telefone}
                  helperText={errors.telefone?.message}
                />
              </Stack>
              <TextField
                label="Senha"
                type="password"
                fullWidth
                {...register('senha')}
                error={!!errors.senha}
                helperText={errors.senha?.message}
              />
              <TextField
                label="Confirmar senha"
                type="password"
                fullWidth
                {...register('confsenha')}
                error={!!errors.confsenha}
                helperText={errors.confsenha?.message}
              />
              <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                Cadastrar
              </Button>
            </Stack>
          </form>
          <MuiLink
            component={Link}
            href="/auth/login"
            variant="body2"
            sx={{ mt: 2, display: 'inline-block' }}
          >
            Já tenho conta
          </MuiLink>
        </CardContent>
      </Card>
    </Box>
  );
}
