'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Moldura das telas de acesso (login, troca e recuperação de senha). */
export function AuthLayout({ eyebrow, title, description, children, footer }: AuthLayoutProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
        py: 6,
      }}
    >
      <Container maxWidth="xs">
        <Paper
          variant="outlined"
          sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, borderColor: 'divider' }}
        >
          <Typography variant="overline" component="p" sx={{ color: 'info.main' }}>
            {eyebrow}
          </Typography>
          <Typography variant="h2" component="h1" sx={{ mt: 0.5 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.55 }}>
              {description}
            </Typography>
          )}
          <Box sx={{ mt: 3 }}>{children}</Box>
          {footer && <Box sx={{ mt: 3 }}>{footer}</Box>}
        </Paper>
      </Container>
    </Box>
  );
}
