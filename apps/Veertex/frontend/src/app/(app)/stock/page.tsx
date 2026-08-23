'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import Alert from '@mui/material/Alert';
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
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import companyService from 'src/services/companyService';
import productService from 'src/services/productService';
import stockService, {
  REGISTERABLE_MOVEMENT_TYPES,
  STOCK_LOCATION_KIND_LABEL,
  STOCK_MOVEMENT_TYPE_LABEL,
  StockBalance,
  StockLocation,
  StockMovement,
  StockMovementType,
  StockReservation,
} from 'src/services/stockService';
import { Company } from 'src/types/admin';
import { Product } from 'src/types/product';

const MAX_WIDTH = 1280;

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatQty(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

/**
 * ESTOQUE operacional (03/03A): saldo derivado dos movimentos (append-only — não existe "editar
 * saldo"), extrato de movimentos, transferência interna entre localizações e o cadastro de
 * localizações. O DISPONÍVEL já desconta as reservas ativas (§3.9 do 02).
 */
export default function StockPage() {
  const { can } = useAuth();
  const canMove = can('stock.move');

  const [tab, setTab] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [locations, setLocations] = useState<StockLocation[]>([]);

  useEffect(() => {
    void Promise.all([companyService.list(), productService.list({})])
      .then(([companyRows, productRows]) => {
        setCompanies(companyRows);
        setProducts(productRows);
        if (companyRows.length === 1) {
          setCompanyId(companyRows[0].id);
        }
      })
      .catch(() => undefined);
  }, []);

  const loadLocations = useCallback(async () => {
    if (!companyId) {
      setLocations([]);
      return;
    }
    try {
      setLocations(await stockService.listLocations(companyId));
    } catch {
      setLocations([]);
    }
  }, [companyId]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const productName = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );
  const locationName = useMemo(
    () => new Map(locations.map((location) => [location.id, location.name])),
    [locations],
  );

  return (
    <Box component="section" aria-label="Estoque" sx={{ maxWidth: MAX_WIDTH, mx: 'auto' }}>
      <PageHeader
        title="Estoque"
        description="Saldos por localização, movimentos (append-only) e transferência interna."
        action={
          <TextField
            select
            label="Empresa"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
            size="small"
            sx={{ minWidth: 220 }}
          >
            {companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>
                {company.displayName}
              </MenuItem>
            ))}
          </TextField>
        }
      />

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}>
        <Tab label="Saldos" />
        <Tab label="Movimentos" />
        <Tab label="Localizações" />
        <Tab label="Reservas" />
      </Tabs>

      {!companyId ? (
        <Alert severity="info" role="status">
          Escolha a empresa para ver o estoque.
        </Alert>
      ) : tab === 0 ? (
        <BalancesTab
          companyId={companyId}
          products={products}
          locations={locations}
          canMove={canMove}
          locationName={locationName}
          onChanged={() => undefined}
        />
      ) : tab === 1 ? (
        <MovementsTab
          companyId={companyId}
          products={products}
          locations={locations}
          canMove={canMove}
          productName={productName}
          locationName={locationName}
        />
      ) : tab === 2 ? (
        <LocationsTab
          companyId={companyId}
          locations={locations}
          canMove={canMove}
          onChanged={() => void loadLocations()}
        />
      ) : (
        <ReservationsTab companyId={companyId} productName={productName} />
      )}
    </Box>
  );
}

// ── Saldos ───────────────────────────────────────────────────────────────────────────────────────

