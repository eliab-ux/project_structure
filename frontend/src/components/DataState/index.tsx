'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

/**
 * Os três estados de uma lista que vem da API: carregando, erro e vazio.
 *
 * Cada um com o `role` de acessibilidade certo — `status` para carregando e vazio, `alert` para
 * erro. É a distinção que o leitor de tela usa para decidir se interrompe o usuário: "carregando"
 * pode esperar a próxima pausa, "falhou" não.
 *
 * Devolve `null` quando há dados, para o chamador seguir e renderizar a lista. A alternativa —
 * cada tela escrever seus próprios três `if` — daria três textos diferentes para a mesma situação.
 */
export function DataState({
  loading,
  error,
  empty,
  emptyMessage,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage: string;
}) {
  if (loading) {
    return (
      <Box
        role="status"
        aria-live="polite"
        sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
      >
        <CircularProgress aria-label="Carregando" />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" role="alert" sx={{ my: 2 }}>
        {error}
      </Alert>
    );
  }

  if (empty) {
    return (
      <Box role="status" sx={{ textAlign: 'center', p: 6 }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  return null;
}
