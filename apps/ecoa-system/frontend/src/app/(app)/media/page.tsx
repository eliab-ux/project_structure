'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Pagination from '@mui/material/Pagination';
import CircularProgress from '@mui/material/CircularProgress';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { useSnackbar } from 'notistack';
import mediaService from 'src/services/mediaService';
import { EmptyState } from 'src/components/EmptyState/EmptyState';
import { Media } from 'src/types';
import { useI18n } from 'src/i18n/I18nProvider';

const PAGE_LIMIT = 12;

export default function MediaListPage() {
  const { t } = useI18n();
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState<Media[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const result = await mediaService.list({ page: targetPage, limit: PAGE_LIMIT });
        setItems(result.items);
        setTotal(result.total);
      } catch {
        enqueueSnackbar(t('media.loadListError'), { variant: 'error' });
      } finally {
        setLoading(false);
      }
    },
    [enqueueSnackbar, t],
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <Box component="section" aria-label={t('media.listSectionLabel')}>
      <Typography variant="h1" gutterBottom>
        {t('media.listTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        {t('media.listSubtitle')}
      </Typography>

      {loading ? (
        <Box sx={{ py: 6, textAlign: 'center' }} role="status" aria-label={t('media.loading')}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<PhotoLibraryOutlinedIcon fontSize="inherit" />}
          title={t('media.emptyTitle')}
          description={t('media.emptyDescription')}
          actionLabel={t('media.connectInstagram')}
          actionHref="/connection"
        />
      ) : (
        <>
          <Grid container spacing={2} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {items.map((media) => (
              <Grid key={media.id} item xs={12} sm={6} md={4} lg={3} component="li">
                <MediaCard media={media} />
              </Grid>
            ))}
          </Grid>

          {pageCount > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={pageCount}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
                aria-label={t('media.paginationLabel')}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

function MediaCard({ media }: { media: Media }) {
  const { t } = useI18n();
  const caption = media.caption?.trim();
  const excerpt = caption
    ? caption.length > 80
      ? `${caption.slice(0, 80).trimEnd()}…`
      : caption
    : t('media.noCaption');

  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea
        component={Link}
        href={`/media/${media.id}`}
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {media.thumbnailUrl ? (
          <CardMedia
            component="img"
            image={media.thumbnailUrl}
            alt={excerpt}
            sx={{ aspectRatio: '1 / 1', objectFit: 'cover' }}
          />
        ) : (
          <Box
            aria-hidden
            sx={{
              aspectRatio: '1 / 1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'background.default',
              color: 'text.secondary',
            }}
          >
            <ImageOutlinedIcon sx={{ fontSize: 48 }} />
          </Box>
        )}
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            {excerpt}
          </Typography>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
          >
            <Typography variant="caption" color="text.secondary">
              {new Date(media.publishedAt).toLocaleDateString('pt-BR')}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
