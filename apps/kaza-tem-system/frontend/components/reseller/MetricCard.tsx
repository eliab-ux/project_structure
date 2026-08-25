'use client';

import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

interface MetricCardProps {
  label: string;
  value: string;
  trend: string;
  icon: ReactNode;
  accent?: string;
}

export function MetricCard({ label, value, trend, icon, accent }: MetricCardProps) {
  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        borderRadius: 3,
        background: accent ? `linear-gradient(180deg, ${accent} 0%, #fff 100%)` : '#fff',
        color: accent ? '#fff' : 'inherit',
        minHeight: 140,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box sx={{ fontSize: 32 }}>{icon}</Box>
        <Stack spacing={0.5}>
          <Typography variant="body2" sx={{ opacity: accent ? 0.8 : 1 }}>
            {label}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
          <Typography variant="caption">{trend}</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
