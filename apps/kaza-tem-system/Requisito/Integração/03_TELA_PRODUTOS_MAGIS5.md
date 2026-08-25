# TELA DE PRODUTOS — ADMIN (INTEGRAÇÃO MAGIS5)
## Especificação completa: produtos sincronizados automaticamente

> **Contexto:** Magis5 sincroniza produtos automaticamente (push em tempo real)  
> **Modelo:** Similar ao Shopee — **SEM** botão de sincronização manual  
> **Função da tela:** Visualizar e gerenciar produtos publicados pelo Magis5  

---

## 🔍 PESQUISA REALIZADA: COMO O MAGIS5 FUNCIONA

### O que é o Magis5
- **HUB de integração** entre ERPs e marketplaces
- **Sincronização automática em tempo real** de produtos, estoque e pedidos
- Gerenciamento centralizado de múltiplos canais de venda
- **+50 integrações** com marketplaces (Mercado Livre, Amazon, Magalu, Shopee, etc.)

### Fluxo de Sincronização

```
┌──────────────┐                      ┌──────────────┐
│   MAGIS5     │                      │  KAZA TEM    │
│   (HUB)      │                      │ (Marketplace)│
└──────┬───────┘                      └──────┬───────┘
       │                                     │
       │ 1. Admin cadastra produto no Magis5│
       │    e marca "publicar no Kaza Tem"  │
       │                                     │
       │ 2. POST /api/v1/products            │
       │────────────────────────────────────>│
       │                                     │
       │ 3. Produto criado                  │
       │<────────────────────────────────────│
       │                                     │
       │ 4. Magis5 monitora mudanças        │
       │    (estoque, preço) minuto a minuto │
       │                                     │
       │ 5. PATCH /api/v1/products/:id       │
       │    (quando houver alteração)        │
       │────────────────────────────────────>│
       │                                     │
       │ 6. Produto atualizado              │
       │<────────────────────────────────────│
```

**IMPORTANTE:** Não há sincronização manual — Magis5 gerencia tudo automaticamente.

### Dados fornecidos pelo Magis5

```json
{
  "sku": "PROD-12345",
  "name": "Smart TV 55\" 4K",
  "description": "TV LED 4K HDR com Android TV...",
  "price": 2499.90,
  "cost_price": 1800.00,
  "stock": 15,
  "category_name": "Eletrônicos",
  "weight": 18.5,
  "dimensions": {
    "width": 124,
    "height": 72,
    "length": 8
  },
  "is_active": true,
  "images": [
    {
      "url": "https://cdn.magis5.com/products/tv-55-front.jpg",
      "position": 0,
      "is_primary": true
    }
  ]
}
```

---

## 🎨 NOVA TELA DE PRODUTOS — `/admin/produtos`

### Wireframe

```
┌───────────────────────────────────────────────────────────────┐
│ Produtos                                                      │
│ Gerencie os produtos publicados automaticamente pelo Magis5   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ℹ️ Os produtos são sincronizados automaticamente pelo   │ │
│ │   Magis5 em tempo real. Alterações são refletidas       │ │
│ │   automaticamente no marketplace.                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ 🟢 Sincronização ativa  • Última atualização: há 2 min       │
│ Total de produtos: 523                                        │
│                                                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────────────────────────┐ │
│ │Status  ▾ │ │Estoque ▾ │ │ 🔍 Buscar por nome ou SKU   │ │
│ └──────────┘ └──────────┘ └──────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │SKU  │Nome         │Preço    │Custo   │Estoque│Cat│Ativo│ │
│ ├─────┼─────────────┼─────────┼────────┼───────┼───┼─────┤ │
│ │KZ-  │Kit Especial │R$ 149.90│R$ 95.00│ 48 ✓  │Pro│ ⚪ │ │
│ │001  │de Verão     │         │        │       │   │     │ │
│ ├─────┼─────────────┼─────────┼────────┼───────┼───┼─────┤ │
│ │KZ-  │Uniforme     │R$ 39.90 │R$ 19.90│ 0 ✗   │Ves│ ⚪ │ │
│ │102  │Camiseta     │         │        │       │   │     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ Mostrando 1-20 de 523                    ◀ 1 2 3 ... 27 ▶  │
└───────────────────────────────────────────────────────────────┘
```

---

