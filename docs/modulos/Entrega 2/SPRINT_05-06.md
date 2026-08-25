# SPRINT 05-06: INTEGRAÇÃO BLING + E-COMMERCE BASE

**Duração:** 2 semanas  
**Objetivo:** Integrar com Bling para produtos + Criar estrutura base do e-commerce  
**Prioridade:** 🔴 CRÍTICA  
**Dependências:** ✅ SPRINT 03-04 concluído

---

## 🎯 OBJETIVOS

### Semana 1: Integração Bling
- [ ] OAuth 2.0 com Bling
- [ ] Sincronização de produtos
- [ ] Sincronização de imagens (Magis5)
- [ ] Cron job automático

### Semana 2: E-commerce Base
- [ ] Listagem de produtos
- [ ] Detalhes do produto
- [ ] Busca e filtros
- [ ] Estrutura do carrinho

---

## 📦 PARTE 1: INTEGRAÇÃO BLING

### 1.1 OAuth 2.0 Bling

**Criar:** `src/infrastructure/integrations/bling/bling.client.ts`

```typescript
@Injectable()
export class BlingClient {
  private accessToken: string;
  private refreshToken: string;
  private tokenExpiresAt: Date;
  
  constructor(
    private readonly configService: ConfigService,
    @Inject(BLING_TOKEN_REPOSITORY)
    private readonly tokenRepository: BlingTokenRepositoryPort,
  ) {}
  
  async authenticate(): Promise<void> {
    const clientId = this.configService.get('BLING_CLIENT_ID');
    const clientSecret = this.configService.get('BLING_CLIENT_SECRET');
    
    const response = await axios.post(
      'https://www.bling.com.br/Api/v3/oauth/token',
      {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }
    );
    
    this.accessToken = response.data.access_token;
    this.refreshToken = response.data.refresh_token;
    this.tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);
    
    // Salvar tokens no banco
    await this.tokenRepository.save({
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiresAt: this.tokenExpiresAt,
    });
  }
  
  async getProducts(page: number = 1): Promise<BlingProduct[]> {
    await this.ensureValidToken();
    
    const response = await axios.get(
      `https://www.bling.com.br/Api/v3/produtos?pagina=${page}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      }
    );
    
    return response.data.data;
  }
  
  async createOrder(orderData: CreateBlingOrderDto): Promise<string> {
    await this.ensureValidToken();
    
    const response = await axios.post(
      'https://www.bling.com.br/Api/v3/pedidos',
      orderData,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data.data.id;
  }
  
  async createPayable(payableData: CreateBlingPayableDto): Promise<string> {
    await this.ensureValidToken();
    
    const response = await axios.post(
      'https://www.bling.com.br/Api/v3/contas-pagar',
      payableData,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data.data.id;
  }
  
  private async ensureValidToken(): Promise<void> {
    if (this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return; // Token ainda válido
    }
    
    // Renovar token
    await this.refreshAccessToken();
  }
  
  private async refreshAccessToken(): Promise<void> {
    const response = await axios.post(
      'https://www.bling.com.br/Api/v3/oauth/token',
      {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      }
    );
    
    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);
    
    await this.tokenRepository.update({
      accessToken: this.accessToken,
      expiresAt: this.tokenExpiresAt,
    });
  }
}
```

### 1.2 Sincronização de Produtos

**Criar:** `src/contexts/product/application/use-cases/sync-products-from-bling/`

```typescript
@Injectable()
export class SyncProductsFromBlingUseCase {
  constructor(
    private readonly blingClient: BlingClient,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}
  
  async execute(): Promise<SyncResultDto> {
    let updated = 0;
    let created = 0;
    let errors = 0;
    
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      try {
        const blingProducts = await this.blingClient.getProducts(page);
        
        if (blingProducts.length === 0) {
          hasMore = false;
          break;
        }
        
        for (const blingProduct of blingProducts) {
          try {
            await this.syncProduct(blingProduct);
            
            // Verificar se já existe
            const existing = await this.productRepository.findByBlingId(
              blingProduct.id
            );
            
            if (existing) {
              updated++;
            } else {
              created++;
            }
          } catch (error) {
            this.logger.error(`Error syncing product ${blingProduct.id}`, error);
            errors++;
          }
        }
        
        page++;
      } catch (error) {
        this.logger.error('Error fetching products from Bling', error);
        break;
      }
    }
    
