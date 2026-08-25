'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

export default function ChamadaEncerradaPage() {
  return (
    <Box
      component="main"
      sx={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 460 }}>
        <CardContent component="section" sx={{ textAlign: 'center' }}>
          <Typography variant="h3" color="primary" gutterBottom>
            Sessão encerrada
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Obrigado por utilizar o EMDR Remoto.
          </Typography>
          <Button component={Link} href="/" variant="contained">
            Voltar ao início
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
