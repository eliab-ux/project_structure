'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Link from 'next/link';
import RepeatIcon from '@mui/icons-material/Repeat';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DateRangeIcon from '@mui/icons-material/DateRange';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KpiCard } from 'src/components/KpiCard/KpiCard';
import { EmptyState } from 'src/components/EmptyState/EmptyState';
import { PeriodSelector } from 'src/components/PeriodSelector/PeriodSelector';
import { useI18n } from 'src/i18n/I18nProvider';
import connectionService from 'src/services/connectionService';
import detectionService from 'src/services/detectionService';
import { Connection, Detection, DetectionSummary } from 'src/types';

const RECENT_LIMIT = 6;
const RANKING_LIMIT = 8;

export default function DashboardPage() {
  const { t } = useI18n();
  const { enqueueSnackbar } = useSnackbar();

  const [connection, setConnection] = useState<Connection | null>(null);
  const [summary, setSummary] = useState<DetectionSummary | null>(null);
  const [recent, setRecent] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load the cockpit data sources in parallel — the home should feel instant.
      const [status, detectionSummary, recentPage] = await Promise.all([
        connectionService.getStatus(),
        detectionService.summary(),
        detectionService.list({ page: 1, limit: RECENT_LIMIT }),
      ]);
      setConnection(status);
      setSummary(detectionSummary);
      setRecent(recentPage.items);
    } catch {
      enqueueSnackbar(t('dashboard.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const connected = connection?.connected === true;

  // Top accounts that repost the most, capped to a readable ranking.
  const ranking = useMemo(() => {
    const byAccount = summary?.byAccount ?? [];
    return [...byAccount].sort((a, b) => b.count - a.count).slice(0, RANKING_LIMIT);
  }, [summary]);

  const maxCount = ranking[0]?.count ?? 0;

  return (
    <Box component="section" aria-label={t('dashboard.sectionAriaLabel')}>
      <Box
        component="header"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h1" component="h1">
            {t('dashboard.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.subtitle')}
          </Typography>
        </Box>
        <PeriodSelector />
      </Box>

      {loading ? (
        <Box sx={{ py: 10, textAlign: 'center' }} role="status" aria-label={t('dashboard.loadingAriaLabel')}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {!connected && (
            <Alert
              severity="warning"
              icon={<LinkOffIcon />}
              role="alert"
              action={
                <Button component={Link} href="/connection" color="inherit" size="small">
                  {t('dashboard.connectButton')}
                </Button>
              }
              sx={{ mb: 3 }}
            >
              <AlertTitle>{t('dashboard.connectAlertTitle')}</AlertTitle>
              {t('dashboard.connectAlertBody')}
            </Alert>
          )}

          {/* KPI strip — the headline numbers of the cockpit. */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={4}>
              <KpiCard
                label={t('dashboard.kpiTotalLabel')}
                value={summary?.total ?? 0}
                hint={t('dashboard.kpiTotalHint')}
                icon={<RepeatIcon />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <KpiCard
                label={t('dashboard.kpiLast7Label')}
                value={summary?.last7Days ?? 0}
                hint={t('dashboard.kpiPeriodHint')}
                icon={<CalendarTodayIcon />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <KpiCard
                label={t('dashboard.kpiLast30Label')}
                value={summary?.last30Days ?? 0}
                hint={t('dashboard.kpiPeriodHint')}
                icon={<DateRangeIcon />}
              />
            </Grid>
          </Grid>

          {connected && (summary?.total ?? 0) === 0 ? (
            <Card>
              <EmptyState
                icon={<RepeatIcon fontSize="inherit" />}
                title={t('dashboard.emptyTitle')}
                description={t('dashboard.emptyDescription')}
                actionLabel={t('dashboard.emptyActionLabel')}
                actionHref="/watchlist"
              />
            </Card>
          ) : (
            <Grid container spacing={2.5} alignItems="stretch">
              {/* Ranking — who reposts the most. */}
              <Grid item xs={12} md={6}>
                <Card
                  component="section"
                  aria-label={t('dashboard.rankingAriaLabel')}
                  sx={{ height: '100%' }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
                      <LeaderboardIcon color="primary" />
                      <Typography variant="h4" component="h2">
                        {t('dashboard.rankingTitle')}
                      </Typography>
                    </Stack>

                    {ranking.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {t('dashboard.rankingEmpty')}
                      </Typography>
                    ) : (
                      <Stack component="ol" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                        {ranking.map((account) => {
                          const percent = maxCount > 0 ? (account.count / maxCount) * 100 : 0;
                          return (
                            <Box component="li" key={account.sourceUsername}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'baseline',
                                  mb: 0.5,
                                }}
                              >
                                <Typography variant="subtitle2">
                                  @{account.sourceUsername}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" fontWeight={700}>
                                  {account.count}
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={percent}
                                aria-label={t('dashboard.rankingBarAriaLabel', {
                                  username: account.sourceUsername,
                                  count: account.count,
                                })}
                                sx={{
                                  height: 8,
                                  borderRadius: 4,
                                  bgcolor: 'action.hover',
                                  '& .MuiLinearProgress-bar': { borderRadius: 4 },
                                }}
                              />
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Recent detections feed. */}
              <Grid item xs={12} md={6}>
                <Card component="section" aria-label={t('dashboard.recentAriaLabel')} sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 2.5,
                      }}
                    >
                      <Typography variant="h4" component="h2">
                        {t('dashboard.recentTitle')}
                      </Typography>
                      <Button component={Link} href="/detections" size="small">
                        {t('dashboard.viewAll')}
                      </Button>
                    </Box>

                    {recent.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {t('dashboard.recentEmpty')}
                      </Typography>
                    ) : (
                      <Stack spacing={1.5}>
                        {recent.map((detection) => (
                          <RecentDetectionCard key={detection.id} detection={detection} />
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Box>
  );
}

function RecentDetectionCard({ detection }: { detection: Detection }) {
  const { t } = useI18n();
  const theme = useTheme();
  const relative = formatRelative(detection.detectedAt);

  return (
    <Card
      component="article"
      variant="outlined"
      sx={{
        borderLeft: detection.highlighted
          ? `4px solid ${theme.palette.primary.main}`
          : `1px solid ${theme.palette.divider}`,
      }}
    >
      <CardContent
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          py: 1.5,
          '&:last-child': { pb: 1.5 },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
          >
            <Typography variant="subtitle2" noWrap>
              @{detection.sourceUsername}
            </Typography>
            {detection.highlighted && (
              <Chip label={t('dashboard.fromYourList')} color="primary" size="small" variant="outlined" />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('dashboard.timeAgo', { relative })}
          </Typography>
        </Box>

        {detection.permalink && (
          <Button
            component="a"
            href={detection.permalink}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            endIcon={<OpenInNewIcon />}
            aria-label={t('dashboard.openRepostAriaLabel', { username: detection.sourceUsername })}
          >
            {t('dashboard.openButton')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function formatRelative(value: string): string {
  try {
    return formatDistanceToNow(new Date(value), { locale: ptBR });
  } catch {
    return '—';
  }
}
