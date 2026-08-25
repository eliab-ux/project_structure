'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import authService from 'src/services/authService';

type Status = 'loading' | 'ready' | 'error';

export default function SessaoEntryPage() {
  const params = useParams<{ hash: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [nome, setNome] = useState('');
  const code = searchParams.get('code');

  useEffect(() => {
    const hash = params?.hash;
    if (!hash || !code) {
      setStatus('error');
      return;
    }
    authService
      .pacienteSessionAccess(hash)
      .then((result) => {
        setNome(result.nome);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [params, code]);

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
          {status === 'loading' && (
            <Box role="status" aria-label="Preparando sessão">
              <CircularProgress />
            </Box>
          )}
          {status === 'ready' && (
            <>
              <Typography variant="h3" color="primary" gutterBottom>
                Olá, {nome}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Sua sessão está pronta. Clique para entrar.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => router.replace(`/emdr/${code}?role=paciente`)}
              >
                Entrar na sessão
              </Button>
            </>
          )}
          {status === 'error' && (
            <Typography variant="body1" color="error" role="alert">
              Link inválido ou expirado. Solicite um novo convite ao seu psicólogo.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
