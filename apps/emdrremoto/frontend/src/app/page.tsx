'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from 'src/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    router.replace(user ? '/dashboard' : '/auth/login');
  }, [user, loading, router]);

  return (
    <Box
      component="main"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
      role="status"
      aria-label="Carregando"
    >
      <CircularProgress />
    </Box>
  );
}
