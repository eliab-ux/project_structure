'use client';

import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

const materials = [
  {
    title: 'Banner Verão 2026',
    type: 'Banner',
    description: 'Banner com foco em promoções sazonais.',
    active: true,
  },
  {
    title: 'Catálogo Linha Premium',
    type: 'Catálogo',
    description: 'PDF completo com coleções premium.',
    active: false,
  },
  {
    title: 'Vídeo Institucional',
    type: 'Vídeo',
    description: 'Vídeo para redes sociais e treinamentos.',
    active: true,
  },
];

export default function AdminMaterialsPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Materiais de Marketing</Typography>
          <Typography color="text.secondary">
            Upload e controle de materiais disponíveis para os revendedores (imagens, catálogos e
            vídeos).
          </Typography>
        </Box>

        <Paper
          sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Typography>
            Uploads via Supabase Storage com thumbnails automáticos para imagens.
          </Typography>
          <Button variant="contained">Novo material</Button>
        </Paper>

        <Grid container spacing={2}>
          {materials.map((material) => (
            <Grid key={material.title} item xs={12} md={4}>
              <Card elevation={2}>
                <CardMedia sx={{ height: 140, backgroundColor: '#f0f0f0' }} />
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h6">{material.title}</Typography>
                    <Chip label={material.type} size="small" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {material.description}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button size="small">Editar</Button>
                  <Button size="small" color="error">
                    Remover
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}
