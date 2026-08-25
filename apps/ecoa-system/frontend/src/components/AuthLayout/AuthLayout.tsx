'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { LanguageSwitcher } from 'src/components/LanguageSwitcher/LanguageSwitcher';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** Centered card used by all public auth screens (login/register/reset). */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: (t) =>
          `linear-gradient(135deg, ${t.palette.primary.main}22, ${t.palette.background.default})`,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <GraphicEqIcon color="primary" fontSize="large" />
            <Typography variant="h2" sx={{ fontWeight: 800 }}>
              Ecoa
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <LanguageSwitcher variant="button" />
          </Box>
          <Typography variant="h3" gutterBottom>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {subtitle}
            </Typography>
          )}
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}