## 📋 ESPECIFICAÇÃO DETALHADA

### 1. Cabeçalho da Página

```tsx
<Box sx={{ mb: 4 }}>
  <Typography variant="h4" gutterBottom>
    Produtos
  </Typography>
  <Typography variant="body1" color="text.secondary">
    Gerencie os produtos publicados automaticamente pelo Magis5
  </Typography>
</Box>
```

### 2. Alert Informativo

```tsx
<Alert severity="info" sx={{ mb: 3 }} icon={<InfoOutlined />}>
  <AlertTitle>Sincronização Automática</AlertTitle>
  Os produtos são sincronizados automaticamente pelo Magis5 em tempo real.
  Alterações de preço e estoque são refletidas automaticamente no marketplace.
</Alert>
```

**Características:**
- Sempre visível
- Cor: azul (info)
- Não é dismissível (não tem X para fechar)

### 3. Status da Sincronização

```tsx
<Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
  <Chip 
    icon={<CheckCircle />}
    label="Sincronização ativa" 
    color="success" 
    size="small"
  />
  <Typography variant="body2" color="text.secondary">
    Última atualização: há {timeAgo(lastSync)}
  </Typography>
  <Typography variant="body2" color="text.secondary">
    • Total de produtos: {totalProducts}
  </Typography>
</Box>
```

**Estados do Chip:**

| Condição | Cor | Ícone | Texto |
|----------|-----|-------|-------|
| API Key ativa + última sync < 5 min | success (verde) | ✅ CheckCircle | "Sincronização ativa" |
| API Key ativa + última sync < 1 hora | warning (amarelo) | ⏱️ HourglassEmpty | "Sincronização lenta" |
| API Key ativa + última sync > 1 hora | error (vermelho) | ⚠️ Warning | "Sincronização parada" |
| Sem API Key | default (cinza) | ⭕ Cancel | "Não configurado" |

**Lógica:**
```typescript
function getSyncStatus(lastUsedAt: Date | null): SyncStatus {
  if (!lastUsedAt) {
    return { color: 'default', icon: Cancel, label: 'Não configurado' };
  }

  const minutesAgo = differenceInMinutes(new Date(), lastUsedAt);

  if (minutesAgo < 5) {
    return { color: 'success', icon: CheckCircle, label: 'Sincronização ativa' };
  }

  if (minutesAgo < 60) {
    return { color: 'warning', icon: HourglassEmpty, label: 'Sincronização lenta' };
  }

  return { color: 'error', icon: Warning, label: 'Sincronização parada' };
}
```

### 4. Filtros

```tsx
<Grid container spacing={2} sx={{ mb: 3 }}>
  {/* Filtro de Status */}
  <Grid item xs={12} sm={3}>
    <FormControl fullWidth size="small">
      <InputLabel>Status</InputLabel>
      <Select 
        value={filters.status} 
        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
      >
        <MenuItem value="">Todos</MenuItem>
        <MenuItem value="active">Ativos</MenuItem>
        <MenuItem value="inactive">Inativos</MenuItem>
      </Select>
    </FormControl>
  </Grid>

  {/* Filtro de Estoque */}
  <Grid item xs={12} sm={3}>
    <FormControl fullWidth size="small">
      <InputLabel>Estoque</InputLabel>
      <Select 
        value={filters.stock} 
        onChange={(e) => setFilters(prev => ({ ...prev, stock: e.target.value }))}
      >
        <MenuItem value="">Todos</MenuItem>
        <MenuItem value="in_stock">Em estoque (&gt; 0)</MenuItem>
        <MenuItem value="low_stock">Estoque baixo (≤ 10)</MenuItem>
        <MenuItem value="out_of_stock">Esgotado (0)</MenuItem>
      </Select>
    </FormControl>
  </Grid>

  {/* Busca */}
  <Grid item xs={12} sm={6}>
    <TextField
      fullWidth
      size="small"
      placeholder="Buscar por nome ou SKU..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
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
```

**Busca com Debounce:**
```typescript
const [searchTerm, setSearchTerm] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchTerm);
  }, 500); // 500ms de delay

  return () => clearTimeout(timer);
}, [searchTerm]);

useEffect(() => {
  loadProducts();
}, [debouncedSearch, filters.status, filters.stock, page]);
```

### 5. Tabela de Produtos

