'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from 'src/contexts/AuthContext';
import { homePathFor } from 'src/types/auth';

/**
 * Raiz: só decide para onde mandar. O roteamento por papel do login (spec §8) — `modelista` cai
 * em `/m`, `admin` e `owner` no painel — mora aqui e no `RequireAuth`, para não ficar espalhado
 * por cada tela.
 */
export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }
    router.replace(user ? homePathFor(user.role) : '/login');
  }, [user, loading, router]);

  return (
    <Box
      role="status"
      aria-label="Carregando"
      sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}
    >
      <CircularProgress />
    </Box>
  );
}
