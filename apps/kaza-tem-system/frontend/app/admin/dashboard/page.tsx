'use client';

import { Box, CircularProgress, Grid, Paper, Stack, Typography, Alert, Chip } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { AdminMetrics } from '@/services/adminDashboardService';
import { useAdminMetricsContext } from '@/contexts/AdminMetricsContext';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const numberFormatter = new Intl.NumberFormat('pt-BR');

type MetricCard = {
  label: string;
  key: keyof AdminMetrics;
  format: (value: number) => string;
  badge?: boolean;
  color?: 'error' | 'warning';
};

const metricCards: MetricCard[] = [
  {
    label: 'Vendas Hoje',
    key: 'salesToday',
    format: (value: number) => currencyFormatter.format(value),
  },
  {
    label: 'Vendas no Mês',
    key: 'salesMonth',
    format: (value: number) => currencyFormatter.format(value),
  },
  {
    label: 'Pedidos Hoje',
    key: 'ordersToday',
    format: (value: number) => numberFormatter.format(value),
  },
  {
    label: 'Ticket Médio',
    key: 'averageTicket',
    format: (value: number) => currencyFormatter.format(value),
  },
  {
    label: 'Revendedores Ativos',
    key: 'activeResellers',
    format: (value: number) => numberFormatter.format(value),
  },
  {
    label: 'Cadastros Pendentes',
    key: 'pendingRegistrations',
    format: (value: number) => numberFormatter.format(value),
    badge: true,
    color: 'error',
  },
  {
    label: 'Saques Pendentes',
    key: 'pendingWithdrawals',
    format: (value: number) => numberFormatter.format(value),
    badge: true,
    color: 'warning',
  },
];

export default function AdminDashboardPage() {
  const { metrics, loading, error } = useAdminMetricsContext();
  const chartData = metrics?.salesChart ?? [];

  return (
    <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h4">Dashboard</Typography>
          <Typography color="text.secondary">
            Visão completa do ecossistema de revendedores.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Grid container spacing={2}>
          {metricCards.map((card) => {
            const value = metrics ? metrics[card.key] : undefined;
            return (
              <Grid key={card.label} item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 2, minHeight: 120 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {card.label}
                    </Typography>
                    {loading || value === undefined ? (
                      <CircularProgress size={22} />
                    ) : card.badge ? (
                      <Chip
                        label={card.format(value)}
                        size="small"
                        color={
                          card.color as
                            | 'default'
                            | 'primary'
                            | 'secondary'
                            | 'error'
                            | 'warning'
                            | 'info'
                            | 'success'
                        }
                      />
                    ) : (
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        {card.format(value)}
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Vendas nos últimos 30 dias</Typography>
              <Typography variant="caption" color="text.secondary">
                Fonte: base contábil de pedidos pagos
              </Typography>
            </Stack>
            {loading && !metrics ? (
              <Box sx={{ width: '100%', textAlign: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                      })
                    }
                  />
                  <YAxis tickFormatter={(value) => currencyFormatter.format(value)} />
                  <Tooltip
                    formatter={(value: number) => currencyFormatter.format(value)}
                    labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="url(#salesGradient)"
                    strokeWidth={3}
                    dot={false}
                  />
                  <defs>
                    <linearGradient id="salesGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#1E88E5" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#0D47A1" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                </LineChart>
              </ResponsiveContainer>
            )}
          </Stack>
        </Paper>

        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Top 5 revendedores
              </Typography>
              {metrics?.topResellers.length ? (
                <Stack spacing={2}>
                  {metrics.topResellers.map((reseller) => (
                    <Box
                      key={reseller.id}
                      sx={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <Box>
                        <Typography variant="subtitle2">{reseller.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Nível {reseller.level}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle2">
                        {currencyFormatter.format(reseller.totalSold)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Alert severity="info">Ainda não há dados consolidados para revendedores.</Alert>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Top 5 produtos
              </Typography>
              {metrics?.topProducts.length ? (
                <Stack spacing={2}>
                  {metrics.topProducts.map((product) => (
                    <Box key={product.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="subtitle2">{product.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {numberFormatter.format(product.quantity)} unidades
                        </Typography>
                      </Box>
                      <Typography variant="subtitle2">
                        {currencyFormatter.format(product.revenue)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Alert severity="info">Ainda não há produtos vendidos com dados suficientes.</Alert>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
