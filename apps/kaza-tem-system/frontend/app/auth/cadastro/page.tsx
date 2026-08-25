'use client';

import { Container, Stack, Typography } from '@mui/material';
import { ResellerSignup } from '@/components/ResellerSignup';

export default function CadastroPage() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Typography variant="h4">Cadastro de revendedor</Typography>
          <Typography color="text.secondary">
            Preencha o formulário em etapas e confirme seus dados para que nossa equipe possa
            avaliar em até 24h úteis.
          </Typography>
        </Stack>
        <ResellerSignup />
      </Stack>
    </Container>
  );
}