    return {
      updated,
      created,
      errors,
      timestamp: new Date(),
    };
  }
  
  private async syncProduct(blingProduct: BlingProduct): Promise<void> {
    const existing = await this.productRepository.findByBlingId(blingProduct.id);
    
    if (existing) {
      // Atualizar
      existing.updatePrice(Price.create(blingProduct.preco));
      existing.updateStock(Stock.create(blingProduct.estoque));
      existing.updateName(blingProduct.descricao);
      
      await this.unitOfWork.execute(async () => {
        await this.productRepository.save(existing);
      });
    } else {
      // Criar
      const product = Product.create(
        blingProduct.id,
        SKU.create(blingProduct.codigo),
        blingProduct.descricao,
        blingProduct.descricaoComplementar || '',
        Price.create(blingProduct.preco),
        Price.create(blingProduct.precoCusto),
        Stock.create(blingProduct.estoque),
      );
      
      await this.unitOfWork.execute(async () => {
        await this.productRepository.save(product);
      });
    }
  }
}
```

### 1.3 Cron Job Sincronização

**Criar:** `src/infrastructure/jobs/sync-products.job.ts`

```typescript
@Injectable()
export class SyncProductsJob {
  private readonly logger = new Logger(SyncProductsJob.name);
  
  constructor(
    private readonly syncProductsUseCase: SyncProductsFromBlingUseCase,
  ) {}
  
  @Cron('0 * * * *') // Executa a cada hora
  async handleCron() {
    this.logger.log('Starting product synchronization...');
    
    try {
      const result = await this.syncProductsUseCase.execute();
      
      this.logger.log(`Sync completed: ${result.created} created, ${result.updated} updated, ${result.errors} errors`);
    } catch (error) {
      this.logger.error('Error during product synchronization', error);
    }
  }
}
```

### 1.4 Integração Magis5 (Imagens)

**Criar:** `src/infrastructure/integrations/magis5/magis5.client.ts`

```typescript
@Injectable()
export class Magis5Client {
  constructor(
    private readonly configService: ConfigService,
  ) {}
  
  async getProductImages(sku: string): Promise<string[]> {
    const apiKey = this.configService.get('MAGIS5_API_KEY');
    const apiUrl = this.configService.get('MAGIS5_API_URL');
    
    try {
      const response = await axios.get(
        `${apiUrl}/products/${sku}/images`,
        {
          headers: {
            'X-API-Key': apiKey,
          },
        }
      );
      
      return response.data.images || [];
    } catch (error) {
      this.logger.warn(`No images found for SKU ${sku}`);
      return [];
    }
  }
}
```

**Criar:** `src/contexts/product/application/use-cases/sync-product-images/`

```typescript
@Injectable()
export class SyncProductImagesUseCase {
  constructor(
    private readonly magis5Client: Magis5Client,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(PRODUCT_IMAGE_REPOSITORY)
    private readonly imageRepository: ProductImageRepositoryPort,
  ) {}
  
