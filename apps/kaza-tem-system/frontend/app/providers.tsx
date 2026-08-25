'use client';

import type { ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { muiTheme, styledTheme } from '../styles/theme';
import { AuthProvider } from '../contexts/AuthContext';
import { ResellerAuthProvider } from '../contexts/ResellerAuthContext';
import { AdminAuthProvider } from '../contexts/AdminAuthContext';
import { CartProvider } from '../contexts/CartContext';
import { CheckoutProvider } from '../contexts/CheckoutContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={muiTheme}>
      <StyledThemeProvider theme={styledTheme}>
        <CssBaseline />
        <AuthProvider>
          <ResellerAuthProvider>
            <AdminAuthProvider>
              <CheckoutProvider>
                <CartProvider>{children}</CartProvider>
              </CheckoutProvider>
            </AdminAuthProvider>
          </ResellerAuthProvider>
        </AuthProvider>
      </StyledThemeProvider>
    </ThemeProvider>
  );
}
