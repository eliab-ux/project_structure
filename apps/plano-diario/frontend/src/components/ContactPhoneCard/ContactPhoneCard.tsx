'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { PhoneField } from 'src/components/PhoneField/PhoneField';
import { useAuth } from 'src/context/AuthContext';
import { errorMessage } from 'src/services/api';
import authService from 'src/services/authService';

const COMPLETE_LENGTH = '(11) 91234-5678'.length;

/**
 * O WhatsApp de contato da conta — o número que recebe o código quando o dono esquece a senha.
 *
 * Fica aqui, e não só no cadastro, porque as contas criadas antes do campo existir não têm
 * número: sem esta caixa elas nunca conseguiriam recuperar a senha. Quando falta o número o
 * aviso é explícito, porque a consequência só aparece no dia em que a senha for esquecida.
 */
export function ContactPhoneCard() {
  const { user, setUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = !user?.phone;
  const changed = phone !== (user?.phone ?? '');

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const updated = await authService.updatePhone(phone);
      setUser(updated);
      setPhone(updated.phone ?? '');
      enqueueSnackbar('WhatsApp de contato salvo', { variant: 'success' });
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível salvar o WhatsApp'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card component="section">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography component="h2" variant="h5" gutterBottom>
              WhatsApp de contato
            </Typography>
            <Typography variant="body2" color="text.secondary">
              É por este número que enviamos o código se você esquecer a senha. Não é o grupo que
              recebe a leitura — é o seu número pessoal.
            </Typography>
          </Box>

          {error && (
            <Alert role="alert" severity="error">
              {error}
            </Alert>
          )}

          {missing && (
            <Alert role="status" severity="warning">
              Sua conta ainda não tem WhatsApp cadastrado. Sem ele não é possível recuperar a senha.
            </Alert>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
            <PhoneField
              label="Seu WhatsApp"
              fullWidth
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <Button
              variant="contained"
              onClick={onSave}
              disabled={saving || !changed || phone.length < COMPLETE_LENGTH}
              sx={{ whiteSpace: 'nowrap', mt: { xs: 0, sm: 0.5 } }}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
