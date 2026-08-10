'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** The frame shared by login, forgot-password and reset-password. Semantic HTML per CLAUDE.md §3. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper
        component="section"
        aria-label={title}
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 3, sm: 4 },
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Box component="header" sx={{ mb: 3 }}>
          <Typography variant="h1" color="primary.main" sx={{ mb: 0.5 }}>
            Veertex
          </Typography>
          <Typography variant="h2" component="h2" sx={{ mb: subtitle ? 0.5 : 0 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>

        {children}

        {footer ? <Box sx={{ mt: 3 }}>{footer}</Box> : null}
      </Paper>
    </Box>
  );
}
