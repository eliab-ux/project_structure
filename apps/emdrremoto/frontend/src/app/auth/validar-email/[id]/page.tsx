'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import authService from 'src/services/authService';

type Status = 'loading' | 'ok' | 'error';

export default function ValidarEmailPage() {
  const params = useParams<{ id: string }>();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const id = params?.id;
    if (!id) {
      setStatus('error');
      return;
    }
    authService
      .verifyEmail(id)
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'));
  }, [params]);

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
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent component="section" sx={{ textAlign: 'center' }}>
          {status === 'loading' && (
            <Box role="status" aria-label="Verificando e-mail">
              <CircularProgress />
            </Box>
          )}
          {status === 'ok' && (
            <>
              <Typography variant="h3" color="success.main" gutterBottom>
                E-mail verificado!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Sua conta está ativa. Você já pode entrar.
              </Typography>
              <Button component={Link} href="/auth/login" variant="contained">
                Ir para o login
              </Button>
            </>
          )}
          {status === 'error' && (
            <Typography variant="body1" color="error" role="alert">
              Não foi possível verificar este e-mail. O link pode ser inválido.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