```tsx
<TableContainer component={Paper}>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell width={100}>SKU</TableCell>
        <TableCell>Nome</TableCell>
        <TableCell align="right" width={120}>Preço</TableCell>
        <TableCell align="right" width={120}>Custo</TableCell>
        <TableCell align="center" width={100}>Estoque</TableCell>
        <TableCell width={120}>Categoria</TableCell>
        <TableCell align="center" width={80}>Ativo</TableCell>
        <TableCell align="center" width={80}>Ações</TableCell>
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
            <Tooltip title={product.name} arrow>
              <Typography noWrap sx={{ maxWidth: 250 }}>
                {product.name}
              </Typography>
            </Tooltip>
          </TableCell>

          <TableCell align="right">
            <Typography variant="body2" fontWeight="medium">
              {formatCurrency(product.price)}
            </Typography>
          </TableCell>

          <TableCell align="right">
            <Typography variant="body2" color="text.secondary">
              {formatCurrency(product.costPrice)}
            </Typography>
          </TableCell>

          <TableCell align="center">
            <Chip
              label={`${product.stock} un`}
              size="small"
              color={getStockColor(product.stock)}
            />
          </TableCell>

          <TableCell>
            <Chip 
              label={product.categoryName} 
              size="small" 
              variant="outlined"
            />
          </TableCell>

          <TableCell align="center">
            <Switch
              checked={product.isActive}
              onChange={() => handleToggleActive(product.id, product.isActive)}
              color="primary"
              size="small"
            />
          </TableCell>

          <TableCell align="center">
            <IconButton 
              size="small" 
              onClick={() => setSelectedProduct(product)}
            >
              <Visibility fontSize="small" />
            </IconButton>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>

  {/* Sem produtos */}
  {products.length === 0 && (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Inventory2Outlined sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h6" color="text.secondary">
        Nenhum produto encontrado
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Os produtos publicados pelo Magis5 aparecerão aqui
      </Typography>
    </Box>
  )}
</TableContainer>
```

**Cores do Estoque:**
```typescript
function getStockColor(stock: number): 'success' | 'warning' | 'error' | 'default' {
  if (stock > 10) return 'success';   // Verde: estoque bom
  if (stock > 0) return 'warning';    // Laranja: estoque baixo
  return 'error';                     // Vermelho: esgotado
}
```

### 6. Paginação

```tsx
<TablePagination
  component="div"
  count={totalProducts}
  page={page}
  onPageChange={(_, newPage) => setPage(newPage)}
  rowsPerPage={rowsPerPage}
  onRowsPerPageChange={(e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  }}
  rowsPerPageOptions={[10, 20, 50, 100]}
  labelRowsPerPage="Produtos por página:"
  labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
/>
```

---

## 🔧 FUNCIONALIDADES

### 1. Toggle Ativo/Inativo

**Frontend:**
```tsx
async function handleToggleActive(productId: string, currentStatus: boolean) {
  const newStatus = !currentStatus;

  try {
    // Otimistic update
    setProducts(prev => 
      prev.map(p => p.id === productId ? { ...p, isActive: newStatus } : p)
    );

    await adminProductsService.toggleActive(productId, newStatus);

    showMessage(
      newStatus ? 'Produto ativado com sucesso' : 'Produto desativado',
      'success'
    );
  } catch (error: any) {
    // Revert on error
    setProducts(prev => 
      prev.map(p => p.id === productId ? { ...p, isActive: currentStatus } : p)
    );

    showMessage(error.message || 'Erro ao atualizar produto', 'error');
  }
}
```

**Backend Endpoint:**
```
PATCH /api/admin/products/:id/toggle-active
Body: { isActive: boolean }
```

**Use Case:**
```typescript
@Injectable()
export class ToggleProductActiveUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: ProductRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: { id: string; isActive: boolean }): Promise<Product> {
    const product = await this.productRepo.findById(ProductId.from(command.id));

    if (!product) {
      throw new ProductNotFoundException(command.id);
    }

    product.setActive(command.isActive);

    return this.unitOfWork.execute(async () => {
      return this.productRepo.save(product);
    });
  }
}
```

### 2. Ver Detalhes (Drawer)

