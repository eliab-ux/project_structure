'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Close,
  HourglassEmpty,
  InfoOutlined,
  Inventory2Outlined,
  Search,
  Visibility,
  Warning,
} from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';
import adminProductsService, {
  AdminProduct,
  SyncStatusResponse,
} from '@/services/adminProductsService';

type AlertState = {
  message: string;
  severity: 'success' | 'error' | 'info';
} | null;

type SyncStatusBadge = {
  label: string;
  color: 'success' | 'warning' | 'error' | 'default';
  icon: JSX.Element;
};

const rowsPerPageOptions = [10, 20, 50, 100];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
  });
  const [filters, setFilters] = useState({
    status: '' as '' | 'active' | 'inactive',
    stock: '' as '' | 'in_stock' | 'low_stock' | 'out_of_stock',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadProducts();
  }, [page, rowsPerPage, filters, debouncedSearch]);

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const syncBadge = useMemo<SyncStatusBadge>(() => {
    if (!syncStatus) {
      return { label: 'Sincronização não verificada', color: 'default', icon: <InfoOutlined /> };
    }

    switch (syncStatus.status) {
      case 'active':
        return { label: 'Sincronização ativa', color: 'success', icon: <CheckCircle /> };
      case 'slow':
        return { label: 'Sincronização lenta', color: 'warning', icon: <HourglassEmpty /> };
      case 'stopped':
        return { label: 'Sincronização parada', color: 'error', icon: <Warning /> };
      case 'never_used':
        return { label: 'Nunca usada', color: 'default', icon: <InfoOutlined /> };
      case 'not_configured':
      default:
        return { label: 'Não configurado', color: 'default', icon: <InfoOutlined /> };
    }
  }, [syncStatus]);

  async function loadProducts() {
    setLoading(true);
    try {
      const response = await adminProductsService.list({
        page,
        limit: rowsPerPage,
        search: debouncedSearch || undefined,
        status: filters.status || undefined,
        stock: filters.stock || undefined,
      });

      setProducts(response.data);
      setPagination({
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      });
    } catch (error: any) {
      setAlert({
        message: error?.message || 'Erro ao carregar produtos',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadSyncStatus() {
    try {
      const status = await adminProductsService.getSyncStatus();
      setSyncStatus(status);
    } catch {
      setSyncStatus(null);
    }
  }

  async function handleToggleActive(product: AdminProduct) {
    setToggleLoading(product.id);
    try {
      const updated = await adminProductsService.toggleActive(product.id, !product.isActive);
      setProducts((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setAlert({
        message: updated.isActive ? 'Produto ativado' : 'Produto desativado',
        severity: 'success',
      });
      await loadSyncStatus();
    } catch (error: any) {
      setAlert({
        message: error?.message || 'Erro ao atualizar status',
        severity: 'error',
      });
    } finally {
      setToggleLoading(null);
    }
  }

  function handleFilterChange(field: 'status' | 'stock', value: string) {
    setFilters((prev) => ({ ...prev, [field]: value as any }));
    setPage(1);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  function formatTimeAgo(timestamp?: string | null) {
    if (!timestamp) return '—';
    const diffMinutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (diffMinutes < 1) return 'há poucos segundos';
    if (diffMinutes < 60) return `há ${diffMinutes} min`;
    const hours = Math.floor(diffMinutes / 60);
    return `há ${hours} h`;
  }

  function getStockColor(stock: number) {
    if (stock > 10) return 'success';
    if (stock > 0) return 'warning';
    return 'error';
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Produtos</Typography>
          <Typography color="text.secondary">
            Produtos sincronizados automaticamente pelo Magis5.
          </Typography>
        </Box>

        {alert && (
          <Alert severity={alert.severity} onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}

        <CardSection
          syncBadge={syncBadge}
          lastSync={syncStatus?.lastSync ? formatTimeAgo(syncStatus.lastSync) : null}
          totalProducts={syncStatus?.totalProducts ?? '—'}
        />

        <FilterPanel
          searchTerm={searchTerm}
          onSearchChange={(value) => setSearchTerm(value)}
          filters={filters}
          onFilterChange={handleFilterChange}
        />

        <Alert severity="info">
          Os produtos são sincronizados automaticamente pelo Magis5. Alterações devem ser feitas
          no painel do hub.
        </Alert>

        <Paper>
          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : products.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>SKU</TableCell>
                      <TableCell>Nome</TableCell>
                      <TableCell align="right">Preço</TableCell>
                      <TableCell align="right">Custo</TableCell>
                      <TableCell align="center">Estoque</TableCell>
                      <TableCell>Categoria</TableCell>
                      <TableCell align="center">Ativo</TableCell>
                      <TableCell align="center" width={80}>
                        Ações
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {product.sku}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography noWrap sx={{ maxWidth: 260 }}>
                            {product.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{formatCurrency(product.price)}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary">
                            {formatCurrency(product.costPrice)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${product.stock} un`}
                            size="small"
                            color={getStockColor(product.stock) as 'success' | 'warning' | 'error'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip label={product.categoryName || 'Geral'} size="small" />
                        </TableCell>
                        <TableCell align="center">
                          <Switch
                            checked={product.isActive}
                            onChange={() => handleToggleActive(product)}
                            disabled={toggleLoading === product.id}
                            color="primary"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton onClick={() => setSelectedProduct(product)} size="small">
                            <Visibility fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={pagination.total}
                page={Math.max(0, page - 1)}
                onPageChange={(_, newPage) => setPage(newPage + 1)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(parseInt(event.target.value, 10));
                  setPage(1);
                }}
                rowsPerPageOptions={rowsPerPageOptions}
              />
            </>
          )}
        </Paper>

        <DetailsDrawer product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      </Stack>
    </Container>
  );
}

function CardSection({
  syncBadge,
  lastSync,
  totalProducts,
}: {
  syncBadge: SyncStatusBadge;
  lastSync: string | null;
  totalProducts: number | string;
}) {
  return (
    <Stack spacing={1}>
      <Chip
        icon={syncBadge.icon}
        label={syncBadge.label}
        color={syncBadge.color as 'default' | 'success' | 'warning' | 'error'}
        size="small"
      />
      <Typography variant="body2" color="text.secondary">
        Última atualização: {lastSync || '—'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Total de produtos: {totalProducts}
      </Typography>
    </Stack>
  );
}

function FilterPanel({
  filters,
  onFilterChange,
  searchTerm,
  onSearchChange,
}: {
  filters: { status: '' | 'active' | 'inactive'; stock: '' | 'in_stock' | 'low_stock' | 'out_of_stock' };
  onFilterChange: (field: 'status' | 'stock', value: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={3}>
        <Select
          fullWidth
          value={filters.status}
          onChange={(event) => onFilterChange('status', event.target.value)}
          displayEmpty
          size="small"
        >
          <MenuItem value="">Status</MenuItem>
          <MenuItem value="active">Ativos</MenuItem>
          <MenuItem value="inactive">Inativos</MenuItem>
        </Select>
      </Grid>
      <Grid item xs={12} md={3}>
        <Select
          fullWidth
          value={filters.stock}
          onChange={(event) => onFilterChange('stock', event.target.value)}
          displayEmpty
          size="small"
        >
          <MenuItem value="">Estoque</MenuItem>
          <MenuItem value="in_stock">Em estoque</MenuItem>
          <MenuItem value="low_stock">Estoque baixo</MenuItem>
          <MenuItem value="out_of_stock">Esgotado</MenuItem>
        </Select>
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por nome ou SKU..."
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Grid>
    </Grid>
  );
}

function EmptyState() {
  return (
    <Box sx={{ p: 6, textAlign: 'center' }}>
      <Inventory2Outlined sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h6" color="text.secondary">
        Nenhum produto encontrado
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Os produtos publicados pelo Magis5 aparecerão aqui automaticamente.
      </Typography>
    </Box>
  );
}

function DetailsDrawer({
  product,
  onClose,
}: {
  product: AdminProduct | null;
  onClose: () => void;
}) {
  if (!product) return null;

  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480 } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="h6">{product.name}</Typography>
              <Typography variant="body2" color="text.secondary" fontFamily="monospace">
                SKU: {product.sku}
              </Typography>
            </Box>
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Chip
              label={product.isActive ? 'Ativo' : 'Inativo'}
              color={product.isActive ? 'success' : 'default'}
              size="small"
            />
            <Chip label={product.categoryName || 'Geral'} size="small" />
          </Stack>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {product.images && product.images.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Imagens
              </Typography>
              <Grid container spacing={1}>
                {product.images.map((url) => (
                  <Grid item xs={6} key={url}>
                    <Box
                      component="img"
                      src={url}
                      alt={product.name}
                      sx={{
                        width: '100%',
                        height: 140,
                        objectFit: 'cover',
                        borderRadius: 1,
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          <Typography variant="subtitle2">Preço e estoque</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Preço de venda
              </Typography>
              <Typography variant="h6" color="primary">
                {formatCurrency(product.price)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Custo
              </Typography>
              <Typography variant="h6">
                {formatCurrency(product.costPrice)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Estoque
              </Typography>
              <Typography
                variant="h6"
                color={
                  product.stock > 10 ? 'success.main' : product.stock > 0 ? 'warning.main' : 'error.main'
                }
              >
                {product.stock} unidades
              </Typography>
            </Grid>
          </Grid>

          <Typography variant="subtitle2">Descrição</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {product.description || 'Nenhuma descrição cadastrada.'}
          </Typography>

          {(product.weight || product.width) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2">Peso e dimensões</Typography>
              <Stack spacing={0.5}>
                {product.weight ? (
                  <Typography variant="body2">Peso: {product.weight} kg</Typography>
                ) : null}
                {product.width ? (
                  <Typography variant="body2">
                    LxAxC: {product.width} x {product.height} x {product.length} cm
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          )}

          <Typography variant="subtitle2">Sincronização</Typography>
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Criado em: {new Date(product.createdAt).toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Última atualização: {new Date(product.updatedAt).toLocaleString()}
            </Typography>
            <Typography variant="caption" color="info.main">
              Gerenciado automaticamente pelo Magis5. Alterações são feitas no ERP.
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button fullWidth variant="outlined" onClick={onClose}>
            Fechar
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
