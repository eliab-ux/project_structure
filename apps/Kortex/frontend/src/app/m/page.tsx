'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { RequireAuth } from 'src/components/RequireAuth';
import { useAuth } from 'src/contexts/AuthContext';
import preOrderService from 'src/services/preOrderService';
import { PRE_ORDER_STATUS_LABELS, PreOrder, formatDateTime } from 'src/types/preOrder';
import { numericSx } from 'src/theme/theme';

/** Alvo de toque ≥ 56 px: o Modelista opera de pé, ao lado da máquina (spec §8). */
const TOUCH = { minHeight: 56 };

/**
 * Início do app do Modelista.
 *
 * O que ele tem na Fase 3: avaliar um corte (pré-pedido), ler a fila de espera e avisar que vagou
 * horário. Fila do dia, agenda e apontamento chegam nas fases 4 e 5 — e não aparecem aqui até
 * existirem, porque botão que não leva a lugar nenhum ensina a não confiar no menu.
 */
function ModelistaHome() {
  const { user, signOut } = useAuth();
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);

  const load = useCallback(async () => {
    try {
      setPreOrders(await preOrderService.listMyPreOrders());
    } catch {
      // A tela funciona sem a lista; o essencial são os botões de ação.
      setPreOrders([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const abertos = preOrders.filter((preOrder) => preOrder.status === 'open');

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 3 }}>
      <Container maxWidth="sm">
        <Typography variant="overline" component="p" sx={{ color: 'info.main' }}>
          Kortex
        </Typography>
        <Typography variant="h2" component="h1">
          Olá, {user?.name.split(' ')[0]}
        </Typography>

        <Stack spacing={1.5} sx={{ mt: 3 }}>
          <Button component={Link} href="/m/fila" fullWidth sx={TOUCH}>
            Fila do dia
          </Button>
          <Button component={Link} href="/m/pre-pedido" variant="outlined" fullWidth sx={TOUCH}>
            Pré-pedido
          </Button>
          <Button component={Link} href="/m/fila-de-espera" variant="outlined" fullWidth sx={TOUCH}>
            Fila de espera
          </Button>
        </Stack>

        <Typography variant="h4" component="h2" sx={{ mt: 4, mb: 1.5 }}>
          Meus pré-pedidos abertos
        </Typography>

        {abertos.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhum pré-pedido aguardando o Administrativo.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {abertos.map((preOrder) => (
              <Paper key={preOrder.id} variant="outlined" sx={{ p: 2 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  gap={1}
                >
                  <Box>
                    <Typography variant="h4" component="h3">
                      {preOrder.customer.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={numericSx}>
                      {preOrder.fabric.name} · {preOrder.productType.name} ·{' '}
                      {preOrder.estimatedPieces} peças
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={numericSx}>
                      {formatDateTime(preOrder.createdAt)}
                    </Typography>
                  </Box>
                  <Stack spacing={0.5} alignItems="flex-end">
                    <Typography sx={{ ...numericSx, fontSize: 24, fontWeight: 600 }}>
                      {preOrder.estimatedHours}h
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={PRE_ORDER_STATUS_LABELS[preOrder.status]}
                    />
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        <Stack spacing={1.5} sx={{ mt: 4 }}>
          <Button component={Link} href="/perfil" variant="outlined" fullWidth sx={TOUCH}>
            Meu perfil
          </Button>
          <Button variant="outlined" fullWidth sx={TOUCH} onClick={signOut}>
            Sair
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}

export default function Page() {
  return (
    <RequireAuth allow={['modelista', 'owner']}>
      <ModelistaHome />
    </RequireAuth>
  );
}
