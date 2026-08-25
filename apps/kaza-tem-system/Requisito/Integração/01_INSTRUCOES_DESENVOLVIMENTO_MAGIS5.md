# INSTRUÇÕES DE DESENVOLVIMENTO — INTEGRAÇÃO MAGIS5
## Guia passo-a-passo para o Codex implementar

> **OBJETIVO:** Implementar integração completa Magis5 conforme especificação em 02_INTEGRACAO_MAGIS5.md  
> **AÇÃO REQUERIDA:** Desenvolver código backend + frontend + remover Bling  
> **VALIDAÇÃO:** Claude irá revisar o código gerado  

---

## 📋 VISÃO GERAL

Você (Codex) deve implementar uma API REST que o Magis5 (ERP externo) irá consumir para:
1. Buscar lista de produtos do marketplace Kaza Tem
2. Criar novos produtos no marketplace
3. Atualizar preço/estoque de produtos existentes
4. Receber webhooks quando pedidos forem pagos

**Substituir:** Toda integração Bling (OAuth, sync produtos, contas a pagar) por integração Magis5 (API Key, API fornecida pelo Kaza Tem).

---

## 🎯 FASE 1 — BACKEND: AUTENTICAÇÃO

### 1.1 Criar Migration da Tabela

**Arquivo:** `apps/kaza-tem-system/src/infrastructure/persistence/mikro-orm/migrations/XXXXXXX-create-marketplace-api-keys.ts`

```typescript
import { Migration } from '@mikro-orm/migrations';

export class Migration20250220000001 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE marketplace_api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        api_key VARCHAR(64) UNIQUE NOT NULL,
        api_secret VARCHAR(64) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        permissions JSONB DEFAULT '["products:read", "products:write", "orders:read"]',
        webhook_url VARCHAR(500),
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_marketplace_api_keys_key ON marketplace_api_keys(api_key);
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS marketplace_api_keys CASCADE;');
  }
}
```

### 1.2 Criar ORM Entity

**Arquivo:** `apps/kaza-tem-system/src/infrastructure/persistence/mikro-orm/entities/marketplace-api-key-orm.entity.ts`

```typescript
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'marketplace_api_keys' })
export class MarketplaceApiKeyOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id: string;

  @Property()
  name: string;

  @Property({ unique: true })
  apiKey: string;

  @Property()
  apiSecret: string;

  @Property({ default: true })
  isActive: boolean;

  @Property({ type: 'jsonb', default: '["products:read", "products:write", "orders:read"]' })
  permissions: string[];

  @Property({ nullable: true })
  webhookUrl?: string;

  @Property({ nullable: true })
  lastUsedAt?: Date;

  @Property({ onCreate: () => new Date() })
  createdAt: Date;

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date;
}
```

### 1.3 Criar Domain Value Object

**Arquivo:** `apps/kaza-tem-system/src/contexts/marketplace/domain/value-objects/api-credentials.vo.ts`

```typescript
import { ValueObject } from '@gitspread/domain-primitives';

interface ApiCredentialsProps {
  apiKey: string;
  apiSecret: string;
}

export class ApiCredentials extends ValueObject<ApiCredentialsProps> {
  get apiKey(): string {
    return this.props.apiKey;
  }

  get apiSecret(): string {
    return this.props.apiSecret;
  }

  static generate(): ApiCredentials {
    const crypto = require('crypto');
    return new ApiCredentials({
      apiKey: crypto.randomBytes(32).toString('hex'),    // 64 chars
      apiSecret: crypto.randomBytes(32).toString('hex'), // 64 chars
    });
  }

  protected validate(props: ApiCredentialsProps): void {
    if (!props.apiKey || props.apiKey.length !== 64) {
      throw new Error('API Key must be 64 characters');
    }
    if (!props.apiSecret || props.apiSecret.length !== 64) {
      throw new Error('API Secret must be 64 characters');
    }
  }
}
```

### 1.4 Criar Guard de Autenticação

