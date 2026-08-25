'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useSnackbar } from 'notistack';
import connectionService from 'src/services/connectionService';
import { useI18n } from 'src/i18n/I18nProvider';

const OAUTH_STATE_KEY = 'ecoa_oauth_state';

/**
 * Meta redirects the browser here (a FRONTEND page, not the backend). We validate the anti-CSRF
 * state round-trip, then POST the code to the backend WITH the JWT so the callback is never
 * anonymous.
 */
export default function ConnectionCallbackPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) {
      return;
    }
    ran.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const metaError = params.get('error_description') || params.get('error');
    const storedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);

    if (metaError) {
      setError(t('connection.callbackMetaCancelled'));
      return;
    }
    if (!code) {
      setError(t('connection.callbackMissingCode'));
      return;
    }
    if (state && storedState && state !== storedState) {
      setError(t('connection.callbackStateMismatch'));
      return;
    }

    connectionService
      .completeCallback(code, state ?? undefined)
      .then(() => {
        enqueueSnackbar(t('connection.callbackSuccess'), { variant: 'success' });
        router.replace('/dashboard');
      })
      .catch((err) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          t('connection.callbackError');
        setError(message);
      });
  }, [params, router, enqueueSnackbar, t]);

  return (
    <Box component="section" sx={{ maxWidth: 480, mx: 'auto', textAlign: 'center', py: 8 }}>
      {error ? (
        <>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
          <Button variant="contained" onClick={() => router.replace('/connection')}>
            {t('connection.backToConnection')}
          </Button>
        </>
      ) : (
        <Box role="status" aria-label={t('connection.callbackCompletingAria')}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>{t('connection.callbackCompleting')}</Typography>
        </Box>
      )}
    </Box>
  );
}
