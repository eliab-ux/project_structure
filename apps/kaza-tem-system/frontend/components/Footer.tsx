'use client';

import { Box, Container, Typography, Link } from '@mui/material';
import { styled } from '@mui/material/styles';

const FooterContainer = styled('footer')(({ theme }) => ({
  marginTop: theme.spacing(8),
  padding: theme.spacing(4, 0),
  background: '#111',
  color: '#fff',
}));

export function Footer() {
  return (
    <FooterContainer>
      <Container maxWidth="lg">
        <Typography variant="body2">
          © {new Date().getFullYear()} Kaza Tem Imports. Todos os direitos reservados.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Link href="#" color="inherit" underline="hover">
            Sobre nós
          </Link>
          <Link href="#" color="inherit" underline="hover">
            Atendimento
          </Link>
          <Link href="#" color="inherit" underline="hover">
            Termos
          </Link>
        </Box>
      </Container>
    </FooterContainer>
  );
}
