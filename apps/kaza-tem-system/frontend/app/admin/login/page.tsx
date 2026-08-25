'use client';

import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography, Alert } from '@mui/material';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useRouter } from 'next/navigation';

interface FormState {
  email: string;
  password: string;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuth();
  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.email || !form.password) {
      setError('Email e senha são obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      await login(form.email, form.password);
      const adminDashboardRoute = '/admin/dashboard';
      router.push(adminDashboardRoute);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Falha ao autenticar.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        width: '100%',
        maxWidth: 420,
        mx: 'auto',
        mt: 12,
        px: 3,
        py: 4,
        borderRadius: 2,
        boxShadow: 3,
        backgroundColor: 'background.paper',
      }}
    >
      <Stack spacing={2}>
        <Typography variant="h4" textAlign="center">
          Login Admin
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          required
        />
        <TextField
          label="Senha"
          type="password"
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          required
        />
        <Button type="submit" variant="contained" size="large" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </Stack>
    </Box>
  );
}
