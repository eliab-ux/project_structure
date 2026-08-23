'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import routeService from 'src/services/routeService';
import companyService from 'src/services/companyService';
import salesConfigService from 'src/services/salesConfigService';
import userService from 'src/services/userService';
import { AdminUser, Company } from 'src/types/admin';
import { PaymentCondition, PriceList } from 'src/types/sales';
import { Route } from 'src/types/route';

const ADMIN_MAX_WIDTH = 1200;

/**
 * ROTAS (04 §2): o cadastro da praça do representante — nome, código e o CICLO em dias (a "próxima
 * passagem", que dá o vencimento do título consignado). E a REGRA COMERCIAL por representante
 * (§3.7): o que o app de campo oferece — empresas, condições e tabelas permitidas.
 */
export default function RoutesPage() {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [cycleDays, setCycleDays] = useState('60');

  const [ruleOpen, setRuleOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoutes(await routeService.listRoutes(includeInactive));
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar as rotas.'));
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  function openDialog(route: Route | null) {
    setEditing(route);
    setName(route?.name ?? '');
    setCode(route?.code ?? '');
    setCycleDays(route ? String(route.cycleDays) : '60');
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      enqueueSnackbar('Dê um nome à rota.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        cycleDays: Math.max(1, Number(cycleDays) || 60),
      };
      if (editing) {
        await routeService.updateRoute(editing.id, payload);
        enqueueSnackbar('Rota atualizada.', { variant: 'success' });
      } else {
        await routeService.createRoute(payload);
        enqueueSnackbar('Rota cadastrada.', { variant: 'success' });
      }
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(route: Route) {
    try {
      await routeService.updateRoute(route.id, { active: !route.active });
      enqueueSnackbar(route.active ? 'Rota desativada.' : 'Rota reativada.', {
        variant: 'success',
      });
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    }
  }

  const isEmpty = routes.length === 0;

  return (
    <Box component="section" aria-label="Rotas" sx={{ maxWidth: ADMIN_MAX_WIDTH, mx: 'auto' }}>
      <PageHeader
        title="Rotas"
        description="Praças de venda em rota: ciclo de passagem e Regra Comercial por representante."
        action={
          <Stack direction="row" spacing={1.5}>
            {can('rot.settings') ? (
              <Button variant="outlined" onClick={() => setRuleOpen(true)}>
                Regra Comercial
              </Button>
            ) : null}
            {can('rot.settings') ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog(null)}>
                Nova rota
              </Button>
            ) : null}
          </Stack>
        }
      />

      <FormControlLabel
        sx={{ mb: 2 }}
        control={
          <Switch
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
        }
        label="Incluir inativas"
      />

      {loading || error || isEmpty ? (
        <DataState
          loading={loading}
          error={error}
          empty={isEmpty}
          emptyMessage="Nenhuma rota cadastrada."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="Lista de rotas">
            <TableHead>
              <TableRow>
                <TableCell>Rota</TableCell>
                <TableCell>Código</TableCell>
                <TableCell align="right">Ciclo (dias)</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {routes.map((route) => (
                <TableRow key={route.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {route.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{route.code ?? '—'}</TableCell>
                  <TableCell align="right">{route.cycleDays}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={route.active ? 'Ativa' : 'Inativa'}
                      color={route.active ? 'success' : 'default'}
                      variant={route.active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {can('rot.settings') ? (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            aria-label={`Editar ${route.name}`}
                            onClick={() => openDialog(route)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Switch
                          size="small"
                          checked={route.active}
                          onChange={() => void toggleActive(route)}
                          inputProps={{
                            'aria-label': `${route.active ? 'Desativar' : 'Reativar'} ${route.name}`,
                          }}
                        />
                      </Stack>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={dialogOpen}
        onClose={saving ? undefined : () => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editing ? 'Editar rota' : 'Nova rota'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              label="Código"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              fullWidth
              inputProps={{ maxLength: 30 }}
            />
            <TextField
              label="Ciclo (dias entre passagens)"
              type="number"
              value={cycleDays}
              onChange={(event) => setCycleDays(event.target.value)}
              inputProps={{ min: 1, max: 365 }}
              fullWidth
              helperText="Dá o vencimento do título consignado: saída da viagem + ciclo."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {ruleOpen ? <CommercialRuleDialog onClose={() => setRuleOpen(false)} /> : null}
    </Box>
  );
}

/**
 * Regra Comercial por representante (§3.7): checkboxes do que o campo pode usar — o exemplo real é
 * "Juliano tudo, menos boleto". O pull do app já vem filtrado por isto; a tela só cadastra.
 */
function CommercialRuleDialog({ onClose }: { onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [sellers, setSellers] = useState<AdminUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [conditions, setConditions] = useState<PaymentCondition[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [userId, setUserId] = useState('');
  const [loadingRule, setLoadingRule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allowedCompanies, setAllowedCompanies] = useState<Set<string>>(new Set());
  const [allowedConditions, setAllowedConditions] = useState<Set<string>>(new Set());
  const [allowedLists, setAllowedLists] = useState<Set<string>>(new Set());
  const [natures, setNatures] = useState('');

  useEffect(() => {
    void Promise.all([
      userService.list(),
      companyService.list(),
      salesConfigService.listPaymentConditions().catch(() => [] as PaymentCondition[]),
      salesConfigService.listPriceLists().catch(() => [] as PriceList[]),
    ])
      .then(([userRows, companyRows, conditionRows, listRows]) => {
        setSellers(userRows);
        setCompanies(companyRows);
        setConditions(conditionRows);
        setPriceLists(listRows);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoadingRule(true);
    routeService
      .getCommercialRule(userId)
      .then((rule) => {
        setAllowedCompanies(new Set(rule.allowedCompanyIds));
        setAllowedConditions(new Set(rule.allowedPaymentConditionIds));
        setAllowedLists(new Set(rule.allowedPriceListIds));
        setNatures(rule.allowedOperationNatures.join(', '));
      })
      .catch(() => {
        setAllowedCompanies(new Set());
        setAllowedConditions(new Set());
        setAllowedLists(new Set());
        setNatures('');
      })
      .finally(() => setLoadingRule(false));
  }, [userId]);

  function toggle(set: Set<string>, id: string, apply: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  }

  async function save() {
    if (!userId) {
      enqueueSnackbar('Escolha o representante.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await routeService.setCommercialRule(userId, {
        allowedCompanyIds: [...allowedCompanies],
        allowedPaymentConditionIds: [...allowedConditions],
        allowedPriceListIds: [...allowedLists],
        allowedOperationNatures: natures
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      });
      enqueueSnackbar('Regra Comercial salva.', { variant: 'success' });
      onClose();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const checklist = (
    title: string,
    items: { id: string; label: string }[],
    selected: Set<string>,
    apply: (next: Set<string>) => void,
  ) => (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          Nada cadastrado.
        </Typography>
      ) : (
        <Stack>
          {items.map((item) => (
            <FormControlLabel
              key={item.id}
              control={
                <Checkbox
                  size="small"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(selected, item.id, apply)}
                />
              }
              label={item.label}
            />
          ))}
        </Stack>
      )}
    </Box>
  );

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Regra Comercial do representante</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            select
            label="Representante"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            fullWidth
          >
            {sellers.map((seller) => (
              <MenuItem key={seller.id} value={seller.id}>
                {seller.name}
              </MenuItem>
            ))}
          </TextField>

          {userId && !loadingRule ? (
            <>
              <Divider />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                {checklist(
                  'Empresas permitidas',
                  companies.map((company) => ({ id: company.id, label: company.displayName })),
                  allowedCompanies,
                  setAllowedCompanies,
                )}
                {checklist(
                  'Condições permitidas',
                  conditions.map((condition) => ({ id: condition.id, label: condition.name })),
                  allowedConditions,
                  setAllowedConditions,
                )}
                {checklist(
                  'Tabelas de preço permitidas',
                  priceLists.map((list) => ({ id: list.id, label: list.name })),
                  allowedLists,
                  setAllowedLists,
                )}
              </Stack>
              <TextField
                label="Naturezas de operação permitidas"
                value={natures}
                onChange={(event) => setNatures(event.target.value)}
                fullWidth
                helperText="Separadas por vírgula. Vazio = todas."
              />
            </>
          ) : userId ? (
            <Typography color="text.secondary" role="status">
              Carregando regra…
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving || !userId}>
          Salvar regra
        </Button>
      </DialogActions>
    </Dialog>
  );
}
