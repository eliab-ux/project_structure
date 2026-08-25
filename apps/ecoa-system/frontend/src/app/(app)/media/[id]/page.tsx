'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import mediaService from 'src/services/mediaService';
import { KpiCard } from 'src/components/KpiCard/KpiCard';
import { InsightSnapshot } from 'src/types';
import { useI18n } from 'src/i18n/I18nProvider';

export default function MediaDetailPage() {
  const { t } = useI18n();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [insights, setInsights] = useState<InsightSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setInsights(await mediaService.insights(id));
    } catch {
      enqueueSnackbar(t('media.loadDetailError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, enqueueSnackbar, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = insights.length > 0 ? insights[insights.length - 1] : null;

  const chartData = useMemo(
    () =>
      insights.map((snapshot) => ({
        date: format(new Date(snapshot.capturedAt), 'dd/MM'),
        reach: snapshot.reach,
        sharesCount: snapshot.sharesCount,
        likes: snapshot.likes,
      })),
    [insights],
  );

  return (
    <Box component="section" aria-label={t('media.detailSectionLabel')}>
      <Button
        component={Link}
        href="/media"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
        color="inherit"
      >
        {t('media.back')}
      </Button>

      <Typography variant="h1" gutterBottom>
        {t('media.detailTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        {t('media.detailSubtitle')}
      </Typography>

      {loading ? (
        <Box sx={{ py: 6, textAlign: 'center' }} role="status" aria-label={t('media.loading')}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {latest && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} md={3}>
                <KpiCard label={t('media.metricReach')} value={latest.reach.toLocaleString('pt-BR')} />
              </Grid>
              <Grid item xs={6} md={3}>
                <KpiCard
                  label={t('media.metricShares')}
                  value={latest.sharesCount.toLocaleString('pt-BR')}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <KpiCard label={t('media.metricLikes')} value={latest.likes.toLocaleString('pt-BR')} />
              </Grid>
              <Grid item xs={6} md={3}>
                <KpiCard label={t('media.metricSaved')} value={latest.saved.toLocaleString('pt-BR')} />
              </Grid>
            </Grid>
          )}

          {insights.length === 0 ? (
            <Alert severity="info" role="status" sx={{ mb: 3, maxWidth: 640 }}>
              {t('media.metricsAfterFirstCapture')}
            </Alert>
          ) : (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h4" gutterBottom>
                  {t('media.metricsEvolution')}
                </Typography>
                <Box sx={{ width: '100%', height: 320, overflowX: 'auto' }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                      <XAxis dataKey="date" stroke={theme.palette.text.secondary} fontSize={12} />
                      <YAxis
                        stroke={theme.palette.text.secondary}
                        fontSize={12}
                        allowDecimals={false}
                      />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="reach"
                        name={t('media.metricReach')}
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="sharesCount"
                        name={t('media.metricShares')}
                        stroke={theme.palette.secondary.main}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="likes"
                        name={t('media.metricLikes')}
                        stroke={theme.palette.info.main}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
