'use client';

import Link from 'next/link';
import { Button, Container, Paper, Stack, Typography } from '@mui/material';

export default function AguardandoAprovacaoPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Typography variant="h4">Cadastro recebido</Typography>
          <Typography color="text.secondary">
            Seu cadastro foi enviado para anÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lise. Em
            atÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© 24h ÃƒÆ’Ã†â€™Ãƒâ€
            Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºteis nossa equipe valida as informaÃƒÆ’Ã†â€™Ãƒâ€
            Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes e envia um
            email com a decisÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o.
          </Typography>
          <Typography color="text.secondary">
            Enquanto isso, vocÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âª pode acompanhar o status do
            pedido de cadastro pelo email ou voltar para a pÃƒÆ’Ã†â€™Ãƒâ€
            Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡gina inicial.
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" component={Link} href="/">
              Voltar ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â home
            </Button>
            <Button variant="outlined" component={Link} href="/auth/login">
              Fazer login
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
}
