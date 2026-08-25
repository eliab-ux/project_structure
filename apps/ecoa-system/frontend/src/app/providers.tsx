'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SnackbarProvider } from 'notistack';
import { theme } from 'src/theme/theme';
import { AuthProvider } from 'src/context/AuthContext';
import { I18nProvider } from 'src/i18n/I18nProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <I18nProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SnackbarProvider
            maxSnack={3}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            autoHideDuration={4000}
          >
            <AuthProvider>{children}</AuthProvider>
          </SnackbarProvider>
        </ThemeProvider>
      </I18nProvider>
    </AppRouterCacheProvider>
  );
}