**Drawer completo:**
```tsx
<Drawer
  anchor="right"
  open={!!selectedProduct}
  onClose={() => setSelectedProduct(null)}
  PaperProps={{ sx: { width: { xs: '100%', sm: 500 } } }}
>
  {selectedProduct && (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>
              {selectedProduct.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" fontFamily="monospace">
              SKU: {selectedProduct.sku}
            </Typography>
          </Box>
          <IconButton onClick={() => setSelectedProduct(null)}>
            <Close />
          </IconButton>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Chip 
            label={selectedProduct.isActive ? 'Ativo' : 'Inativo'} 
            color={selectedProduct.isActive ? 'success' : 'default'}
            size="small"
          />
          <Chip 
            label={selectedProduct.categoryName} 
            variant="outlined"
            size="small"
          />
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Imagens */}
        {selectedProduct.images && selectedProduct.images.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Imagens do Produto
            </Typography>
            <Grid container spacing={1}>
              {selectedProduct.images.map((img, idx) => (
                <Grid item xs={6} key={idx}>
                  <Box
                    component="img"
                    src={img.url}
                    alt={`Imagem ${idx + 1}`}
                    sx={{
                      width: '100%',
                      height: 150,
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: img.isPrimary ? 2 : 1,
                      borderColor: img.isPrimary ? 'primary.main' : 'divider',
                    }}
                  />
                  {img.isPrimary && (
                    <Typography variant="caption" color="primary">
                      Principal
                    </Typography>
                  )}
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Preços e Estoque */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Preços e Estoque
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Preço de Venda
                </Typography>
                <Typography variant="h6" color="primary">
                  {formatCurrency(selectedProduct.price)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Custo
                </Typography>
                <Typography variant="h6">
                  {formatCurrency(selectedProduct.costPrice)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Estoque
                </Typography>
                <Typography 
                  variant="h6"
                  color={selectedProduct.stock > 10 ? 'success.main' : selectedProduct.stock > 0 ? 'warning.main' : 'error.main'}
                >
                  {selectedProduct.stock} unidades
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Margem de Lucro
                </Typography>
                <Typography variant="h6">
                  {calculateMargin(selectedProduct.price, selectedProduct.costPrice)}%
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Descrição */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Descrição
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedProduct.description || 'Nenhuma descrição disponível'}
          </Typography>
        </Box>

        {/* Dimensões */}
        {(selectedProduct.weight || selectedProduct.width) && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Peso e Dimensões
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {selectedProduct.weight && (
                <Typography variant="body2">
                  <strong>Peso:</strong> {selectedProduct.weight} kg
                </Typography>
              )}
              {selectedProduct.width && (
                <>
                  <Typography variant="body2">
                    <strong>Largura:</strong> {selectedProduct.width} cm
                  </Typography>
                  <Typography variant="body2">
                    <strong>Altura:</strong> {selectedProduct.height} cm
                  </Typography>
                  <Typography variant="body2">
                    <strong>Comprimento:</strong> {selectedProduct.length} cm
                  </Typography>
                </>
              )}
            </Box>
          </Box>
        )}

        {/* Sincronização */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Informações de Sincronização
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Criado em:</strong> {formatDateTime(selectedProduct.createdAt)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Última atualização:</strong> {formatDateTime(selectedProduct.updatedAt)}
            </Typography>
            <Typography variant="caption" color="info.main" sx={{ mt: 1 }}>
              ℹ️ Este produto é gerenciado pelo Magis5. Alterações devem ser feitas no painel do Magis5.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button 
          fullWidth 
          variant="outlined" 
          onClick={() => setSelectedProduct(null)}
        >
          Fechar
        </Button>
      </Box>
    </Box>
  )}
</Drawer>
```

**Cálculo de margem:**
```typescript
function calculateMargin(price: number, cost: number): string {
  if (cost === 0) return '—';
  const margin = ((price - cost) / price) * 100;
  return margin.toFixed(1);
}
```

---

## 🔌 BACKEND — APIs NECESSÁRIAS

### GET /api/admin/products

```typescript
@Get()
@UseGuards(AdminGuard)
async list(@Query() query: ListProductsQueryDto) {
  const result = await this.listProductsUseCase.execute({
    page: query.page || 1,
    limit: query.limit || 20,
    search: query.search,
    status: query.status, // 'active' | 'inactive'
    inStock: query.stock === 'in_stock',
    lowStock: query.stock === 'low_stock',
    outOfStock: query.stock === 'out_of_stock',
  });

  return {
    data: result.products.map(p => ProductResponseDto.fromDomain(p)),
    pagination: result.pagination,
  };
}
```

