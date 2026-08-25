'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from 'src/context/AuthContext';
import { PatientForm } from 'src/components/PatientForm/PatientForm';

export default function NovoPacientePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <Box
        sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}
        role="status"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <AppBar position="static" color="primary" component="header">
        <Toolbar>
          <Button
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/dashboard')}
          >
            Voltar
          </Button>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 1 }}>
            Novo paciente
          </Typography>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="sm" sx={{ py: 4 }}>
        <PatientForm />
      </Container>
    </>
  );
}