function BalancesTab({
  companyId,
  products,
  locations,
  canMove,
  locationName,
}: {
  companyId: string;
  products: Product[];
  locations: StockLocation[];
  canMove: boolean;
  locationName: Map<string, string>;
  onChanged: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [productId, setProductId] = useState('');
  const [balance, setBalance] = useState<StockBalance | null>(null);
  const [byLocation, setByLocation] = useState<
    { location: StockLocation; balance: StockBalance }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const load = useCallback(async () => {
    if (!productId) {
      setBalance(null);
      setByLocation([]);
      return;
    }
    setLoading(true);
    try {
      const total = await stockService.balance(companyId, productId);
      setBalance(total);
      // Um saldo por localização — poucas localizações por empresa; a leitura é barata.
      const rows = await Promise.all(
        locations.map(async (location) => ({
          location,
          balance: await stockService.balance(companyId, productId, location.id),
        })),
      );
      setByLocation(rows.filter((row) => row.balance.quantity !== 0));
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError, 'Não foi possível carregar o saldo.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, productId, locations, enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          select
          label="Produto"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          size="small"
          sx={{ minWidth: 280 }}
        >
          {products
            .filter((product) => product.active)
            .map((product) => (
              <MenuItem key={product.id} value={product.id}>
                {product.name}
              </MenuItem>
            ))}
        </TextField>
        {canMove && productId ? (
          <Button
            variant="outlined"
            startIcon={<SwapHorizIcon />}
            onClick={() => setTransferOpen(true)}
          >
            Transferir entre localizações
          </Button>
        ) : null}
      </Stack>

      {loading ? (
        <DataState loading error={null} empty={false} emptyMessage="" />
      ) : balance ? (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <SummaryCard label="Saldo físico" value={formatQty(balance.quantity)} />
            <SummaryCard
              label="Disponível (desconta reservas)"
              value={formatQty(balance.available)}
              highlight={balance.available < balance.quantity}
            />
            <SummaryCard label="Custo médio" value={formatMoney(balance.averageCost)} />
            <SummaryCard
              label="Valor em estoque"
              value={formatMoney(balance.quantity * balance.averageCost)}
            />
          </Stack>

          {balance.belowMinimum ? (
            <Alert severity="warning" role="alert">
              Abaixo do mínimo ({formatQty(balance.minimumQuantity ?? 0)}).
            </Alert>
          ) : null}
          {balance.aboveMaximum ? (
            <Alert severity="info" role="status">
              Acima do máximo ({formatQty(balance.maximumQuantity ?? 0)}).
            </Alert>
          ) : null}

          {byLocation.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" aria-label="Saldo por localização">
                <TableHead>
                  <TableRow>
                    <TableCell>Localização</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {byLocation.map((row) => (
                    <TableRow key={row.location.id} hover>
                      <TableCell>{row.location.name}</TableCell>
                      <TableCell>
                        {STOCK_LOCATION_KIND_LABEL[row.location.kind] ?? row.location.kind}
                      </TableCell>
                      <TableCell align="right">{formatQty(row.balance.quantity)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </>
      ) : (
        <Typography color="text.secondary">Escolha um produto para ver o saldo.</Typography>
      )}

      {transferOpen ? (
        <TransferDialog
          companyId={companyId}
          productId={productId}
          locations={locations}
          locationName={locationName}
          onClose={() => setTransferOpen(false)}
          onDone={() => {
            setTransferOpen(false);
            void load();
          }}
        />
      ) : null}
    </Stack>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" color={highlight ? 'warning.main' : undefined}>
        {value}
      </Typography>
    </Paper>
  );
}

// ── Movimentos ───────────────────────────────────────────────────────────────────────────────────

function MovementsTab({
  companyId,
  products,
  locations,
  canMove,
  productName,
  locationName,
}: {
  companyId: string;
  products: Product[];
  locations: StockLocation[];
  canMove: boolean;
  productName: Map<string, string>;
  locationName: Map<string, string>;
}) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMovements(
        await stockService.listMovements({
          companyId,
          productId: productFilter || undefined,
          type: typeFilter || undefined,
        }),
      );
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar os movimentos.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, productFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          select
          label="Produto"
          value={productFilter}
          onChange={(event) => setProductFilter(event.target.value)}
          size="small"
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {products.map((product) => (
            <MenuItem key={product.id} value={product.id}>
              {product.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Tipo"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {Object.entries(STOCK_MOVEMENT_TYPE_LABEL).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        {canMove ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setRegisterOpen(true)}>
            Registrar movimento
          </Button>
        ) : null}
      </Stack>

      {loading || error || movements.length === 0 ? (
        <DataState
          loading={loading}
          error={error}
          empty={movements.length === 0}
          emptyMessage="Nenhum movimento para este filtro."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Movimentos de estoque">
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Produto</TableCell>
                <TableCell>Localização</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell align="right">Quantidade</TableCell>
                <TableCell align="right">Custo unit.</TableCell>
                <TableCell>Obs.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id} hover>
                  <TableCell>
                    {new Date(movement.occurredAt).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                  <TableCell>{productName.get(movement.productId) ?? '—'}</TableCell>
                  <TableCell>{locationName.get(movement.locationId) ?? '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={movement.typeLabel} variant="outlined" />
                    {movement.usedFallback ? (
                      <Chip
                        size="small"
                        label="custo fallback"
                        color="warning"
                        variant="outlined"
                        sx={{ ml: 0.5 }}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: movement.signedQuantity < 0 ? 'error.main' : 'success.main' }}
                  >
                    {formatQty(movement.signedQuantity)}
                  </TableCell>
                  <TableCell align="right">
                    {movement.unitCost !== null ? formatMoney(movement.unitCost) : '—'}
                  </TableCell>
                  <TableCell>{movement.note ?? ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {registerOpen ? (
        <RegisterMovementDialog
          companyId={companyId}
          products={products}
          locations={locations}
          onClose={() => setRegisterOpen(false)}
          onDone={() => {
            setRegisterOpen(false);
            void load();
          }}
        />
      ) : null}
    </Stack>
  );
}

function RegisterMovementDialog({
  companyId,
  products,
  locations,
  onClose,
  onDone,
}: {
  companyId: string;
  products: Product[];
  locations: StockLocation[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [type, setType] = useState<StockMovementType>('purchase_in');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [note, setNote] = useState('');

  // Compra e ajuste trazem o custo no input; nos demais o custo é resolvido pelo servidor.
  const carriesCost = type === 'purchase_in' || type === 'inventory_adjust';

  async function save() {
    if (!productId || !locationId || !(Number(quantity) !== 0)) {
      enqueueSnackbar('Preencha produto, localização e quantidade.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await stockService.registerMovement({
        companyId,
        productId,
        locationId,
        type,
        quantity: Number(quantity),
        unitCost: carriesCost && unitCost !== '' ? Number(unitCost) : undefined,
        note: note || null,
      });
      enqueueSnackbar('Movimento registrado.', { variant: 'success' });
      onDone();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Registrar movimento</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            select
            label="Tipo"
            value={type}
            onChange={(event) => setType(event.target.value as StockMovementType)}
            fullWidth
          >
            {REGISTERABLE_MOVEMENT_TYPES.map((value) => (
              <MenuItem key={value} value={value}>
                {STOCK_MOVEMENT_TYPE_LABEL[value]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Produto"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            fullWidth
          >
            {products
              .filter((product) => product.active)
              .map((product) => (
                <MenuItem key={product.id} value={product.id}>
                  {product.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            select
            label="Localização"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            fullWidth
          >
            {locations.map((location) => (
              <MenuItem key={location.id} value={location.id}>
                {location.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={type === 'inventory_adjust' ? 'Quantidade (+ sobra / − falta)' : 'Quantidade'}
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            inputProps={{ step: '0.001' }}
            fullWidth
          />
          {carriesCost ? (
            <TextField
              label="Custo unitário"
              type="number"
              value={unitCost}
              onChange={(event) => setUnitCost(event.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
              helperText="Compra/ajuste trazem o custo; nos demais o servidor resolve pelo custo médio."
            />
          ) : null}
          <TextField
            label="Observação"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
            inputProps={{ maxLength: 500 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TransferDialog({
  companyId,
  productId,
  locations,
  onClose,
  onDone,
}: {
  companyId: string;
  productId: string;
  locations: StockLocation[];
  locationName: Map<string, string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  async function save() {
    if (!fromLocationId || !toLocationId || fromLocationId === toLocationId) {
      enqueueSnackbar('Escolha origem e destino diferentes.', { variant: 'warning' });
      return;
    }
    if (!(Number(quantity) > 0)) {
      enqueueSnackbar('Informe a quantidade.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await stockService.transfer({
        companyId,
        productId,
        fromLocationId,
        toLocationId,
        quantity: Number(quantity),
        note: note || null,
      });
      enqueueSnackbar('Transferência registrada (par atômico).', { variant: 'success' });
      onDone();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Transferência interna</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            select
            label="De"
            value={fromLocationId}
            onChange={(event) => setFromLocationId(event.target.value)}
            fullWidth
          >
            {locations.map((location) => (
              <MenuItem key={location.id} value={location.id}>
                {location.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Para"
            value={toLocationId}
            onChange={(event) => setToLocationId(event.target.value)}
            fullWidth
          >
            {locations
              .filter((location) => location.id !== fromLocationId)
              .map((location) => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            label="Quantidade"
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            inputProps={{ min: 0, step: '0.001' }}
            fullWidth
          />
          <TextField
            label="Observação"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
            inputProps={{ maxLength: 500 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          Transferir
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Localizações ─────────────────────────────────────────────────────────────────────────────────

function LocationsTab({
  companyId,
  locations,
  canMove,
  onChanged,
}: {
  companyId: string;
  locations: StockLocation[];
  canMove: boolean;
  onChanged: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim()) {
      enqueueSnackbar('Dê um nome à localização.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      // Só `warehouse` é criável à mão (ADR-0008): `rep_load` nasce com a viagem, `pdv` com o PDV.
      await stockService.createLocation({ companyId, kind: 'warehouse', name: name.trim() });
      enqueueSnackbar('Localização criada.', { variant: 'success' });
      setName('');
      onChanged();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2}>
      {canMove ? (
        <Stack direction="row" spacing={2}>
          <TextField
            label="Novo depósito"
            value={name}
            onChange={(event) => setName(event.target.value)}
            size="small"
            inputProps={{ maxLength: 120 }}
          />
          <Button variant="contained" onClick={() => void create()} disabled={saving}>
            Criar
          </Button>
        </Stack>
      ) : null}

      {locations.length === 0 ? (
        <Typography color="text.secondary">Nenhuma localização nesta empresa.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Localizações de estoque">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id} hover>
                  <TableCell>{location.name}</TableCell>
                  <TableCell>{STOCK_LOCATION_KIND_LABEL[location.kind] ?? location.kind}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={location.active ? 'Ativa' : 'Inativa'}
                      color={location.active ? 'success' : 'default'}
                      variant={location.active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}

// ── Reservas (02 §3.9) ───────────────────────────────────────────────────────────────────────────

function ReservationsTab({
  companyId,
  productName,
}: {
  companyId: string;
  productName: Map<string, string>;
}) {
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReservations(
        await stockService.listReservations({
          companyId,
          status: statusFilter || undefined,
        }),
      );
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar as reservas.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const expired = reservations.filter((reservation) => reservation.releaseReason === 'expired');

  return (
    <Stack spacing={2}>
      <TextField
        select
        label="Situação"
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
        size="small"
        sx={{ maxWidth: 220 }}
      >
        <MenuItem value="">Todas</MenuItem>
        <MenuItem value="active">Ativas</MenuItem>
        <MenuItem value="released">Liberadas</MenuItem>
      </TextField>

      {expired.length > 0 ? (
        <Alert severity="warning" role="alert">
          {expired.length} reserva(s) EXPIRARAM sem faturamento — o disponível já voltou, mas o
          pedido de origem pode precisar de atenção (o cliente pode cobrar a mercadoria).
        </Alert>
      ) : null}

      {loading || error || reservations.length === 0 ? (
        <DataState
          loading={loading}
          error={error}
          empty={reservations.length === 0}
          emptyMessage="Nenhuma reserva para este filtro."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Reservas de estoque">
            <TableHead>
              <TableRow>
                <TableCell>Produto</TableCell>
                <TableCell>Pedido</TableCell>
                <TableCell align="right">Quantidade</TableCell>
                <TableCell>Expira em</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reservations.map((reservation) => (
                <TableRow key={reservation.id} hover>
                  <TableCell>{productName.get(reservation.productId) ?? '—'}</TableCell>
                  <TableCell>
                    {reservation.orderId ? reservation.orderId.slice(0, 8) : '—'}
                  </TableCell>
                  <TableCell align="right">{formatQty(reservation.quantity)}</TableCell>
                  <TableCell>
                    {new Date(reservation.expiresAt).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={
                        reservation.status === 'active'
                          ? 'Ativa'
                          : reservation.releaseReason === 'expired'
                            ? 'Expirada'
                            : reservation.releaseReason === 'invoiced'
                              ? 'Faturada'
                              : 'Cancelada'
                      }
                      color={
                        reservation.status === 'active'
                          ? 'info'
                          : reservation.releaseReason === 'expired'
                            ? 'warning'
                            : 'default'
                      }
                      variant={reservation.expiredNow ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
