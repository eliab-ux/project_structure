'use client';

import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAuth } from 'src/contexts/AuthContext';

/**
 * Placeholder. The real dashboard (01_Veertex_Core §3.8 — vendas do período, contas a
 * receber/pagar, pedidos por origem, top produtos, filtro e comparativo por empresa) needs VND,
 * FIN and EST to exist. What it shows today is only what F1 actually knows.
 */
export default function DashboardPage() {
  const { user, account, role, permissions } = useAuth();

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Typography variant="h1">Olá, {user?.name?.split(' ')[0]}!</Typography>

      <Alert severity="info" role="status">
        Fatia F1: conta, empresas, papéis, usuários e autenticação. Os cadastros (contatos,
        produtos) e o dashboard com indicadores chegam nas próximas fatias.
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h2" gutterBottom>
            Sua conta
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {account?.name} · {account?.documentFormatted}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Papel: {role?.name ?? '—'} · {permissions.length} permissão(ões)
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
