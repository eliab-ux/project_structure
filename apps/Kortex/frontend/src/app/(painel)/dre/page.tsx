'use client';

import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/PageHeader';
import financeService from 'src/services/financeService';
import { apiErrorMessage } from 'src/services/api';
import { formatCents } from 'src/types/account';
import { Balances, Dre, DreLine, monthRange } from 'src/types/finance';
import { numericSx } from 'src/theme/theme';

const HOJE = new Date();

/** Uma metade do DRE: entradas ou saídas, por categoria. */
function Bloco({
  titulo,
  linhas,
  total,
  cor,
}: {
  titulo: string;
  linhas: DreLine[];
  total: number;
  cor: string;
}) {
  return (
    <Paper variant="outlined" component="section" aria-label={titulo} sx={{ p: 1, flex: 1 }}>
      <Typography variant="overline" sx={{ px: 1, color: 'text.secondary' }}>
        {titulo}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Categoria</TableCell>
            <TableCell align="right">Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {linhas.map((linha) => (
            <TableRow key={linha.categoryId}>
              <TableCell>{linha.categoryName}</TableCell>
              <TableCell align="right" sx={numericSx}>
                {formatCents(linha.totalCents)}
              </TableCell>
            </TableRow>
          ))}
          {linhas.length === 0 && (
            <TableRow>
              <TableCell colSpan={2}>
                <Typography variant="body2" color="text.secondary">
                  Nada no período.
                </Typography>
              </TableCell>
            </TableRow>
          )}
          <TableRow>
            <TableCell sx={{ fontWeight: 600, borderBottom: 'none' }}>Total</TableCell>
            <TableCell
              align="right"
              sx={{ ...numericSx, fontWeight: 600, color: cor, borderBottom: 'none' }}
            >
              {formatCents(total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Paper>
  );
}

export default function DrePage() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(monthRange(HOJE));
  const [dre, setDre] = useState<Dre | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);

  const load = useCallback(async () => {
    try {
      const [loadedDre, loadedBalances] = await Promise.all([
        financeService.dre(range.from, range.to),
        financeService.balances(range.to),
      ]);
      setDre(loadedDre);
      setBalances(loadedBalances);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar o DRE.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [range, enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !dre) {
    return (
      <Box
        role="status"
        aria-label="Carregando"
        sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const positivo = dre.resultCents >= 0;

  return (
    <>
      <PageHeader
        title="DRE de caixa"
        description="Entradas menos saídas no período. Transferência entre contas próprias não aparece aqui — ela só move saldo."
        action={
          <Stack direction="row" spacing={1}>
            <TextField
              type="date"
              size="small"
              label="De"
              InputLabelProps={{ shrink: true }}
              value={range.from}
              onChange={(event) => setRange({ ...range, from: event.target.value })}
            />
            <TextField
              type="date"
              size="small"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={range.to}
              onChange={(event) => setRange({ ...range, to: event.target.value })}
            />
          </Stack>
        }
      />

      <Paper
        variant="outlined"
        component="section"
        aria-label="Resultado do período"
        sx={{ p: 2, mb: 2 }}
      >
        <Typography variant="overline" color="text.secondary">
          Resultado do período
        </Typography>
        <Typography
          sx={{
            ...numericSx,
            fontSize: 38,
            fontWeight: 600,
            lineHeight: 1.1,
            color: positivo ? 'success.main' : 'error.main',
          }}
        >
          {formatCents(dre.resultCents)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={numericSx}>
          {formatCents(dre.totalIncomeCents)} de entradas − {formatCents(dre.totalExpenseCents)} de
          saídas
        </Typography>
      </Paper>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <Bloco
          titulo="Entradas"
          linhas={dre.incomes}
          total={dre.totalIncomeCents}
          cor="success.main"
        />
        <Bloco
          titulo="Saídas"
          linhas={dre.expenses}
          total={dre.totalExpenseCents}
          cor="error.main"
        />
      </Stack>

      <Paper variant="outlined" component="section" aria-label="Saldo por conta" sx={{ p: 1 }}>
        <Typography variant="overline" sx={{ px: 1, color: 'text.secondary' }}>
          Saldo por conta até {range.to.split('-').reverse().join('/')}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Conta</TableCell>
              <TableCell align="right">Inicial</TableCell>
              <TableCell align="right">Entradas</TableCell>
              <TableCell align="right">Saídas</TableCell>
              <TableCell align="right">Transferências</TableCell>
              <TableCell align="right">Saldo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {balances?.accounts.map((account) => (
              <TableRow key={account.bankAccountId}>
                <TableCell sx={{ fontWeight: 600 }}>{account.name}</TableCell>
                <TableCell align="right" sx={numericSx}>
                  {formatCents(account.openingBalanceCents)}
                </TableCell>
                <TableCell align="right" sx={numericSx}>
                  {formatCents(account.inCents)}
                </TableCell>
                <TableCell align="right" sx={numericSx}>
                  {formatCents(account.outCents)}
                </TableCell>
                <TableCell align="right" sx={numericSx}>
                  {formatCents(account.transferInCents - account.transferOutCents)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    ...numericSx,
                    fontWeight: 600,
                    color: account.balanceCents < 0 ? 'error.main' : 'text.primary',
                  }}
                >
                  {formatCents(account.balanceCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Divider sx={{ my: 1 }} />
        <Stack direction="row" justifyContent="space-between" sx={{ px: 2, pb: 1 }}>
          <Typography variant="h4" component="p">
            Total em caixa
          </Typography>
          <Typography sx={{ ...numericSx, fontSize: 20, fontWeight: 600 }}>
            {formatCents(balances?.totalBalanceCents ?? 0)}
          </Typography>
        </Stack>
      </Paper>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: '80ch' }}>
        Lançamento cancelado sai daqui e do saldo, mas continua na lista de lançamentos com o motivo
        e quem cancelou. Corrigir valor de lançamento efetivado não existe: cancele e lance de novo.
      </Typography>
    </>
  );
}
