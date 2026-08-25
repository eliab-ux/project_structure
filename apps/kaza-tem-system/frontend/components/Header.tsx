'use client';

import { useState } from 'react';
import { Box, Container, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FavoriteBorder, Menu } from '@mui/icons-material';
import { CartIcon } from './cart/CartIcon';
import { CartDrawer } from './cart/CartDrawer';

const HeaderBar = styled('header')(({ theme }) => ({
  background: theme.palette.primary.main,
  padding: theme.spacing(1, 0),
  position: 'sticky',
  top: 0,
  zIndex: 999,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
}));

const Logo = styled('div')(() => ({
  fontWeight: 700,
  letterSpacing: 1,
  color: '#000',
}));

export function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <HeaderBar>
      <Container
        maxWidth="lg"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Logo>Kaza Tem Imports</Logo>
        <Box
          component="nav"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CartIcon onClick={() => setDrawerOpen(true)} />
          <IconButton color="default">
            <FavoriteBorder />
          </IconButton>
          <IconButton color="default">
            <Menu />
          </IconButton>
        </Box>
        <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </Container>
    </HeaderBar>
  );
}