**Arquivo:** `apps/kaza-tem-system/src/infrastructure/http/guards/marketplace-auth.guard.ts`

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { MarketplaceApiKeyOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/marketplace-api-key-orm.entity';

@Injectable()
export class MarketplaceAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(MarketplaceApiKeyOrmEntity)
    private readonly apiKeyRepo: EntityRepository<MarketplaceApiKeyOrmEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const apiSecret = request.headers['x-api-secret'];

    if (!apiKey || !apiSecret) {
      throw new UnauthorizedException('API credentials required');
    }

    const credentials = await this.apiKeyRepo.findOne({ apiKey });

    if (!credentials) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!credentials.isActive) {
      throw new UnauthorizedException('API key disabled');
    }

    if (credentials.apiSecret !== apiSecret) {
      throw new UnauthorizedException('Invalid API secret');
    }

    // Atualizar last_used_at (async)
    credentials.lastUsedAt = new Date();
    this.apiKeyRepo.flush().catch(() => {});

    // Adicionar ao request para uso nos controllers
    request.marketplaceCredentials = credentials;

    return true;
  }
}
```

### 1.5 Criar Script de Seed (gerar credenciais iniciais)

**Arquivo:** `apps/kaza-tem-system/src/infrastructure/database/seeds/marketplace-api-key.seed.ts`

```typescript
import { MikroORM } from '@mikro-orm/core';
import { MarketplaceApiKeyOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/marketplace-api-key-orm.entity';
import { randomBytes } from 'crypto';

export async function seedMarketplaceApiKey(orm: MikroORM) {
  const em = orm.em.fork();
  
  const existing = await em.count(MarketplaceApiKeyOrmEntity);
  
  if (existing > 0) {
    console.log('Marketplace API key already exists, skipping seed.');
    return;
  }

  const apiKey = new MarketplaceApiKeyOrmEntity();
  apiKey.name = 'Magis5 ERP';
  apiKey.apiKey = randomBytes(32).toString('hex');
  apiKey.apiSecret = randomBytes(32).toString('hex');
  apiKey.isActive = true;
  apiKey.permissions = ['products:read', 'products:write', 'orders:read'];

  await em.persistAndFlush(apiKey);

  console.log('='.repeat(80));
  console.log('MARKETPLACE API CREDENTIALS GENERATED');
  console.log('='.repeat(80));
  console.log(`API Key:    ${apiKey.apiKey}`);
  console.log(`API Secret: ${apiKey.apiSecret}`);
  console.log('='.repeat(80));
  console.log('SAVE THESE CREDENTIALS SECURELY - THEY WILL NOT BE SHOWN AGAIN');
  console.log('='.repeat(80));
}
```

---

## 🎯 FASE 2 — BACKEND: ENDPOINTS MARKETPLACE API

### 2.1 Criar Controller Base

**Arquivo:** `apps/kaza-tem-system/src/infrastructure/http/controllers/marketplace/marketplace-products.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { MarketplaceAuthGuard } from '@infrastructure/http/guards/marketplace-auth.guard';
import { ListProductsForMarketplaceUseCase } from '@application/use-cases/marketplace/list-products-marketplace.use-case';
import { CreateProductFromMarketplaceUseCase } from '@application/use-cases/marketplace/create-product-marketplace.use-case';
import { UpdateProductFromMarketplaceUseCase } from '@application/use-cases/marketplace/update-product-marketplace.use-case';
import { DeactivateProductFromMarketplaceUseCase } from '@application/use-cases/marketplace/deactivate-product-marketplace.use-case';

@Controller('api/v1/products')
@UseGuards(MarketplaceAuthGuard)
export class MarketplaceProductsController {
  constructor(
    private readonly listProducts: ListProductsForMarketplaceUseCase,
    private readonly createProduct: CreateProductFromMarketplaceUseCase,
    private readonly updateProduct: UpdateProductFromMarketplaceUseCase,
    private readonly deactivateProduct: DeactivateProductFromMarketplaceUseCase,
  ) {}

  @Get()
  async list(@Query() query: ListProductsMarketplaceQueryDto) {
    const result = await this.listProducts.execute({
      page: query.page || 1,
      limit: Math.min(query.limit || 100, 100),
      updatedSince: query.updated_since,
    });

    return {
      success: true,
      data: result.products.map(p => this.toApiResponse(p)),
      pagination: result.pagination,
    };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const product = await this.listProducts.execute({ productId: id });
    
    return {
      success: true,
      data: this.toApiResponse(product),
    };
  }

  @Post()
  async create(@Body() dto: CreateProductMarketplaceDto) {
    const product = await this.createProduct.execute(dto);
    
    return {
      success: true,
      data: this.toApiResponse(product),
      message: 'Product created successfully',
    };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductMarketplaceDto) {
    const product = await this.updateProduct.execute({ id, ...dto });
    
    return {
      success: true,
      data: this.toApiResponse(product),
      message: 'Product updated successfully',
    };
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    await this.deactivateProduct.execute({ id });
    
    return {
      success: true,
      message: 'Product deactivated successfully',
    };
  }

  private toApiResponse(product: Product): any {
    return {
      id: product.id.value,
      sku: product.sku,
      name: product.name,
      description: product.description,
      price: product.price,
      cost_price: product.costPrice,
      stock: product.stock,
      category_name: product.categoryName,
      weight: product.weight,
      dimensions: {
        width: product.width,
        height: product.height,
        length: product.length,
      },
      is_active: product.isActive,
      images: product.images.map((img, idx) => ({
        url: img.url,
        position: img.position || idx,
        is_primary: img.isPrimary,
      })),
      created_at: product.createdAt.toISOString(),
      updated_at: product.updatedAt.toISOString(),
    };
  }
}
```

### 2.2 Criar DTOs de Request

**Arquivo:** `apps/kaza-tem-system/src/infrastructure/http/controllers/marketplace/dto/create-product-marketplace.dto.ts`

```typescript
import { IsString, IsNumber, IsBoolean, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ProductImageDto {
  @IsString()
  url: string;

  @IsNumber()
  @IsOptional()
  position?: number;

  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}

class ProductDimensionsDto {
  @IsNumber()
  @Min(0)
  width: number;

  @IsNumber()
  @Min(0)
  height: number;

  @IsNumber()
  @Min(0)
  length: number;
}

export class CreateProductMarketplaceDto {
  @IsString()
  sku: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cost_price?: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsString()
  @IsOptional()
  category_name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  weight?: number;

  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  @IsOptional()
  dimensions?: ProductDimensionsDto;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  @IsOptional()
  images?: ProductImageDto[];
}
```

### 2.3 Criar Use Cases

**Arquivo:** `apps/kaza-tem-system/src/contexts/marketplace/application/use-cases/create-product-marketplace.use-case.ts`

```typescript
import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { PRODUCT_REPOSITORY } from '@application/ports/output/product-repository.port';
import { UNIT_OF_WORK } from '@application/ports/output/unit-of-work.port';
import { Product } from '@domain/entities/product.entity';

@Injectable()
export class CreateProductFromMarketplaceUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: ProductRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: CreateProductMarketplaceDto): Promise<Product> {
    // Validar SKU único
    const existing = await this.productRepo.findBySku(command.sku);
    if (existing) {
      throw new ConflictException(`Product with SKU ${command.sku} already exists`);
    }

    // Criar produto
    const product = Product.create({
      sku: command.sku,
      name: command.name,
      description: command.description || '',
      price: command.price,
      costPrice: command.cost_price || 0,
      stock: command.stock,
      categoryName: command.category_name || 'Geral',
      weight: command.weight || 0,
      width: command.dimensions?.width || 0,
      height: command.dimensions?.height || 0,
      length: command.dimensions?.length || 0,
      isActive: command.is_active ?? true,
    });

    // Adicionar imagens
    if (command.images) {
      command.images.forEach(img => {
        product.addImage(img.url, img.position, img.is_primary);
      });
    }

    // Salvar
    return this.unitOfWork.execute(async () => {
      return this.productRepo.save(product);
    });
  }
}
```

**IMPORTANTE:** Criar também os use cases:
- `ListProductsForMarketplaceUseCase`
- `UpdateProductFromMarketplaceUseCase`
- `DeactivateProductFromMarketplaceUseCase`

Seguir mesma estrutura, adaptando a lógica conforme a operação.

---

## 🎯 FASE 3 — BACKEND: WEBHOOK DE PEDIDOS

### 3.1 Criar Event Handler

**Arquivo:** `apps/kaza-tem-system/src/infrastructure/messaging/handlers/send-order-webhook.handler.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { MarketplaceApiKeyOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/marketplace-api-key-orm.entity';
import { OrderPaidEvent } from '@domain/events/order-paid.event';
import { createHmac } from 'crypto';

@Injectable()
export class SendOrderWebhookHandler {
  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(MarketplaceApiKeyOrmEntity)
    private readonly apiKeyRepo: EntityRepository<MarketplaceApiKeyOrmEntity>,
  ) {}

  @OnEvent('order.paid')
  async handle(event: OrderPaidEvent) {
    const apiKey = await this.apiKeyRepo.findOne({ isActive: true });

    if (!apiKey || !apiKey.webhookUrl) {
      return; // Sem webhook configurado
    }

    const payload = {
      event: 'order.paid',
      order_id: event.orderId,
      order_number: event.orderNumber,
      customer: {
        name: event.customerName,
        email: event.customerEmail,
        cpf: event.customerCpf,
      },
      items: event.items.map(item => ({
        sku: item.productSku,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
      })),
      address: {
        zip_code: event.addressZipCode,
        street: event.addressStreet,
        number: event.addressNumber,
        complement: event.addressComplement,
        neighborhood: event.addressNeighborhood,
        city: event.addressCity,
        state: event.addressState,
      },
      shipping: {
        carrier: event.shippingCarrier,
        service: event.shippingService,
        cost: event.shippingCost,
      },
      amounts: {
        subtotal: event.subtotal,
        discount: event.discountAmount,
        shipping: event.shippingCost,
        total: event.totalAmount,
      },
      payment: {
        method: event.paymentMethod,
        installments: event.installments,
      },
      created_at: event.createdAt,
      paid_at: event.paidAt,
    };

    const signature = this.generateSignature(payload, apiKey.apiSecret);

    try {
      await this.httpService.axiosRef.post(apiKey.webhookUrl, payload, {
        headers: {
          'X-Webhook-Signature': signature,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });

      console.log(`Webhook sent successfully to ${apiKey.webhookUrl}`);
    } catch (error) {
      console.error('Failed to send webhook:', error.message);
      // NÃO bloquear o fluxo do pedido
    }
  }

  private generateSignature(payload: any, secret: string): string {
    const data = JSON.stringify(payload);
    return createHmac('sha256', secret).update(data).digest('hex');
  }
}
```

---

## 🎯 FASE 4 — BACKEND: ENDPOINTS ADMIN

### 4.1 Controller Admin Marketplace

**Arquivo:** `apps/kaza-tem-system/src/infrastructure/http/controllers/admin/admin-marketplace.controller.ts`

```typescript
import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@infrastructure/http/guards/admin.guard';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { MarketplaceApiKeyOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/marketplace-api-key-orm.entity';
import { randomBytes } from 'crypto';

@Controller('api/admin/marketplace')
@UseGuards(AdminGuard)
export class AdminMarketplaceController {
  constructor(
    @InjectRepository(MarketplaceApiKeyOrmEntity)
    private readonly apiKeyRepo: EntityRepository<MarketplaceApiKeyOrmEntity>,
  ) {}

  @Get('config')
  async getConfig() {
    const apiKey = await this.apiKeyRepo.findOne({ isActive: true });

    if (!apiKey) {
      return {
        apiKey: null,
        hasSecret: false,
        webhookUrl: null,
        lastUsedAt: null,
        totalProducts: 0,
      };
    }

    return {
      apiKey: this.maskApiKey(apiKey.apiKey),
      hasSecret: true,
      webhookUrl: apiKey.webhookUrl,
      lastUsedAt: apiKey.lastUsedAt,
      totalProducts: await this.getProductCount(), // implementar query
    };
  }

  @Put('config')
  async updateConfig(@Body() dto: { webhookUrl: string }) {
    const apiKey = await this.apiKeyRepo.findOne({ isActive: true });

    if (!apiKey) {
      throw new Error('No API key found');
    }

    apiKey.webhookUrl = dto.webhookUrl;
    await this.apiKeyRepo.flush();

    return { success: true };
  }

  @Post('test-webhook')
  async testWebhook() {
    const apiKey = await this.apiKeyRepo.findOne({ isActive: true });

    if (!apiKey || !apiKey.webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const testPayload = {
      event: 'test',
      message: 'This is a test webhook from Kaza Tem',
      timestamp: new Date().toISOString(),
    };

    try {
      const axios = require('axios');
      await axios.post(apiKey.webhookUrl, testPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });

      return { success: true, message: 'Webhook sent successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Post('regenerate-credentials')
  async regenerateCredentials() {
    const apiKey = await this.apiKeyRepo.findOne({ isActive: true });

    if (!apiKey) {
      throw new Error('No API key found');
    }

    const newApiKey = randomBytes(32).toString('hex');
    const newApiSecret = randomBytes(32).toString('hex');

    apiKey.apiKey = newApiKey;
    apiKey.apiSecret = newApiSecret;
    await this.apiKeyRepo.flush();

    return {
      success: true,
      apiKey: newApiKey,
      apiSecret: newApiSecret,
      message: 'SAVE THESE CREDENTIALS - THEY WILL NOT BE SHOWN AGAIN',
    };
  }

  private maskApiKey(key: string): string {
    if (key.length <= 12) return key;
    return key.substring(0, 6) + '...' + key.substring(key.length - 6);
  }

  private async getProductCount(): Promise<number> {
    // Implementar query COUNT de produtos
    return 0; // placeholder
  }
}
```

---

## 🎯 FASE 5 — FRONTEND: TELA ADMIN

### 5.1 Página de Configurações — Seção Magis5

**Arquivo:** `apps/kaza-tem-web/src/pages/Admin/Configuracoes/index.tsx`

**Adicionar seção:**

```tsx
import { useState, useEffect } from 'react';
import { 
  Accordion, 
  AccordionSummary, 
  AccordionDetails, 
  TextField, 
  Button, 
  Chip, 
  Typography,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { ExpandMore, ContentCopy } from '@mui/icons-material';
import adminMarketplaceService from 'src/services/adminMarketplaceService';
import { useSnackbar } from 'src/contexts/snackbarContext';

export function ConfiguracoesPage() {
  const [config, setConfig] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [newCredentials, setNewCredentials] = useState(null);
  const { showMessage } = useSnackbar();

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await adminMarketplaceService.getConfig();
      setConfig(data);
      setWebhookUrl(data.webhookUrl || '');
    } catch (error) {
      showMessage('Erro ao carregar configurações', 'error');
    }
  }

  async function handleSaveWebhook() {
    try {
      await adminMarketplaceService.updateConfig({ webhookUrl });
      showMessage('Webhook atualizado com sucesso', 'success');
      loadConfig();
    } catch (error) {
      showMessage('Erro ao salvar webhook', 'error');
    }
  }

  async function handleTestWebhook() {
    try {
      const result = await adminMarketplaceService.testWebhook();
      if (result.success) {
        showMessage('Webhook testado com sucesso', 'success');
      } else {
        showMessage(`Erro no teste: ${result.message}`, 'error');
      }
    } catch (error) {
      showMessage('Erro ao testar webhook', 'error');
    }
  }

  function handleCopyApiKey() {
    if (config?.apiKey) {
      // Copiar API key completa (precisa buscar do backend)
      showMessage('API Key copiada (nota: apenas parcial visível)', 'info');
    }
  }

  async function handleRegenerateCredentials() {
    if (!confirm('ATENÇÃO: Isso irá gerar novas credenciais e invalidar as atuais. O Magis5 precisará ser atualizado. Continuar?')) {
      return;
    }

    try {
      const result = await adminMarketplaceService.regenerateCredentials();
      setNewCredentials(result);
      showMessage('Credenciais regeneradas', 'success');
    } catch (error) {
      showMessage('Erro ao regenerar credenciais', 'error');
    }
  }

  if (!config) return <div>Carregando...</div>;

  return (
    <div>
      {/* ... outras seções ... */}

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">Integração com Magis5 (ERP)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <div style={{ width: '100%' }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              O Magis5 utiliza estas credenciais para sincronizar produtos com o marketplace.
            </Alert>

            <div style={{ marginBottom: 16 }}>
              <Typography variant="subtitle2">API Key</Typography>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TextField
                  value={config.apiKey || 'Nenhuma chave gerada'}
                  disabled
                  fullWidth
                  size="small"
                />
                <IconButton onClick={handleCopyApiKey} disabled={!config.apiKey}>
                  <ContentCopy />
                </IconButton>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Typography variant="subtitle2">API Secret</Typography>
              <TextField
                value={config.hasSecret ? '●●●●●●●●●●●●●●●●' : 'Não configurado'}
                disabled
                fullWidth
                size="small"
              />
              <Typography variant="caption" color="text.secondary">
                O secret nunca é exibido após a criação. Guarde-o em local seguro.
              </Typography>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Typography variant="subtitle2">Status</Typography>
              <Chip
                label={config.lastUsedAt ? 'Conectado' : 'Nunca usado'}
                color={config.lastUsedAt ? 'success' : 'default'}
                size="small"
              />
              {config.lastUsedAt && (
                <Typography variant="caption" sx={{ ml: 1 }}>
                  Última sincronização: {new Date(config.lastUsedAt).toLocaleString()}
                </Typography>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <Typography variant="subtitle2">Total de Produtos</Typography>
              <Typography>{config.totalProducts}</Typography>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Typography variant="subtitle2">URL do Webhook (Magis5)</Typography>
              <TextField
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://magis5.com/webhooks/kazatem/orders"
                fullWidth
                size="small"
                helperText="O Magis5 receberá notificações de pedidos pagos nesta URL"
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="contained" onClick={handleSaveWebhook}>
                Salvar Configurações
              </Button>
              <Button variant="outlined" onClick={handleTestWebhook} disabled={!webhookUrl}>
                Testar Webhook
              </Button>
              <Button variant="outlined" color="error" onClick={handleRegenerateCredentials}>
                Regenerar Credenciais
              </Button>
            </div>
          </div>
        </AccordionDetails>
      </Accordion>

      {/* Dialog mostrando novas credenciais */}
      <Dialog open={!!newCredentials} onClose={() => setNewCredentials(null)} maxWidth="md">
        <DialogTitle>Novas Credenciais Geradas</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>ATENÇÃO:</strong> Salve estas credenciais agora. Elas não serão exibidas novamente.
          </Alert>
          
          <div style={{ marginBottom: 16 }}>
            <Typography variant="subtitle2">API Key</Typography>
            <TextField
              value={newCredentials?.apiKey || ''}
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Typography variant="subtitle2">API Secret</Typography>
            <TextField
              value={newCredentials?.apiSecret || ''}
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
            />
          </div>

          <Alert severity="info">
            Atualize estas credenciais no painel do Magis5 imediatamente.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewCredentials(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
```

### 5.2 Criar Service

**Arquivo:** `apps/kaza-tem-web/src/services/adminMarketplaceService.ts`

```typescript
import api from 'src/services/api';

async function getConfig() {
  const response = await api.get('/api/admin/marketplace/config');
  return response.data;
}

async function updateConfig(data: { webhookUrl: string }) {
  const response = await api.put('/api/admin/marketplace/config', data);
  return response.data;
}

async function testWebhook() {
  const response = await api.post('/api/admin/marketplace/test-webhook');
  return response.data;
}

async function regenerateCredentials() {
  const response = await api.post('/api/admin/marketplace/regenerate-credentials');
  return response.data;
}

const adminMarketplaceService = {
  getConfig,
  updateConfig,
  testWebhook,
  regenerateCredentials,
};

export default adminMarketplaceService;
```

---

## 🎯 FASE 6 — REMOVER INTEGRAÇÃO BLING

### 6.1 Arquivos/Pastas a DELETAR

```
❌ apps/kaza-tem-system/src/infrastructure/integrations/bling/
❌ apps/kaza-tem-system/src/contexts/*/application/use-cases/*sync*bling*/
❌ apps/kaza-tem-system/src/infrastructure/http/controllers/admin/bling.controller.ts
❌ apps/kaza-tem-system/src/infrastructure/cron/sync-bling-products.job.ts
```

### 6.2 Remover Variáveis de Ambiente

**Arquivo:** `apps/kaza-tem-system/.env.example`

```env
# DELETAR estas linhas:
# BLING_CLIENT_ID=
# BLING_CLIENT_SECRET=
# BLING_REDIRECT_URI=
# BLING_API_URL=
```

### 6.3 Atualizar ApproveWithdrawalUseCase

**Arquivo:** `apps/kaza-tem-system/src/contexts/withdrawal/application/use-cases/approve-withdrawal.use-case.ts`

**ANTES:**
```typescript
// Criar conta a pagar no Bling
const blingPayable = await this.blingPayablesClient.create({...});
withdrawal.approve(adminId, blingPayable.id);
```

**DEPOIS:**
```typescript
// Remover chamada ao Bling
withdrawal.approve(adminId);
// Admin fará transferência manual e depois marca como pago
```

### 6.4 Frontend — Remover Card Bling

**Arquivo:** `apps/kaza-tem-web/src/pages/Admin/Configuracoes/index.tsx`

Remover seção:
```tsx
// ❌ DELETAR
<Accordion>
  <AccordionSummary>Integração Bling</AccordionSummary>
  <AccordionDetails>
    {/* ... */}
  </AccordionDetails>
</Accordion>
```

### 6.5 Frontend — Atualizar Página Produtos

**Arquivo:** `apps/kaza-tem-web/src/pages/Admin/Produtos/index.tsx`

**ANTES:**
```tsx
<Button onClick={syncBling}>Sincronizar com Bling</Button>
```

**DEPOIS:**
```tsx
<Alert severity="info">
  Os produtos são sincronizados automaticamente pelo Magis5.
  Para adicionar/atualizar produtos, acesse o painel do Magis5.
</Alert>
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

Após implementar tudo, validar:

### Backend
- [ ] Migration cria tabela marketplace_api_keys
- [ ] Seed gera credenciais e exibe no console
- [ ] MarketplaceAuthGuard bloqueia requests sem credenciais
- [ ] MarketplaceAuthGuard aceita requests com credenciais válidas
- [ ] GET /api/v1/products retorna lista paginada
- [ ] GET /api/v1/products/:id retorna produto
- [ ] POST /api/v1/products cria produto (validar SKU único)
- [ ] PATCH /api/v1/products/:id atualiza produto
- [ ] DELETE /api/v1/products/:id desativa produto
- [ ] Webhook enviado ao pagar pedido (validar assinatura HMAC)
- [ ] GET /api/admin/marketplace/config retorna dados
- [ ] PUT /api/admin/marketplace/config atualiza webhook
- [ ] POST /api/admin/marketplace/test-webhook funciona
- [ ] POST /api/admin/marketplace/regenerate-credentials gera novas credenciais
- [ ] Código Bling removido completamente

### Frontend
- [ ] Seção Magis5 exibida em Configurações
- [ ] API Key exibida (parcialmente mascarada)
- [ ] Webhook URL editável e salva
- [ ] Botão "Testar Webhook" funciona
- [ ] Botão "Regenerar" exibe dialog com novas credenciais
- [ ] Dialog com credenciais permite copiar
- [ ] Card Bling removido
- [ ] Página Produtos não tem botão "Sync Bling"
- [ ] Alert informativo sobre Magis5 exibido

---

## 🚀 ORDEM DE EXECUÇÃO RECOMENDADA

1. **Rodar migration** → criar tabela
2. **Rodar seed** → gerar credenciais (SALVAR no .env local para testes)
3. **Implementar Guard** → testar autenticação com Postman
4. **Implementar endpoints** → testar com Postman (usar credenciais do seed)
5. **Implementar webhook** → testar emitindo evento de pedido pago
6. **Implementar admin endpoints** → testar no Postman
7. **Implementar frontend** → testar visualmente
8. **Remover Bling** → validar que nada quebrou
9. **Testar fluxo completo** → criar produto via API → ver no admin

---

## 📝 NOTAS IMPORTANTES

- **Segurança:** API Secret nunca é retornado após criação inicial
- **Rate Limit:** Adicionar @Throttle(100, 60) nos endpoints marketplace
- **Logs:** Logar todas operações via marketplace API
- **Imagens:** Validar URLs (HTTPS, domínios permitidos)
- **Transações:** Use unitOfWork.execute() em todos os use cases
- **Eventos:** Emitir eventos de domínio quando criar/atualizar produtos

---

**ESTE É O GUIA COMPLETO PARA IMPLEMENTAÇÃO.**  
**SIGA PASSO A PASSO E VALIDE CADA FASE ANTES DE PROSSEGUIR.**  
**O CLAUDE IRÁ REVISAR O CÓDIGO GERADO.**
