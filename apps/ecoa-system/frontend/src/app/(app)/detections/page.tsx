'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Pagination from '@mui/material/Pagination';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSnackbar } from 'notistack';
import { usePeriod } from 'src/context/PeriodContext';
import { useI18n } from 'src/i18n/I18nProvider';
import detectionService from 'src/services/detectionService';
import { Detection, DetectionType, Paginated } from 'src/types';
import { EmptyState } from 'src/components/EmptyState/EmptyState';
import { PeriodSelector } from 'src/components/PeriodSelector/PeriodSelector';

const PAGE_LIMIT = 20;

/** Feed filter for the seen state. `undefined` means "all" (no filter sent to the API). */
type SeenFilter = 'all' | 'unseen';

const DETECTION_TYPE_LABEL_KEYS: Record<DetectionType, string> = {
  caption_mention: 'detections.typeCaptionMention',
  comment_mention: 'detections.typeCommentMention',
  tag: 'detections.typeTag',
};

export default function DetectionsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { from, to } = usePeriod();
  const { t } = useI18n();

  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [seenFilter, setSeenFilter] = useState<SeenFilter>('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Detection> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await detectionService.list({
        watchlistOnly,
        seen: seenFilter === 'unseen' ? false : undefined,
        from,
        to,
        page,
        limit: PAGE_LIMIT,
      });
      setResult(data);
    } catch {
      enqueueSnackbar(t('detections.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [watchlistOnly, seenFilter, from, to, page, enqueueSnackbar, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Any filter or period change resets to the first page so the feed stays coherent.
  useEffect(() => {
    setPage(1);
  }, [watchlistOnly, seenFilter, from, to]);

  async function handleMarkSeen(id: string) {
    // Optimistic update — the feed reflects the action immediately.
    setResult((prev) =>
      prev
        ? { ...prev, items: prev.items.map((d) => (d.id === id ? { ...d, seen: true } : d)) }
        : prev,
    );
    try {
      await detectionService.markSeen(id);
      enqueueSnackbar(t('detections.markSeenSuccess'), { variant: 'success' });
    } catch {
      // Revert on failure.
      setResult((prev) =>
        prev
          ? { ...prev, items: prev.items.map((d) => (d.id === id ? { ...d, seen: false } : d)) }
          : prev,
      );
      enqueueSnackbar(t('detections.markSeenError'), { variant: 'error' });
    }
  }

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_LIMIT)), [total]);

  return (
    <Box component="section" aria-label={t('detections.sectionAriaLabel')}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Typography variant="h1">{t('detections.title')}</Typography>
        <PeriodSelector />
      </Stack>

      <Stack
        component="header"
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 3 }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={watchlistOnly}
              onChange={(_e, checked) => setWatchlistOnly(checked)}
              color="primary"
            />
          }
          label={t('detections.watchlistOnlyLabel')}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={seenFilter}
          onChange={(_e, value) => value && setSeenFilter(value as SeenFilter)}
          aria-label={t('detections.seenFilterAriaLabel')}
          color="primary"
        >
          <ToggleButton value="all" aria-label={t('detections.filterAllAriaLabel')}>
            {t('detections.filterAll')}
          </ToggleButton>
          <ToggleButton value="unseen" aria-label={t('detections.filterUnseenAriaLabel')}>
            {t('detections.filterUnseen')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {loading ? (
        <Box sx={{ py: 6, textAlign: 'center' }} role="status" aria-label={t('detections.loadingAriaLabel')}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('detections.emptyTitle')}
          description={t('detections.emptyDescription')}
        />
      ) : (
        <>
          <Stack component="ul" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {items.map((detection) => (
              <DetectionCard key={detection.id} detection={detection} onMarkSeen={handleMarkSeen} />
            ))}
          </Stack>

          {pageCount > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={pageCount}
                page={page}
                onChange={(_e, value) => setPage(value)}
                color="primary"
                aria-label={t('detections.paginationAriaLabel')}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

interface DetectionCardProps {
  detection: Detection;
  onMarkSeen: (id: string) => void;
}

function DetectionCard({ detection, onMarkSeen }: DetectionCardProps) {
  const { t } = useI18n();
  const relativeTime = formatDistanceToNow(new Date(detection.detectedAt), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <Card
      component="li"
      sx={{
        opacity: detection.seen ? 0.6 : 1,
        borderLeft: detection.highlighted ? 4 : undefined,
        borderLeftColor: detection.highlighted ? 'primary.main' : undefined,
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body1">
              <Box component="span" sx={{ fontWeight: 700 }}>
                @{detection.sourceUsername}
              </Box>{' '}
              {t('detections.sharedYourPost')}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 1 }}
            >
              <Chip
                size="small"
                label={t(DETECTION_TYPE_LABEL_KEYS[detection.detectionType])}
                variant="outlined"
              />
              {detection.highlighted && (
                <Chip size="small" label={t('detections.fromYourListChip')} color="primary" />
              )}
              <Typography variant="caption" color="text.secondary">
                {relativeTime}
              </Typography>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
            {!detection.seen && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<CheckCircleOutlineIcon />}
                onClick={() => onMarkSeen(detection.id)}
              >
                {t('detections.markSeenButton')}
              </Button>
            )}
            {detection.permalink && (
              <Tooltip title={t('detections.viewPostTooltip')}>
                <IconButton
                  size="small"
                  color="primary"
                  component="a"
                  href={detection.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('detections.viewPostAriaLabel')}
                >
                  <OpenInNewIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
