'use client';

import { Box, Container, Typography, Chip, Grid, Button, Stack } from '@mui/material';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProductCard } from '@/components/ProductCard';
import { SearchBar } from '@/components/SearchBar';
import { ResellerSignup } from '@/components/ResellerSignup';
import Link from 'next/link';

const featuredProducts = [
  {
    name: 'Conjunto de Panelas Antiaderente',
    price: '399,90',
    oldPrice: '499,90',
    image:
      'https://images.unsplash.com/photo-1505253758473-1a91e9aebd3c?auto=format&fit=crop&w=600&q=80',
    badge: 'Oferta',
  },
  {
    name: 'Cafeteira Espresso Compacta',
    price: '899,90',
    image:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80',
    badge: 'Novo',
  },
  {
    name: 'Smart TV 55" 4K',
    price: '2.499,90',
    image:
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
    badge: 'Mais Vendido',
  },
];

const categories = ['Casa', 'Cozinha', 'Tecnologia', 'Casa e Decoração', 'Ofertas'];

export default function HomePage() {
  const scrollToResellerForm = () => {
    const target = document.getElementById('revendedores');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #FFE600 0%, #F5F5F5 40%)',
      }}
    >
      <Header />
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box
          sx={{
            background: '#fff',
            borderRadius: 4,
            padding: 4,
            boxShadow: '0 15px 30px rgba(0,0,0,0.08)',
          }}
        >
          <Typography variant="h3" gutterBottom>
            O maior marketplace de revendedores do Brasil
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Descubra produtos de alta demanda, monte campanhas e acelere o faturamento com{' '}
            comissionamento progressivo.
          </Typography>
          <SearchBar />
        </Box>

        <Box sx={{ mt: 6 }}>
          <Typography variant="h5" gutterBottom>
            Categorias em destaque
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {categories.map((category) => (
              <Chip key={category} label={category} color="secondary" />
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 6 }}>
          <Typography variant="h5" gutterBottom>
            Produtos em oferta
          </Typography>
          <Grid container spacing={3}>
            {featuredProducts.map((product) => (
              <Grid item xs={12} sm={6} md={4} key={product.name}>
                <ProductCard {...product} />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box sx={{ mt: 8, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom>
            Cadastre-se como revendedor
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Aproveite ferramentas exclusivas, divulgando seus links e acompanhando comissões em um
            painel completo.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              color="primary"
              onClick={scrollToResellerForm}
              type="button"
            >
              Quero ser revendedor
            </Button>
            <Button
              component={Link}
              href="/auth/login"
              variant="outlined"
              color="secondary"
              sx={{ borderColor: '#fff' }}
            >
              Já sou revendedor
            </Button>
            <Button
              component={Link}
              href="/admin/login"
              variant="outlined"
              color="info"
              sx={{ borderWidth: 2 }}
            >
              Portal Admin
            </Button>
          </Stack>
        </Box>
        <Box sx={{ mt: 4 }}>
          <ResellerSignup />
        </Box>
      </Container>
      <Footer />
    </Box>
  );
}
