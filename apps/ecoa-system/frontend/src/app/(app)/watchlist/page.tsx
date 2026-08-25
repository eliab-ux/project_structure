'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import { useSnackbar } from 'notistack';
import { EmptyState } from 'src/components/EmptyState/EmptyState';
import { useI18n } from 'src/i18n/I18nProvider';
import watchlistService from 'src/services/watchlistService';
import { WatchedAccount } from 'src/types';

interface AddHandleForm {
  handle: string;
}

export default function WatchlistPage() {
  const { t } = useI18n();
  const { enqueueSnackbar } = useSnackbar();
  const [accounts, setAccounts] = useState<WatchedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<WatchedAccount | null>(null);
  const [removing, setRemoving] = useState(false);

  const schema = useMemo(
    () =>
      yup.object({
        handle: yup
          .string()
          .transform((value) =>
            typeof value === 'string' ? value.replace(/^@/, '').trim() : value,
          )
          .matches(/^[a-zA-Z0-9._]{1,30}$/, t('watchlist.validationHandleFormat'))
          .required(t('watchlist.validationHandleRequired')),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddHandleForm>({ resolver: yupResolver(schema) });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await watchlistService.list());
    } catch {
      enqueueSnackbar(t('watchlist.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(values: AddHandleForm) {
    const handle = values.handle.replace(/^@/, '').trim();
    try {
      await watchlistService.add(handle);
      enqueueSnackbar(t('watchlist.addSuccess', { handle }), { variant: 'success' });
      reset({ handle: '' });
      await load();
    } catch (error) {
      enqueueSnackbar(resolveError(error, t), { variant: 'error' });
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setRemoving(true);
    try {
      await watchlistService.remove(pendingDelete.id);
      enqueueSnackbar(t('watchlist.removeSuccess', { handle: pendingDelete.handle }), {
        variant: 'success',
      });
      setPendingDelete(null);
      await load();
    } catch (error) {
      enqueueSnackbar(resolveError(error, t), { variant: 'error' });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Box component="section" aria-label={t('watchlist.pageAriaLabel')}>
      <Typography variant="h1" component="h1" gutterBottom>
        {t('watchlist.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        {t('watchlist.subtitleBefore')} <strong>{t('watchlist.subtitleHighlight')}</strong>{' '}
        {t('watchlist.subtitleAfter')}
      </Typography>

      <Card sx={{ maxWidth: 640, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <TextField
                label={t('watchlist.handleLabel')}
                placeholder={t('watchlist.handlePlaceholder')}
                fullWidth
                error={!!errors.handle}
                helperText={errors.handle?.message}
                InputProps={{
                  startAdornment: <InputAdornment position="start">@</InputAdornment>,
                }}
                {...register('handle')}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                sx={{ flexShrink: 0, mt: { xs: 0, sm: 0.5 } }}
              >
                {isSubmitting ? t('watchlist.adding') : t('watchlist.add')}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {loading ? (
        <Box
          sx={{ py: 6, textAlign: 'center' }}
          role="status"
          aria-label={t('watchlist.loadingAriaLabel')}
        >
          <CircularProgress />
        </Box>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<PersonSearchIcon fontSize="inherit" />}
          title={t('watchlist.emptyTitle')}
          description={t('watchlist.emptyDescription')}
        />
      ) : (
        <Card sx={{ maxWidth: 640 }}>
          <List aria-label={t('watchlist.listAriaLabel')}>
            {accounts.map((account) => (
              <ListItem
                key={account.id}
                divider
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label={t('watchlist.removeAriaLabel', { handle: account.handle })}
                    color="error"
                    onClick={() => setPendingDelete(account)}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText primary={`@${account.handle}`} />
                <Chip
                  label={account.resolved ? t('watchlist.statusResolved') : t('watchlist.statusPending')}
                  color={account.resolved ? 'success' : 'default'}
                  variant={account.resolved ? 'filled' : 'outlined'}
                  size="small"
                  sx={{ mr: 6 }}
                />
              </ListItem>
            ))}
          </List>
        </Card>
      )}

      <Dialog
        open={!!pendingDelete}
        onClose={() => (!removing ? setPendingDelete(null) : undefined)}
        aria-labelledby="delete-watchlist-title"
        role="alertdialog"
      >
        <DialogTitle id="delete-watchlist-title">{t('watchlist.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('watchlist.deleteConfirmBefore')} <strong>@{pendingDelete?.handle}</strong>{' '}
            {t('watchlist.deleteConfirmAfter')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)} disabled={removing}>
            {t('watchlist.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={removing}
          >
            {removing ? t('watchlist.removing') : t('watchlist.remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function resolveError(error: unknown, t: TranslateFn): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data
    ?.message;
  return message || t('watchlist.genericError');
}
