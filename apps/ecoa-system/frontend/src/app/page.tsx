'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from 'src/context/AuthContext';
import { useI18n } from 'src/i18n/I18nProvider';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useI18n();

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
      aria-label={t('common.loading')}
    >
      <CircularProgress />
    </Box>
  );
}
