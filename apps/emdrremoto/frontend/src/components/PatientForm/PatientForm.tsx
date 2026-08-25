'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import pacienteService from 'src/services/pacienteService';
import { DDIS, DEFAULT_DDI_KEY, ddiKey } from 'src/constants/ddis';

interface PatientFormProps {
  /** Ausente = criar; presente = editar. */
  pacienteId?: string;
}

export function PatientForm({ pacienteId }: PatientFormProps) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = Boolean(pacienteId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [ddi, setDdi] = useState(DEFAULT_DDI_KEY);
  const [telefone, setTelefone] = useState('');

  useEffect(() => {
    if (!pacienteId) return;
    pacienteService
      .getById(pacienteId)
      .then((p) => {
        setNome(p.nome);
        setEmail(p.email);
        // Reconstrói DDI (por país) e separa o número do prefixo.
        const byCountry = DDIS.find((d) => d.country === p.pais);
        const byDial = DDIS.find((d) => p.telefone.startsWith(d.dial));
        const selected = byCountry ?? byDial;
        if (selected) {
          setDdi(ddiKey(selected));
          setTelefone(
            p.telefone.startsWith(selected.dial)
              ? p.telefone.slice(selected.dial.length).trim()
              : p.telefone,
          );
        } else {
          setTelefone(p.telefone);
        }
      })
      .catch(() => enqueueSnackbar('Paciente não encontrado.', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [pacienteId, enqueueSnackbar]);

  async function save() {
    if (
      nome.trim().length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      telefone.trim().length < 8
    ) {
      enqueueSnackbar('Preencha nome, e-mail e telefone válidos.', { variant: 'warning' });
      return;
    }
    const selected = DDIS.find((d) => ddiKey(d) === ddi) ?? DDIS[0];
    const payload = {
      email: email.trim(),
      nome: nome.trim(),
      telefone: `${selected.dial} ${telefone.trim()}`,
      pais: selected.country,
    };
    setSaving(true);
    try {
      if (isEdit && pacienteId) {
        await pacienteService.update(pacienteId, payload);
        enqueueSnackbar('Paciente atualizado.', { variant: 'success' });
      } else {
        await pacienteService.create(payload);
        enqueueSnackbar('Paciente cadastrado.', { variant: 'success' });
      }
      router.push('/dashboard');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Erro ao salvar paciente.';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }} role="status">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card component="section" sx={{ maxWidth: 560, mx: 'auto' }}>
      <CardContent>
        <Typography variant="h3" gutterBottom>
          {isEdit ? 'Editar paciente' : 'Novo paciente'}
        </Typography>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nome"
            fullWidth
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <TextField
            label="E-mail"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="DDI / País"
              value={ddi}
              onChange={(e) => setDdi(e.target.value)}
              sx={{ minWidth: 160 }}
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
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </Stack>
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button color="inherit" onClick={() => router.push('/dashboard')} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={save} disabled={saving}>
              {isEdit ? 'Salvar' : 'Cadastrar'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
