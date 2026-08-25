'use client';

import { useEffect, useState } from 'react';
import { Button, CircularProgress, Grid, Paper, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import productService, { Product } from '@/services/productService';

type RelatedProductsProps = {
  categoryId: string | null;
  excludeId: string;
};

export function RelatedProducts({ categoryId, excludeId }: RelatedProductsProps) {
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId) {
      setRelated([]);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    productService
      .getAll({ category: categoryId, limit: 4 })
      .then((products) => {
        if (!mounted) return;
        setRelated(products.filter((product) => product.id !== excludeId));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(
          err instanceof Error ? err.message : 'Não foi possível carregar produtos relacionados.',
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [categoryId, excludeId]);

  if (!categoryId) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Produtos relacionados</Typography>
      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={20} />
          <Typography>Carregando sugestões...</Typography>
        </Stack>
      ) : error ? (
        <Typography color="error.main">{error}</Typography>
      ) : (
        <Grid container spacing={2}>
          {related.map((product) => (
            <Grid key={product.id} item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2">{product.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  R$ {product.price.toFixed(2)}
                </Typography>
                <Button size="small" component={Link} href={`/products/${product.id}`}>
                  Ver produto
                </Button>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}
