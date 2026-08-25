'use client';

import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import InstagramIcon from '@mui/icons-material/Instagram';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useSnackbar } from 'notistack';
import connectionService from 'src/services/connectionService';
import { Connection } from 'src/types';
import { useI18n } from 'src/i18n/I18nProvider';

const OAUTH_STATE_KEY = 'ecoa_oauth_state';

export default function ConnectionPage() {
  const { t } = useI18n();
  const { enqueueSnackbar } = useSnackbar();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConnection(await connectionService.getStatus());
    } catch {
      enqueueSnackbar(t('connection.errorLoadStatus'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleConnect() {
    setBusy(true);
    try {
      const { url, state } = await connectionService.getOAuthUrl();
      sessionStorage.setItem(OAUTH_STATE_KEY, state);
      window.location.href = url;
    } catch {
      enqueueSnackbar(t('connection.errorStartConnect'), { variant: 'error' });
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      await connectionService.disconnect();
      enqueueSnackbar(t('connection.disconnectedSuccess'), { variant: 'success' });
      await load();
    } catch {
      enqueueSnackbar(t('connection.errorDisconnect'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const connected = connection?.connected;
  const expired = connection?.status === 'expired';

  return (
    <Box component="section" aria-label={t('connection.ariaLabel')}>
      <Typography variant="h1" gutterBottom>
        {t('connection.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        {t('connection.descPart1')} <strong>{t('connection.descSeparadoWord')}</strong>{' '}
        {t('connection.descPart2')}
      </Typography>

      {loading ? (
        <Box sx={{ py: 6, textAlign: 'center' }} role="status" aria-label={t('connection.loading')}>
          <CircularProgress />
        </Box>
      ) : (
        <Card sx={{ maxWidth: 640 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <InstagramIcon color="primary" fontSize="large" />
              <Box sx={{ flexGrow: 1 }}>
                {connected ? (
                  <>
                    <Typography variant="h4">
                      {t('connection.connectedAs', { username: connection?.username })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('connection.since', { date: formatDate(connection?.connectedAt) })}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="h4">{t('connection.noAccountConnected')}</Typography>
                )}
              </Box>
              <Chip
                label={
                  connected
                    ? t('connection.statusConnected')
                    : expired
                      ? t('connection.statusExpired')
                      : t('connection.statusDisconnected')
                }
                color={connected ? 'success' : expired ? 'warning' : 'default'}
                variant={connected ? 'filled' : 'outlined'}
              />
            </Stack>

            {expired && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t('connection.expiredAlert')}
              </Alert>
            )}

            {connected ? (
              <Button variant="outlined" color="error" onClick={handleDisconnect} disabled={busy}>
                {t('connection.disconnectButton')}
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<InstagramIcon />}
                onClick={handleConnect}
                disabled={busy}
              >
                {t('connection.connectButton')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mt: 3, maxWidth: 640 }}>
        <AlertTitle>{t('connection.howItWorksTitle')}</AlertTitle>
        {t('connection.infoPart1')} <strong>{t('connection.infoStrong1')}</strong>{' '}
        {t('connection.infoPart2')}
        <strong>{' '}{t('connection.infoStrong2')}</strong> {t('connection.infoPart3')}
      </Alert>
    </Box>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}
