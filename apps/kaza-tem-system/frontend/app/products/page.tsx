'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';
import { FilterDrawer } from '@/components/FilterDrawer';
import { FilterSidebar } from '@/components/FilterSidebar';
import { Pagination } from '@/components/Pagination';
import { SortSelect } from '@/components/SortSelect';
import productService, { Product, ProductFilterParams } from '@/services/productService';

const DEFAULT_CATEGORIES = ['Tecnologia', 'Casa', 'Cozinha', 'Decoração', 'Ofertas'];
const PAGE_SIZE = 12;

const sortOptions = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'price_asc', label: 'Preço: menor primeiro' },
  { value: 'price_desc', label: 'Preço: maior primeiro' },
  { value: 'newest', label: 'Mais recentes' },
];

export default function ProductListingPage({ searchParams }: { searchParams?: { q?: string } }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(searchParams?.q ?? '');
  const [searchQuery, setSearchQuery] = useState(searchParams?.q ?? '');
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [sortValue, setSortValue] = useState(sortOptions[0].value);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload: ProductFilterParams = {
          q: searchQuery || undefined,
          category: selectedCategory,
          minPrice: priceRange[0] || undefined,
          maxPrice: priceRange[1] || undefined,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          sort: sortValue,
        };

        const data = await productService.getAll(payload);
        if (!mounted) return;
        setProducts(data);
        setHasNext(data.length === PAGE_SIZE);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os produtos.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchProducts();
    return () => {
      mounted = false;
    };
  }, [page, searchQuery, selectedCategory, priceRange, sortValue]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSelectedCategory(undefined);
    setPriceRange([0, 1000]);
    setSearchInput('');
    setSearchQuery('');
    setSortValue(sortOptions[0].value);
    setPage(1);
  };

  const summaryText = (() => {
    if (products.length === 0 && !loading) {
      return 'Nenhum produto encontrado com os filtros aplicados.';
    }
    return `Mostrando ${products.length} produto(s)`;
  })();

  return (
    <Box component="main" sx={{ px: { xs: 2, md: 4 }, py: 4 }}>
      <Stack spacing={3}>
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Produtos' }]} />
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={2}
        >
          <Box>
            <Typography variant="h4" component="h1">
              Catálogo de produtos
            </Typography>
            <Typography color="text.secondary">{summaryText}</Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <SortSelect
              value={sortValue}
              onChange={(value) => {
                setPage(1);
                setSortValue(value);
              }}
              options={sortOptions}
            />
            <Button
              variant="outlined"
              onClick={() => setDrawerOpen(true)}
              sx={{ display: { md: 'none' } }}
            >
              Filtros
            </Button>
          </Stack>
        </Stack>

        <Box component="form" onSubmit={handleSearch}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Buscar produtos"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              fullWidth
              placeholder="Nome, SKU ou categoria"
            />
            <Button type="submit" variant="contained">
              Buscar
            </Button>
          </Stack>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={3} sx={{ display: { xs: 'none', md: 'block' } }}>
            <FilterSidebar
              categories={DEFAULT_CATEGORIES}
              selectedCategory={selectedCategory}
              priceRange={priceRange}
              onCategoryChange={(category) => {
                setPage(1);
                setSelectedCategory(category);
              }}
              onPriceRangeChange={(value) => {
                setPage(1);
                setPriceRange([value[0], value[1]]);
              }}
              onReset={handleResetFilters}
            />
          </Grid>

          <Grid item xs={12} md={9}>
            <Stack spacing={2}>
              {loading ? (
                <Stack alignItems="center" spacing={1}>
                  <CircularProgress />
                  <Typography>Carregando produtos...</Typography>
                </Stack>
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : products.length === 0 ? (
                <Alert severity="info">{summaryText}</Alert>
              ) : (
                <>
                  <Grid container spacing={2}>
                    {products.map((product) => (
                      <Grid key={product.id} item xs={12} sm={6} md={4}>
                        <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                          <Stack spacing={1}>
                            <Typography variant="subtitle2" color="text.secondary">
                              SKU {product.sku}
                            </Typography>
                            <Typography variant="h6">{product.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {product.description ?? 'Produto sem descrição adicional.'}
                            </Typography>
                            <Typography variant="h6" color="primary">
                              R$ {product.price.toFixed(2)}
                            </Typography>
                            <Divider />
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="body2" color="text.secondary">
                                Estoque: {product.stock}
                              </Typography>
                              <Typography variant="body2">
                                {product.categoryId ?? 'Categoria livre'}
                              </Typography>
                            </Stack>
                            <Button
                              variant="outlined"
                              size="small"
                              component={Link}
                              href={`/products/${product.id}`}
                            >
                              Ver detalhes
                            </Button>
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                  <Pagination page={page} hasNext={hasNext} onPageChange={setPage} />
                </>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Stack>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categories={DEFAULT_CATEGORIES}
        selectedCategory={selectedCategory}
        priceRange={priceRange}
        onCategoryChange={(category) => {
          setPage(1);
          setSelectedCategory(category);
        }}
        onPriceRangeChange={(value) => setPriceRange([value[0], value[1]])}
        onReset={() => {
          handleResetFilters();
          setDrawerOpen(false);
        }}
      />
    </Box>
  );
}
