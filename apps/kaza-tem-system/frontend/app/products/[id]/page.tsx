import { notFound } from 'next/navigation';
import { Box, Divider, Grid, Paper, Stack, Typography } from '@mui/material';
import { Breadcrumb } from '@/components/Breadcrumb';
import { ProductGallery } from '@/components/ProductGallery';
import { PriceDisplay } from '@/components/PriceDisplay';
import { ProductPurchasePanel } from '@/components/ProductPurchasePanel';
import { ShippingCalculator } from '@/components/ShippingCalculator';
import { RelatedProducts } from '@/components/RelatedProducts';
import productService, { Product } from '@/services/productService';

type ProductDetailPageProps = {
  params: { id: string };
};

async function fetchProduct(id: string): Promise<Product> {
  try {
    return await productService.getById(id);
  } catch (error) {
    throw new Error('Produto não encontrado');
  }
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  let product: Product;
  try {
    product = await fetchProduct(params.id);
  } catch {
    notFound();
  }

  const compareAt = product.costPrice > product.price ? product.costPrice : undefined;

  return (
    <Box component="main" sx={{ px: { xs: 2, md: 4 }, py: 4 }}>
      <Stack spacing={3}>
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Produtos', href: '/products' },
            { label: product.name },
          ]}
        />
        <Grid container spacing={4}>
          <Grid item xs={12} md={7}>
            <ProductGallery images={product.images ?? []} />
            <Paper sx={{ mt: 3, p: 3 }}>
              <Typography variant="h6">Descrição</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {product.description ?? 'Este produto ainda não possui descrição completa.'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              <Paper sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Typography variant="h5">{product.name}</Typography>
                  <PriceDisplay price={product.price} compareAt={compareAt} />
                  <Divider />
                  <ProductPurchasePanel
                    stock={product.stock}
                    product={{
                      id: product.id,
                      sku: product.sku,
                      name: product.name,
                      price: product.price,
                    }}
                  />
                </Stack>
              </Paper>
              <ShippingCalculator />
            </Stack>
          </Grid>
        </Grid>
        <RelatedProducts categoryId={product.categoryId} excludeId={product.id} />
      </Stack>
    </Box>
  );
}
