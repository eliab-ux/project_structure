'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { MonetizationOn, TrendingUp, Visibility, ShoppingCartCheckout } from '@mui/icons-material';
import { MetricCard } from '@/components/reseller/MetricCard';
import { useResellerAuth } from '@/hooks/useResellerAuth';

type DashboardData = {
  name: string;
  level: 'bronze' | 'prata' | 'ouro';
  nextLevelPercentage: number;
  totalSold: string;
  commission: string;
  visits: string;
  conversion: string;
  link: string;
  cards: { label: string; detail: string }[];
};

const INITIAL_DATA: DashboardData = {
  name: 'Paulo Oliveira',
  level: 'bronze',
  nextLevelPercentage: 42,
  totalSold: 'R$ 12.450,00',
  commission: 'R$ 3.120,00',
  visits: '4.820',
  conversion: '3,9%',
  link: 'PAULO_ABCD1234',
  cards: [
    { label: 'Vendas confirmadas', detail: '35 produtos' },
    { label: 'Comissões pendentes', detail: 'R$ 1.180,00' },
    { label: 'Cupons ativos', detail: '3 cupons' },
  ],
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export default function ResellerDashboardPage() {
  const [data, setData] = useState<DashboardData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const { accessToken, isInitialized } = useResellerAuth();

  useEffect(() => {
    async function load() {
      if (!accessToken) {
        setError('Você precisa se autenticar antes de acessar o dashboard.');
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/resellers/dashboard`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!response.ok) {
          throw new Error('Não foi possível carregar o dashboard');
        }
        const payload = await response.json();
        setData({
          name: payload.user.name,
          level: payload.reseller.level,
          nextLevelPercentage: payload.nextLevelProgress ?? 42,
          totalSold: payload.metrics.totalSold,
          commission: payload.metrics.commission,
          visits: payload.metrics.visits,
          conversion: payload.metrics.conversion,
          link: payload.reseller.uniqueLink,
          cards: payload.cards ?? INITIAL_DATA.cards,
        });
        setError(undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    }

    if (isInitialized) {
      load();
    }
  }, [API_BASE, accessToken, isInitialized]);

  const levelBadge = useMemo(() => {
    const map = {
      bronze: { label: 'Bronze', color: '#b87333' },
      prata: { label: 'Prata', color: '#bdc3c7' },
      ouro: { label: 'Ouro', color: '#ffd700' },
    } as const;
    return map[data.level];
  }, [data.level]);

  const metricCards = useMemo(
    () => [
      {
        label: 'Total Vendido',
        value: data.totalSold,
        trend: '+12% vs semana passada',
        icon: <ShoppingCartCheckout />,
      },
      {
        label: 'Comissão',
        value: data.commission,
        trend: 'Disponível para saque em 30 dias',
        icon: <MonetizationOn />,
      },
      {
        label: 'Visitas ao link',
        value: data.visits,
        trend: 'Aumento de 4% diário',
        icon: <Visibility />,
      },
      {
        label: 'Conversão média',
        value: data.conversion,
        trend: 'Gráfico 🔽 em comparação ao mês',
        icon: <TrendingUp />,
      },
    ],
    [data],
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#F5F5F5',
        pt: 4,
        pb: 10,
      }}
    >
      <Container maxWidth="lg">
        <Paper
          elevation={3}
          sx={{
            borderRadius: 4,
            p: { xs: 3, md: 4 },
            mb: 4,
            background: 'linear-gradient(135deg, #FFE600, #fff)',
          }}
        >
          <Stack spacing={2}>
            <Typography variant="h3" fontWeight={700}>
              Olá, {data.name.split(' ')[0]}!
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip
                label={`Nível ${levelBadge.label}`}
                sx={{
                  fontWeight: 700,
                  backgroundColor: '#fff',
                  color: '#333',
                }}
              />
              <Chip label="Painel personalizado" color="secondary" />
            </Stack>
            <Typography variant="body1">
              Seu link exclusivo: <strong>kazatem.shop/r/{data.link}</strong>
            </Typography>
            <LinearProgress variant="determinate" value={data.nextLevelPercentage} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button variant="contained" color="primary" component={Link} href="/reseller/sales">
                Ver vendas
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                component={Link}
                href="/reseller/materials"
              >
                Materiais de marketing
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {loading && (
          <Alert severity="info" sx={{ mb: 4 }}>
            Carregando informações do dashboard…
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={3} mb={4}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            {metricCards.map((card) => (
              <Box key={card.label} sx={{ flex: 1 }}>
                <MetricCard {...card} />
              </Box>
            ))}
          </Stack>

          <Paper elevation={1} sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom>
              Relatório rápido
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              {data.cards.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    flex: 1,
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: '#fff',
                  }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    {item.label}
                  </Typography>
                  <Typography variant="h6">{item.detail}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Stack>

        <Paper elevation={1} sx={{ borderRadius: 3, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Gráficos e tendências
          </Typography>
          <Box
            sx={{
              height: 220,
              borderRadius: 2,
              background: 'linear-gradient(180deg, rgba(255,230,0,0.25), rgba(255,255,255,0.3))',
              border: '1px dashed rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Typography color="text.secondary">
              Gráficos serão implementados com Chart.js/Recharts conectados às métricas reais.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
