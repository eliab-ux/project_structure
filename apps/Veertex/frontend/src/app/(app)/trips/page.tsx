'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
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
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import companyService from 'src/services/companyService';
import routeService from 'src/services/routeService';
import userService from 'src/services/userService';
import { AdminUser, Company } from 'src/types/admin';
import { Route, Trip, TRIP_STATUS_LABEL, TripStatus } from 'src/types/route';

const ADMIN_MAX_WIDTH = 1200;

const STATUS_CHIP: Record<TripStatus, 'default' | 'info' | 'success' | 'warning'> = {
  planejada: 'default',
  em_andamento: 'info',
  em_fechamento: 'warning',
  fechada: 'success',
  cancelada: 'default',
};

/**
 * VIAGENS (04 §3): a lista da retaguarda. O trabalho de verdade — carga, acerto, fechamento —
 * acontece na página da viagem; aqui é criar e acompanhar.
 */
export default function TripsPage() {
  const { can } = useAuth();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sellers, setSellers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrips(
        await routeService.listTrips({
          status: statusFilter || undefined,
          routeId: routeFilter || undefined,
        }),
      );
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar as viagens.'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, routeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void Promise.all([routeService.listRoutes(), companyService.list(), userService.list()])
      .then(([routeRows, companyRows, userRows]) => {
        setRoutes(routeRows);
        setCompanies(companyRows);
        setSellers(userRows);
      })
      .catch(() => undefined);
  }, []);

  const routeName = useMemo(() => new Map(routes.map((route) => [route.id, route.name])), [routes]);
  const sellerName = useMemo(
    () => new Map(sellers.map((seller) => [seller.id, seller.name])),
    [sellers],
  );

  const isEmpty = trips.length === 0;

  return (
    <Box component="section" aria-label="Viagens" sx={{ maxWidth: ADMIN_MAX_WIDTH, mx: 'auto' }}>
      <PageHeader
        title="Viagens"
        description="Carga, acerto em dois estágios e fechamento com batimento."
        action={
          can('rot.trip.manage') ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Nova viagem
            </Button>
          ) : null
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5 }}>
        <TextField
          select
          label="Situação"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          size="small"
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {Object.entries(TRIP_STATUS_LABEL).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Rota"
          value={routeFilter}
          onChange={(event) => setRouteFilter(event.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {routes.map((route) => (
            <MenuItem key={route.id} value={route.id}>
              {route.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {loading || error || isEmpty ? (
        <DataState
          loading={loading}
          error={error}
          empty={isEmpty}
          emptyMessage="Nenhuma viagem para este filtro."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="Lista de viagens">
            <TableHead>
              <TableRow>
                <TableCell>Rota</TableCell>
                <TableCell>Representante</TableCell>
                <TableCell>Saída</TableCell>
                <TableCell>Retorno</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trips.map((trip) => (
                <TableRow key={trip.id} hover>
                  <TableCell>{routeName.get(trip.routeId) ?? '—'}</TableCell>
                  <TableCell>{sellerName.get(trip.salesRepId) ?? '—'}</TableCell>
                  <TableCell>
                    {trip.departureAt
                      ? new Date(trip.departureAt).toLocaleDateString('pt-BR')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {trip.returnAt ? new Date(trip.returnAt).toLocaleDateString('pt-BR') : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={trip.statusLabel}
                      color={STATUS_CHIP[trip.status]}
                      variant={trip.status === 'planejada' ? 'outlined' : 'filled'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button component={NextLink} href={`/trips/${trip.id}`} size="small">
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {createOpen ? (
        <CreateTripDialog
          routes={routes}
          companies={companies}
          sellers={sellers}
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      ) : null}
    </Box>
  );
}

function CreateTripDialog({
  routes,
  companies,
  sellers,
  onClose,
  onDone,
}: {
  routes: Route[];
  companies: Company[];
  sellers: AdminUser[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState(companies.length === 1 ? companies[0].id : '');
  const [routeId, setRouteId] = useState('');
  const [salesRepId, setSalesRepId] = useState('');
  const [helperUserId, setHelperUserId] = useState('');
  const [initialCash, setInitialCash] = useState('');
  const [initialKm, setInitialKm] = useState('');

  async function save() {
    if (!companyId || !routeId || !salesRepId) {
      enqueueSnackbar('Preencha empresa, rota e representante.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await routeService.createTrip({
        companyId,
        routeId,
        salesRepId,
        helperUserId: helperUserId || null,
        initialCash: initialCash ? Number(initialCash) : undefined,
        initialKm: initialKm ? Number(initialKm) : undefined,
      });
      enqueueSnackbar('Viagem criada (planejada).', { variant: 'success' });
      onDone();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nova viagem</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            select
            label="Empresa"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
            fullWidth
            required
          >
            {companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>
                {company.displayName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Rota"
            value={routeId}
            onChange={(event) => setRouteId(event.target.value)}
            fullWidth
            required
          >
            {routes
              .filter((route) => route.active)
              .map((route) => (
                <MenuItem key={route.id} value={route.id}>
                  {route.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            select
            label="Representante"
            value={salesRepId}
            onChange={(event) => setSalesRepId(event.target.value)}
            fullWidth
            required
          >
            {sellers.map((seller) => (
              <MenuItem key={seller.id} value={seller.id}>
                {seller.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Ajudante"
            value={helperUserId}
            onChange={(event) => setHelperUserId(event.target.value)}
            fullWidth
          >
            <MenuItem value="">Sem ajudante</MenuItem>
            {sellers.map((seller) => (
              <MenuItem key={seller.id} value={seller.id}>
                {seller.name}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Caixa inicial (R$)"
              type="number"
              value={initialCash}
              onChange={(event) => setInitialCash(event.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
            />
            <TextField
              label="Km inicial"
              type="number"
              value={initialKm}
              onChange={(event) => setInitialKm(event.target.value)}
              inputProps={{ min: 0 }}
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          Criar viagem
        </Button>
      </DialogActions>
    </Dialog>
  );
}
