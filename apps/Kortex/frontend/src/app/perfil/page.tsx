'use client';

import { useState } from 'react';
import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import MuiLink from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { RequireAuth } from 'src/components/RequireAuth';
import { useAuth } from 'src/contexts/AuthContext';
import authService from 'src/services/authService';
import { apiErrorMessage } from 'src/services/api';
import { USER_ROLE_LABELS, homePathFor } from 'src/types/auth';

/**
 * Perfil do próprio usuário. Fora do grupo `(painel)` de propósito: o Modelista precisa alcançar
 * esta tela, e o painel é fechado para `admin` e `owner`.
 *
 * O que dá para mudar aqui é o telefone e a senha — as duas pontas do acesso da pessoa. Nome,
 * e-mail e papel continuam com a Equipe, porque são identidade dentro da operação, não credencial.
 */
function ProfileScreen() {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const saved = await authService.changeOwnPhone(phone);
      setPhone('');
      enqueueSnackbar(`WhatsApp atualizado para ${saved.phone}.`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível alterar o telefone.'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 5 }}>
      <Container maxWidth="sm">
        <Typography variant="overline" component="p" sx={{ color: 'info.main' }}>
          Kortex
        </Typography>
        <Typography variant="h2" component="h1">
          Meu perfil
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {user?.name} · {user ? USER_ROLE_LABELS[user.role] : ''} · {user?.email}
        </Typography>

        <Paper variant="outlined" sx={{ p: 3, mt: 3 }}>
          <Typography variant="h4" component="h2">
            WhatsApp
          </Typography>
          <Alert severity="info" sx={{ my: 2 }}>
            É para este número que vai o código de recuperação de senha. Trocou de chip? Atualize
            aqui — ninguém além do dono pode fazer isso por você.
          </Alert>

          <Stack spacing={2}>
            <TextField
              label="Novo WhatsApp"
              placeholder="(62) 9 0000-0000"
              fullWidth
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <Box>
              <Button onClick={save} disabled={saving || phone.trim().length < 10}>
                {saving ? 'Salvando…' : 'Salvar telefone'}
              </Button>
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, mt: 2.5 }}>
          <Typography variant="h4" component="h2" gutterBottom>
            Senha
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Você troca a sua senha informando a atual. Ninguém no sistema redefine a senha de outra
            pessoa.
          </Typography>
          <Button component={Link} href="/trocar-senha" variant="outlined">
            Trocar senha
          </Button>
        </Paper>

        <MuiLink
          component={Link}
          href={user ? homePathFor(user.role) : '/'}
          variant="body2"
          sx={{ display: 'block', mt: 3 }}
        >
          Voltar
        </MuiLink>
      </Container>
    </Box>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <ProfileScreen />
    </RequireAuth>
  );
}
