'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import salesConfigService, { ModelBTiers } from 'src/services/salesConfigService';
import companyService from 'src/services/companyService';
import userService from 'src/services/userService';
import { CommissionModelAResult, CommissionTier, SalesTarget } from 'src/types/sales';
import { AdminUser, Company } from 'src/types/admin';

const ADMIN_MAX_WIDTH = 1200;

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface TierRow {
  thresholdPercent: string;
  commissionPercent: string;
}

/**
 * Comissão modelo A (02A §2): faixas de atingimento (meta × vendido → % de comissão), metas por
 * vendedor/mês e a APURAÇÃO do período — que pode virar conta a pagar no FIN. O modelo B (rota) não
 * mora aqui: ele é apurado no fechamento da viagem.
 */
export default function CommissionPage() {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [tierRows, setTierRows] = useState<TierRow[]>([]);
  const [bTiers, setBTiers] = useState<ModelBTiers | null>(null);
  const [bTierRows, setBTierRows] = useState<TierRow[]>([]);
  const [savingBTiers, setSavingBTiers] = useState(false);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [sellers, setSellers] = useState<AdminUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTiers, setSavingTiers] = useState(false);

  // Meta nova
  const [targetUserId, setTargetUserId] = useState('');
  const [targetValue, setTargetValue] = useState('');

  // Apuração
  const [computeUserId, setComputeUserId] = useState('');
  const [result, setResult] = useState<CommissionModelAResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [payableCompanyId, setPayableCompanyId] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tierList, targetList, bTierResult] = await Promise.all([
        salesConfigService.listCommissionTiers(),
        salesConfigService.listTargets(period),
        salesConfigService.getModelBTiers().catch(() => null),
      ]);
      setBTiers(bTierResult);
      setBTierRows(
        (bTierResult?.tiers ?? []).map((tier) => ({
          thresholdPercent: String(tier.thresholdPercent),
          commissionPercent: String(tier.commissionPercent),
        })),
      );
      setTiers(tierList);
      setTierRows(
        tierList.map((tier) => ({
          thresholdPercent: String(tier.thresholdPercent),
          commissionPercent: String(tier.commissionPercent),
        })),
      );
      setTargets(targetList);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar a configuração.'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void Promise.all([userService.list(), companyService.list()])
      .then(([userRows, companyRows]) => {
        setSellers(userRows);
        setCompanies(companyRows);
      })
      .catch(() => undefined);
  }, []);

  const sellerName = useMemo(
    () => new Map(sellers.map((seller) => [seller.id, seller.name])),
    [sellers],
  );

  async function saveTiers() {
    const parsed = tierRows
      .filter((row) => row.thresholdPercent !== '' && row.commissionPercent !== '')
      .map((row) => ({
        thresholdPercent: Number(row.thresholdPercent),
        commissionPercent: Number(row.commissionPercent),
      }));
    if (parsed.length === 0) {
      enqueueSnackbar('Informe ao menos uma faixa.', { variant: 'warning' });
      return;
    }
    setSavingTiers(true);
    try {
      setTiers(await salesConfigService.setCommissionTiers(parsed));
      enqueueSnackbar('Faixas salvas.', { variant: 'success' });
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSavingTiers(false);
    }
  }

  async function saveBTiers() {
    const parsed = bTierRows
      .filter((row) => row.thresholdPercent !== '' && row.commissionPercent !== '')
      .map((row) => ({
        thresholdPercent: Number(row.thresholdPercent),
        commissionPercent: Number(row.commissionPercent),
      }));
    if (parsed.length === 0) {
      enqueueSnackbar('Informe ao menos uma faixa.', { variant: 'warning' });
      return;
    }
    setSavingBTiers(true);
    try {
      const result = await salesConfigService.setModelBTiers(parsed);
      setBTiers(result);
      enqueueSnackbar('Faixas do modelo B salvas para a conta.', { variant: 'success' });
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSavingBTiers(false);
    }
  }

  async function addTarget() {
    if (!targetUserId || !(Number(targetValue) > 0)) {
      enqueueSnackbar('Escolha o vendedor e informe a meta.', { variant: 'warning' });
      return;
    }
    try {
      await salesConfigService.setTarget({
        userId: targetUserId,
        period,
        targetValue: Number(targetValue),
      });
      enqueueSnackbar('Meta registrada.', { variant: 'success' });
      setTargetUserId('');
      setTargetValue('');
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    }
  }

  async function compute() {
    if (!computeUserId) {
      enqueueSnackbar('Escolha o vendedor.', { variant: 'warning' });
      return;
    }
    setComputing(true);
    setResult(null);
    try {
      setResult(await salesConfigService.computeModelA(computeUserId, period));
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setComputing(false);
    }
  }

  async function generatePayable() {
    if (!result || !payableCompanyId) {
      enqueueSnackbar('Apure primeiro e escolha a empresa pagadora.', { variant: 'warning' });
      return;
    }
    setGenerating(true);
    try {
      const updated = await salesConfigService.generateModelAPayable({
        salesRepId: result.salesRepId,
        period: result.period,
        companyId: payableCompanyId,
      });
      setResult(updated);
      enqueueSnackbar('Conta a pagar gerada no financeiro.', { variant: 'success' });
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setGenerating(false);
    }
  }

  const canManage = can('sales.settings.manage');

  return (
    <Box
      component="section"
      aria-label="Comissão modelo A"
      sx={{ maxWidth: ADMIN_MAX_WIDTH, mx: 'auto' }}
    >
      <PageHeader
        title="Comissão — modelo A"
        description="Faixas de atingimento sobre a meta, metas por vendedor e apuração do período."
        action={
          <TextField
            label="Período"
            type="month"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            size="small"
          />
        }
      />

      {loading || error ? (
        <DataState loading={loading} error={error} empty={false} emptyMessage="" />
      ) : (
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 3 }} component="article" aria-label="Faixas">
            <Typography variant="h6" sx={{ mb: 1 }}>
              Faixas de atingimento
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Atingiu X% da meta → comissiona Y% sobre o vendido. A faixa aplicada é a maior cujo
              limiar foi atingido.
            </Typography>
            <Stack spacing={1.5}>
              {tierRows.map((row, index) => (
                <Stack key={index} direction="row" spacing={1.5} alignItems="center">
                  <TextField
                    label="Atingiu (% da meta)"
                    type="number"
                    size="small"
                    value={row.thresholdPercent}
                    onChange={(event) =>
                      setTierRows((current) =>
                        current.map((r, i) =>
                          i === index ? { ...r, thresholdPercent: event.target.value } : r,
                        ),
                      )
                    }
                    inputProps={{ min: 0, step: '0.01' }}
                    disabled={!canManage}
                  />
                  <TextField
                    label="Comissão (%)"
                    type="number"
                    size="small"
                    value={row.commissionPercent}
                    onChange={(event) =>
                      setTierRows((current) =>
                        current.map((r, i) =>
                          i === index ? { ...r, commissionPercent: event.target.value } : r,
                        ),
                      )
                    }
                    inputProps={{ min: 0, step: '0.01' }}
                    disabled={!canManage}
                  />
                  {canManage ? (
                    <IconButton
                      aria-label="Remover faixa"
                      onClick={() =>
                        setTierRows((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                </Stack>
              ))}
              {canManage ? (
                <Stack direction="row" spacing={2}>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() =>
                      setTierRows((current) => [
                        ...current,
                        { thresholdPercent: '', commissionPercent: '' },
                      ])
                    }
                  >
                    Adicionar faixa
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => void saveTiers()}
                    disabled={savingTiers}
                  >
                    Salvar faixas
                  </Button>
                </Stack>
              ) : null}
              {tiers.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Nenhuma faixa cadastrada — a apuração devolve comissão zero até existirem faixas.
                </Typography>
              ) : null}
            </Stack>
          </Paper>

          <Paper
            variant="outlined"
            sx={{ p: 3 }}
            component="article"
            aria-label="Faixas do modelo B"
          >
            <Typography variant="h6" sx={{ mb: 1 }}>
              Faixas do modelo B (rota)
              {bTiers?.usingDefault ? (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  — usando o padrão da operação (nada customizado)
                </Typography>
              ) : null}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Recebido ÷ carteira da viagem → faixa → % DIRETO sobre o recebido. Aplicadas no
              fechamento da viagem; salvar aqui customiza a conta (o padrão real fica de seed).
            </Typography>
            <Stack spacing={1.5}>
              {bTierRows.map((row, index) => (
                <Stack key={index} direction="row" spacing={1.5} alignItems="center">
                  <TextField
                    label="Recebimento ≥ (%)"
                    type="number"
                    size="small"
                    value={row.thresholdPercent}
                    onChange={(event) =>
                      setBTierRows((current) =>
                        current.map((r, i) =>
                          i === index ? { ...r, thresholdPercent: event.target.value } : r,
                        ),
                      )
                    }
                    inputProps={{ min: 0, step: '0.01' }}
                    disabled={!canManage}
                  />
                  <TextField
                    label="Comissão (%)"
                    type="number"
                    size="small"
                    value={row.commissionPercent}
                    onChange={(event) =>
                      setBTierRows((current) =>
                        current.map((r, i) =>
                          i === index ? { ...r, commissionPercent: event.target.value } : r,
                        ),
                      )
                    }
                    inputProps={{ min: 0, step: '0.01' }}
                    disabled={!canManage}
                  />
                  {canManage ? (
                    <IconButton
                      aria-label="Remover faixa B"
                      onClick={() =>
                        setBTierRows((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                </Stack>
              ))}
              {canManage ? (
                <Stack direction="row" spacing={2}>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() =>
                      setBTierRows((current) => [
                        ...current,
                        { thresholdPercent: '', commissionPercent: '' },
                      ])
                    }
                  >
                    Adicionar faixa
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => void saveBTiers()}
                    disabled={savingBTiers}
                  >
                    Salvar faixas B
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }} component="article" aria-label="Metas">
            <Typography variant="h6" sx={{ mb: 2 }}>
              Metas do período {period}
            </Typography>
            {targets.length > 0 ? (
              <TableContainer sx={{ mb: 2 }}>
                <Table size="small" aria-label="Metas do período">
                  <TableHead>
                    <TableRow>
                      <TableCell>Vendedor</TableCell>
                      <TableCell align="right">Meta</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {targets.map((target) => (
                      <TableRow key={target.id} hover>
                        <TableCell>{sellerName.get(target.userId) ?? target.userId}</TableCell>
                        <TableCell align="right">{formatMoney(target.targetValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Nenhuma meta registrada para {period}.
              </Typography>
            )}
            {canManage ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Vendedor"
                  value={targetUserId}
                  onChange={(event) => setTargetUserId(event.target.value)}
                  size="small"
                  sx={{ minWidth: 220 }}
                >
                  {sellers.map((seller) => (
                    <MenuItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Meta (R$)"
                  type="number"
                  size="small"
                  value={targetValue}
                  onChange={(event) => setTargetValue(event.target.value)}
                  inputProps={{ min: 0, step: '0.01' }}
                />
                <Button variant="outlined" onClick={() => void addTarget()}>
                  Registrar meta
                </Button>
              </Stack>
            ) : null}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }} component="article" aria-label="Apuração">
            <Typography variant="h6" sx={{ mb: 2 }}>
              Apuração do período
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                select
                label="Vendedor"
                value={computeUserId}
                onChange={(event) => setComputeUserId(event.target.value)}
                size="small"
                sx={{ minWidth: 220 }}
              >
                {sellers.map((seller) => (
                  <MenuItem key={seller.id} value={seller.id}>
                    {seller.name}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="contained" onClick={() => void compute()} disabled={computing}>
                Apurar
              </Button>
            </Stack>

            {result ? (
              <>
                <Divider sx={{ my: 2 }} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Meta
                    </Typography>
                    <Typography variant="h6">{formatMoney(result.meta)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Vendido
                    </Typography>
                    <Typography variant="h6">{formatMoney(result.vendido)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Atingimento
                    </Typography>
                    <Typography variant="h6">{result.ratioPercent}%</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Faixa aplicada
                    </Typography>
                    <Typography variant="h6">
                      {result.appliedThresholdPercent !== null
                        ? `${result.appliedThresholdPercent}% → ${result.commissionPercent}%`
                        : 'Nenhuma'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Comissão
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {formatMoney(result.commissionValue)}
                    </Typography>
                  </Box>
                </Stack>

                {result.payableTitleId ? (
                  <Typography variant="body2" color="success.main">
                    Conta a pagar já gerada para este período.
                  </Typography>
                ) : can('finance.payable.manage') && result.commissionValue > 0 ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      select
                      label="Empresa pagadora"
                      value={payableCompanyId}
                      onChange={(event) => setPayableCompanyId(event.target.value)}
                      size="small"
                      sx={{ minWidth: 220 }}
                    >
                      {companies.map((company) => (
                        <MenuItem key={company.id} value={company.id}>
                          {company.displayName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="outlined"
                      onClick={() => void generatePayable()}
                      disabled={generating}
                    >
                      Gerar conta a pagar
                    </Button>
                  </Stack>
                ) : null}
              </>
            ) : null}
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
