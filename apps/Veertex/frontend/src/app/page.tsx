'use client';

import { MESA } from 'src/constants/routes';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from 'src/contexts/AuthContext';

/**
 * The root only routes. It waits for the session restore to finish before deciding — sending an
 * authenticated user to /login for a frame and then bouncing them back is worse than a brief
 * spinner.
 */
export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    router.replace(user ? MESA : '/login');
  }, [loading, user, router]);

  return (
    <Box
      component="main"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
    >
      <CircularProgress role="status" aria-label="Carregando" />
    </Box>
  );
}
