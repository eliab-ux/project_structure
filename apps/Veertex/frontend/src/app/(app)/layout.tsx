'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { AppShell } from 'src/components/AppShell';
import { useAuth } from 'src/contexts/AuthContext';

/**
 * Guards every authenticated route.
 *
 * This is a CONVENIENCE, not the security control: the backend refuses unauthenticated requests
 * regardless, and a route group in the browser can always be bypassed. Its job is to send someone
 * whose session expired to the login screen instead of showing them an empty page full of failed
 * requests.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
      >
        <CircularProgress role="status" aria-label="Carregando" />
      </Box>
    );
  }

  return <AppShell>{children}</AppShell>;
}
