'use client';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from 'src/context/AuthContext';

const NAV = [
  { href: '/', label: 'Painel' },
  { href: '/whatsapp', label: 'WhatsApp' },
  { href: '/configuracao', label: 'Configuração' },
  { href: '/programacao', label: 'Programação' },
  { href: '/historico', label: 'Histórico' },
];

/**
 * Casca das páginas autenticadas: navegação + guarda de rota no cliente.
 *
 * A proteção real é no backend (todo endpoint exige JWT). Isto aqui é só experiência de uso —
 * evitar telas vazias piscando para quem não está logado.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <Box
        role="status"
        aria-label="Carregando"
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <AppBar component="header" position="static" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
          <Typography component="p" variant="h6" sx={{ mr: 2 }}>
            Plano Diário
          </Typography>
          <Stack
            component="nav"
            direction="row"
            spacing={1}
            sx={{ flexGrow: 1 }}
            aria-label="Seções"
          >
            {NAV.map((item) => (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                size="small"
                color={pathname === item.href ? 'primary' : 'inherit'}
                variant={pathname === item.href ? 'outlined' : 'text'}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            {user.name}
          </Typography>
          <Button size="small" color="inherit" onClick={signOut}>
            Sair
          </Button>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="md" sx={{ py: 4 }}>
        {children}
      </Container>
    </>
  );
}