  async execute(): Promise<void> {
    const products = await this.productRepository.findAll();
    
    for (const product of products) {
      try {
        const images = await this.magis5Client.getProductImages(product.sku.value);
        
        if (images.length > 0) {
          // Limpar imagens antigas
          await this.imageRepository.deleteByProductId(product.id);
          
          // Adicionar novas
          for (let i = 0; i < images.length; i++) {
            await this.imageRepository.save({
              productId: product.id,
              url: images[i],
              position: i,
              isPrimary: i === 0,
            });
          }
        }
      } catch (error) {
        this.logger.error(`Error syncing images for product ${product.id.value}`, error);
      }
    }
  }
}
```

---

## 📦 PARTE 2: E-COMMERCE BASE

### 2.1 Frontend - Listagem de Produtos

**Criar:** `src/app/produtos/page.tsx`

```typescript
export function ProductListingPage() {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({
    category: '',
    minPrice: 0,
    maxPrice: 10000,
    inStock: true,
  });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadProducts();
  }, [filters]);
  
  async function loadProducts() {
    setLoading(true);
    try {
      const response = await productService.list(filters);
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products', error);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <Container>
      <Breadcrumb>
        <Link href="/">Home</Link>
        <ChevronRight />
        <span>Produtos</span>
      </Breadcrumb>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <FilterSidebar
            filters={filters}
            onFilterChange={setFilters}
          />
        </Grid>
        
        <Grid item xs={12} md={9}>
          <ProductListHeader>
            <Typography variant="h5">
              {products.length} produtos encontrados
            </Typography>
            <SortSelect>
              <option value="relevance">Mais relevantes</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
              <option value="name">Nome A-Z</option>
            </SortSelect>
          </ProductListHeader>
          
          {loading ? (
            <ProductGrid>
              {[1,2,3,4,5,6,7,8].map(i => (
                <Skeleton key={i} variant="rectangular" height={400} />
              ))}
            </ProductGrid>
          ) : (
            <ProductGrid>
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ProductGrid>
          )}
          
          <Pagination
            count={10}
            page={1}
            onChange={(e, page) => console.log(page)}
          />
        </Grid>
      </Grid>
    </Container>
  );
}
```

### 2.2 Frontend - Detalhes do Produto

**Criar:** `src/app/produtos/[id]/page.tsx`

```typescript
export function ProductDetailPage({ params }) {
  const [product, setProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  
  useEffect(() => {
    loadProduct();
  }, [params.id]);
  
  async function loadProduct() {
    const response = await productService.getById(params.id);
    setProduct(response.data);
  }
  
  async function handleAddToCart() {
    await cartService.addItem(product.id, quantity);
    showMessage('Produto adicionado ao carrinho', 'success');
  }
  
  if (!product) return <LoadingSkeleton />;
  
  return (
    <Container>
      <Breadcrumb>
        <Link href="/">Home</Link>
        <ChevronRight />
        <Link href="/produtos">Produtos</Link>
        <ChevronRight />
        <span>{product.name}</span>
      </Breadcrumb>
      
      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <ProductGallery>
            <MainImage src={product.images[selectedImage]?.url} />
            <Thumbnails>
              {product.images.map((img, index) => (
                <Thumbnail
                  key={index}
                  src={img.url}
                  selected={index === selectedImage}
                  onClick={() => setSelectedImage(index)}
                />
              ))}
            </Thumbnails>
          </ProductGallery>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <ProductInfo>
            <Typography variant="h4">{product.name}</Typography>
            
            <PriceDisplay>
              {product.oldPrice && (
                <OldPrice>De: {formatCurrency(product.oldPrice)}</OldPrice>
              )}
              <CurrentPrice>{formatCurrency(product.price)}</CurrentPrice>
              <Installments>
                ou 12x de {formatCurrency(product.price / 12)} sem juros
              </Installments>
            </PriceDisplay>
            
            {product.stock > 0 && (
              <FreeShippingBadge>
                <LocalShippingIcon /> Frete GRÁTIS
              </FreeShippingBadge>
            )}
            
            <QuantitySelector>
              <Typography>Quantidade:</Typography>
              <ButtonGroup>
                <Button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                  -
                </Button>
                <QuantityDisplay>{quantity}</QuantityDisplay>
                <Button onClick={() => setQuantity(quantity + 1)}>
                  +
                </Button>
              </ButtonGroup>
              <Typography variant="caption">
                {product.stock} disponíveis
              </Typography>
            </QuantitySelector>
            
            <ActionButtons>
              <BuyNowButton variant="contained" color="primary">
                COMPRAR AGORA
              </BuyNowButton>
              <AddToCartButton variant="outlined" onClick={handleAddToCart}>
                ADICIONAR AO CARRINHO
              </AddToCartButton>
            </ActionButtons>
            
            <ShippingCalculator>
              <TextField
                label="Calcular frete"
                placeholder="00000-000"
                InputProps={{
                  endAdornment: (
                    <Button size="small">CALCULAR</Button>
                  ),
                }}
              />
            </ShippingCalculator>
          </ProductInfo>
        </Grid>
      </Grid>
      
      <ProductTabs>
        <Tab label="Descrição" />
        <Tab label="Especificações" />
        <Tab label="Avaliações" />
      </ProductTabs>
      
      <TabPanel>
        <Typography>{product.description}</Typography>
      </TabPanel>
    </Container>
  );
}
```

### 2.3 Backend - Product Queries

**Criar:** `src/contexts/product/application/use-cases/list-products/`

```typescript
export interface ListProductsQuery {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}
  
  async execute(query: ListProductsQuery): Promise<ProductListDto> {
    const filters = {
      categoryId: query.category,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      inStock: query.inStock,
      limit: query.limit || 20,
      offset: ((query.page || 1) - 1) * (query.limit || 20),
    };
    
    const products = await this.productRepository.findAll(filters);
    const total = await this.productRepository.count(filters);
    
    return {
      products: products.map(p => ProductDto.fromDomain(p)),
      total,
      page: query.page || 1,
      totalPages: Math.ceil(total / (query.limit || 20)),
    };
  }
}
```

**Criar:** `src/infrastructure/http/controllers/product/product.controller.ts`

```typescript
@Controller('products')
export class ProductController {
  constructor(
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly searchProductsUseCase: SearchProductsUseCase,
  ) {}
  