### PATCH /api/admin/products/:id/toggle-active

```typescript
@Patch(':id/toggle-active')
@UseGuards(AdminGuard)
async toggleActive(
  @Param('id') id: string,
  @Body() dto: { isActive: boolean },
) {
  const product = await this.toggleActiveUseCase.execute({
    id,
    isActive: dto.isActive,
  });

  return ProductResponseDto.fromDomain(product);
}
```

### GET /api/admin/marketplace/sync-status

```typescript
@Get('sync-status')
@UseGuards(AdminGuard)
async getSyncStatus() {
  const apiKey = await this.apiKeyRepo.findOne({ isActive: true });

  if (!apiKey) {
    return {
      status: 'not_configured',
      lastSync: null,
      totalProducts: 0,
    };
  }

  const totalProducts = await this.productRepo.count();
  const minutesAgo = apiKey.lastUsedAt 
    ? differenceInMinutes(new Date(), apiKey.lastUsedAt)
    : null;

  let status = 'active';
  if (minutesAgo === null) status = 'never_used';
  else if (minutesAgo > 60) status = 'stopped';
  else if (minutesAgo > 5) status = 'slow';

  return {
    status,
    lastSync: apiKey.lastUsedAt,
    totalProducts,
  };
}
```

---

## 📦 SERVICE (Frontend)

```typescript
// src/services/adminProductsService.ts
import api from 'src/services/api';

async function list(params: ListProductsParams) {
  const response = await api.get('/api/admin/products', { params });
  return response.data;
}

async function toggleActive(id: string, isActive: boolean) {
  const response = await api.patch(`/api/admin/products/${id}/toggle-active`, {
    isActive,
  });
  return response.data;
}

async function getSyncStatus() {
  const response = await api.get('/api/admin/marketplace/sync-status');
  return response.data;
}

const adminProductsService = {
  list,
  toggleActive,
  getSyncStatus,
};

export default adminProductsService;
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Backend
- [ ] Endpoint GET /api/admin/products (lista paginada)
- [ ] Endpoint PATCH /api/admin/products/:id/toggle-active
- [ ] Endpoint GET /api/admin/marketplace/sync-status
- [ ] ToggleProductActiveUseCase
- [ ] ProductResponseDto
- [ ] Filtros de busca (search, status, stock)

### Frontend
- [ ] Página /admin/produtos
- [ ] Alert informativo (sempre visível)
- [ ] Status de sincronização (chip colorido)
- [ ] Filtros (Status, Estoque, Busca)
- [ ] Tabela de produtos
- [ ] Paginação
- [ ] Switch toggle ativo/inativo
- [ ] Drawer de detalhes
- [ ] Estado vazio (sem produtos)
- [ ] adminProductsService
- [ ] Debounce na busca
- [ ] Otimistic updates

### Remover
- [ ] Botão "Sincronizar com Bling"
- [ ] Texto "Última sincronização: pendente de implementação"
- [ ] Qualquer referência ao Bling nesta tela

---

## 🎨 DIFERENÇAS VS. TELA ATUAL

| Aspecto | ANTES (com Bling) | DEPOIS (com Magis5) |
|---------|------------------|---------------------|
| Botão Sync | ✅ "Sincronizar com Bling" | ❌ Removido |
| Status sync | ❌ Texto estático | ✅ Chip dinâmico com cores |
| Info | ❌ Nenhuma | ✅ Alert explicativo |
| Última sync | ❌ "pendente..." | ✅ Timestamp real (há X minutos) |
| Filtros | ✅ Status, Estoque | ✅ Mantido + melhorado |
| Busca | ✅ Básica | ✅ Com debounce |
| Detalhes | ❌ Não tinha | ✅ Drawer completo |
| Ativar/Desativar | ❌ Não tinha | ✅ Switch inline |

---

**TELA DEVE SER APENAS DE VISUALIZAÇÃO E GESTÃO BÁSICA.**  
**PRODUTOS SÃO GERENCIADOS PELO MAGIS5, NÃO PELO ADMIN KAZA TEM.**  
**SINCRONIZAÇÃO É AUTOMÁTICA E EM TEMPO REAL.**
