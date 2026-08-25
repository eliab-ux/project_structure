'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

interface KpiCardProps {
  label: string;
  value: string | number;
  /** Percent change vs. the previous period. Positive → green, negative → red. */
  deltaPercent?: number | null;
  hint?: string;
  icon?: React.ReactNode;
}

/** Large KPI card for the top strip of the cockpit: number + variation vs. previous period. */
export function KpiCard({ label, value, deltaPercent, hint, icon }: KpiCardProps) {
  const hasDelta = typeof deltaPercent === 'number' && Number.isFinite(deltaPercent);
  const positive = (deltaPercent ?? 0) >= 0;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            {label}
          </Typography>
          {icon && <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>}
        </Box>
        <Typography variant="h1" sx={{ lineHeight: 1 }}>
          {value}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, minHeight: 24 }}>
          {hasDelta && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                color: positive ? 'success.main' : 'error.main',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              {positive ? (
                <ArrowUpwardIcon fontSize="inherit" />
              ) : (
                <ArrowDownwardIcon fontSize="inherit" />
              )}
              {Math.abs(deltaPercent as number).toFixed(0)}%
            </Box>
          )}
          {hint && (
            <Typography variant="caption" color="text.secondary">
              {hint}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