  @Get()
  async list(@Query() query: ListProductsQueryDto) {
    try {
      const result = await this.listProductsUseCase.execute(query);
      return result;
    } catch (error) {
      this.logger.error('Error listing products', error);
      throw error;
    }
  }
  
  @Get('search')
  async search(@Query('q') searchTerm: string) {
    try {
      const result = await this.searchProductsUseCase.execute({ searchTerm });
      return result;
    } catch (error) {
      this.logger.error('Error searching products', error);
      throw error;
    }
  }
  
  @Get(':id')
  async getById(@Param('id') id: string) {
    try {
      const product = await this.getProductUseCase.execute({ id });
      return product;
    } catch (error) {
      this.logger.error('Error getting product', error);
      throw error;
    }
  }
}
```

---

## ✅ CHECKLIST DE CONCLUSÃO

### Backend - Integração Bling
- [ ] OAuth 2.0 funcionando
- [ ] Sincronização de produtos
- [ ] Cron job executando a cada hora
- [ ] Logs de sincronização
- [ ] Integração Magis5 (imagens)

### Backend - Products
- [ ] Product entity completa
- [ ] ListProductsUseCase
- [ ] GetProductUseCase
- [ ] SearchProductsUseCase
- [ ] Controllers REST

### Frontend
- [ ] Listagem de produtos
- [ ] Filtros laterais
- [ ] Detalhes do produto
- [ ] Galeria de imagens
- [ ] Skeleton loading
- [ ] Responsivo

### Testes
- [ ] Sincronização Bling funciona
- [ ] Listagem retorna produtos
- [ ] Detalhes carregam corretamente
- [ ] Filtros funcionam
- [ ] Busca funciona

---

## 📊 MÉTRICAS

- [ ] Sincronização completa em < 5 minutos
- [ ] Listagem carrega em < 1s
- [ ] Imagens carregam (lazy loading)
- [ ] Taxa de erro sincronização < 1%

---

## 🚀 PRÓXIMO SPRINT

⬅️ [SPRINT 03-04](SPRINT_03-04.md)  
➡️ [SPRINT 07-08](SPRINT_07-08.md) - Checkout + Pagamento + Rastreamento

---

**Versão:** 1.0  
**Status:** 📝 Planejado
