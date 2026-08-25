# INTEGRAÇÃO MAGIS5 — KAZA TEM IMPORTS
## Especificação Completa: API para Sincronização de Produtos

> **Objetivo:** Kaza Tem fornece API REST para Magis5 buscar produtos, preços, estoque e imagens  
> **Modelo:** Similar à integração Shopee-Magis5 (Kaza Tem = marketplace, Magis5 = ERP/gestor de imagens)  
> **Remoção:** Eliminar completamente toda integração com Bling do sistema  

---

## 📋 SUMÁRIO

1. [Visão Geral da Integração](#1-visão-geral)
2. [Autenticação e Credenciais](#2-autenticação)
3. [Endpoints da API Kaza Tem](#3-endpoints-api)
4. [Sincronização de Produtos](#4-sincronização)
5. [Webhook de Pedidos](#5-webhook-pedidos)
6. [Interface Admin](#6-interface-admin)
7. [Migração: Remover Bling](#7-remover-bling)
8. [Checklist de Implementação](#8-checklist)

---

# 1. VISÃO GERAL DA INTEGRAÇÃO

## Como funciona

```
┌─────────────┐                      ┌──────────────┐
│   MAGIS5    │                      │  KAZA TEM    │
│  (ERP/CMS)  │                      │ (Marketplace)│
└──────┬──────┘                      └──────┬───────┘
       │                                    │
       │ 1. Autenticação (API Key)         │
       │──────────────────────────────────>│
       │                                    │
       │ 2. GET /api/v1/products            │
       │──────────────────────────────────>│
       │                                    │
       │ 3. Response: Lista de produtos    │
       │<──────────────────────────────────│
       │                                    │
       │ 4. GET /api/v1/products/{id}/images│
       │──────────────────────────────────>│
       │                                    │
       │ 5. Response: URLs de imagens      │
       │<──────────────────────────────────│
       │                                    │
       │ 6. POST /api/v1/products (criar)  │
       │──────────────────────────────────>│
       │                                    │
       │ 7. PATCH /api/v1/products/{id}    │
       │   (atualizar preço/estoque)       │
       │──────────────────────────────────>│
```

## Diferenças vs. modelo anterior (Bling)

| Aspecto | Modelo Bling (ANTIGO) | Modelo Magis5 (NOVO) |
|---------|----------------------|---------------------|
| Direção | Kaza Tem → Bling | Magis5 → Kaza Tem |
| Autenticação | OAuth 2.0 | API Key |
| Quem sincroniza | Kaza Tem (pull) | Magis5 (push) |
| Criação de produtos | Não (só leitura) | Sim (Magis5 cria/atualiza) |
| Imagens | API separada | Incluídas na resposta |

---

# 2. AUTENTICAÇÃO E CREDENCIAIS

## 2.A API Key do Marketplace

O Kaza Tem gera uma API Key única para o Magis5 se conectar.

### Backend — Estrutura de API Keys

**Tabela no banco:**
```sql
CREATE TABLE marketplace_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,  -- "Magis5 ERP"
  api_key       VARCHAR(64) UNIQUE NOT NULL,  -- gerado: 64 chars alfanuméricos
  api_secret    VARCHAR(64) NOT NULL,  -- gerado: 64 chars alfanuméricos
  is_active     BOOLEAN DEFAULT true,
  permissions   JSONB DEFAULT '["products:read", "products:write", "orders:read"]',
  last_used_at  TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Índice
CREATE INDEX idx_api_keys_key ON marketplace_api_keys(api_key);
```

### Backend — Gerar API Key

**Use Case — GenerateApiKeyUseCase**
```typescript
// Executar APENAS UMA VEZ via script ou endpoint admin
// Gerar api_key: 64 caracteres random (A-Z, a-z, 0-9)
// Gerar api_secret: 64 caracteres random
// Salvar no banco com name='Magis5 ERP'
// Retornar ambos (só exibe UMA VEZ, depois não mostra mais o secret)

import { randomBytes } from 'crypto';

function generateApiKey(): string {
  return randomBytes(32).toString('hex');  // 64 chars
}

function generateApiSecret(): string {
  return randomBytes(32).toString('hex');  // 64 chars
}
```

### Backend — Middleware de Autenticação

```typescript
// MarketplaceAuthGuard
// Valida header: X-API-Key e X-API-Secret
// Aplica em todos os endpoints /api/v1/*

@Injectable()
export class MarketplaceAuthGuard implements CanActivate {
  constructor(
    @Inject(API_KEY_REPOSITORY) 
    private readonly apiKeyRepo: ApiKeyRepositoryPort
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const apiSecret = request.headers['x-api-secret'];

    if (!apiKey || !apiSecret) {
      throw new UnauthorizedException('API credentials required');
    }

    const credentials = await this.apiKeyRepo.findByKey(apiKey);
    
    if (!credentials) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!credentials.isActive) {
      throw new UnauthorizedException('API key disabled');
    }

    if (credentials.apiSecret !== apiSecret) {
      throw new UnauthorizedException('Invalid API secret');
    }

    // Atualizar last_used_at (async, não bloquear)
    this.apiKeyRepo.updateLastUsed(credentials.id).catch(() => {});

    // Adicionar credentials ao request para uso nos controllers
    request.marketplaceCredentials = credentials;

    return true;
  }
}
```

---

# 3. ENDPOINTS DA API KAZA TEM

## Base URL

```
Produção: https://api.kazatem.shop/v1
Sandbox:  https://sandbox-api.kazatem.shop/v1
```

## 3.A GET /api/v1/products — Listar Produtos

**Objetivo:** Magis5 busca todos os produtos ativos do marketplace.

### Request

```http
GET /api/v1/products?page=1&limit=100&updated_since=2025-01-01T00:00:00Z
Headers:
  X-API-Key: {api_key}
  X-API-Secret: {api_secret}
```

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 100, max: 100)
- `updated_since` (opcional): ISO 8601 datetime, retorna apenas produtos atualizados após esta data

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sku": "PROD-12345",
      "name": "Smart TV 55\" 4K",
      "description": "TV LED 4K HDR com Android TV",
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
          "url": "https://cdn.kazatem.shop/products/tv-55-front.jpg",
          "position": 0,
          "is_primary": true
        },
        {
          "url": "https://cdn.kazatem.shop/products/tv-55-side.jpg",
          "position": 1,
          "is_primary": false
        }
      ],
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-02-10T14:22:00Z"
    }
  ],
  "pagination": {
    "total": 523,
    "total_pages": 6,
    "current_page": 1,
    "per_page": 100
  }
}
```

### Backend — Implementação

```typescript
@Controller('api/v1/products')
@UseGuards(MarketplaceAuthGuard)
export class MarketplaceProductsController {
  constructor(
    private readonly listProductsUseCase: ListProductsForMarketplaceUseCase
  ) {}

  @Get()
  async list(@Query() query: ListProductsQueryDto) {
    const result = await this.listProductsUseCase.execute({
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

---

## 3.B GET /api/v1/products/:id — Detalhes de um Produto

```http
GET /api/v1/products/{product_id}
Headers:
  X-API-Key: {api_key}
  X-API-Secret: {api_secret}
```

### Response

```json
{
  "success": true,
  "data": {
    // mesma estrutura do item da lista acima
  }
}
```

---

## 3.C POST /api/v1/products — Criar Produto

**Objetivo:** Magis5 cria produtos no marketplace.

### Request

```http
POST /api/v1/products
Headers:
  X-API-Key: {api_key}
  X-API-Secret: {api_secret}
  Content-Type: application/json

Body:
{
  "sku": "PROD-NEW-001",
  "name": "Notebook Dell Inspiron 15",
  "description": "Intel i5, 8GB RAM, 256GB SSD",
  "price": 3299.90,
  "cost_price": 2500.00,
  "stock": 10,
  "category_name": "Informática",
  "weight": 2.3,
  "dimensions": {
    "width": 35,
    "height": 24,
    "length": 2
  },
  "is_active": true,
  "images": [
    {
      "url": "https://magis5.com/images/notebook-dell-front.jpg",
      "position": 0,
      "is_primary": true
    },
    {
      "url": "https://magis5.com/images/notebook-dell-side.jpg",
      "position": 1,
      "is_primary": false
    }
  ]
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid-gerado",
    "sku": "PROD-NEW-001",
    // ... resto dos campos
    "created_at": "2025-02-20T10:15:00Z"
  },
  "message": "Product created successfully"
}
```

### Backend — CreateProductFromMarketplaceUseCase

```typescript
// 1. Validar SKU único (não pode existir)
// 2. Validar obrigatoriedade: sku, name, price, stock
// 3. Criar Product domain entity
// 4. Criar ProductImages (cada URL fornecida)
// 5. Salvar no banco via unitOfWork
// 6. Retornar produto criado
```

---

## 3.D PATCH /api/v1/products/:id — Atualizar Produto

**Objetivo:** Magis5 atualiza preço, estoque ou imagens de produto existente.

### Request

```http
PATCH /api/v1/products/{product_id}
Headers:
  X-API-Key: {api_key}
  X-API-Secret: {api_secret}
  Content-Type: application/json

Body (campos opcionais):
{
  "price": 3499.90,
  "stock": 25,
  "is_active": false,
  "images": [
    // nova lista completa de imagens (substitui as anteriores)
  ]
}
```

### Response

```json
{
  "success": true,
  "data": {
    // produto atualizado completo
  },
  "message": "Product updated successfully"
}
```

### Backend — UpdateProductFromMarketplaceUseCase

```typescript
// 1. Buscar produto por id
// 2. Validar: produto existe
// 3. Atualizar campos fornecidos:
//    - price, cost_price, stock, is_active, name, description
// 4. Se images fornecido:
//    - DELETE FROM product_images WHERE product_id = X
//    - INSERT novas imagens
// 5. product.updated_at = NOW()
// 6. Salvar via unitOfWork
// 7. Retornar produto atualizado
```

---

## 3.E DELETE /api/v1/products/:id — Desativar Produto

**Objetivo:** Magis5 desativa produto (não deleta, apenas is_active = false).

### Request

```http
DELETE /api/v1/products/{product_id}
Headers:
  X-API-Key: {api_key}
  X-API-Secret: {api_secret}
```

### Response

```json
{
  "success": true,
  "message": "Product deactivated successfully"
}
```

### Backend

```typescript
// 1. Buscar produto
// 2. product.isActive = false
// 3. Salvar
// 4. Retornar sucesso
// IMPORTANTE: Produto não some do e-commerce imediatamente se houver pedidos em andamento
```

---

# 4. SINCRONIZAÇÃO DE PRODUTOS

## 4.A Fluxo Completo no Magis5

O Magis5 é quem decide quando sincronizar. Sugestões de gatilhos:

1. **Manual:** Admin do Magis5 clica "Sincronizar com Kaza Tem"
2. **Automático:** Cron job no Magis5 (ex: a cada hora)
3. **Por evento:** Ao alterar preço/estoque no Magis5 → PATCH imediato

## 4.B Estratégia de Sincronização

**Sync Inicial (primeira vez):**
```
Magis5:
1. GET /api/v1/products?page=1&limit=100
2. Para cada produto retornado:
   - Se SKU existe localmente no Magis5: atualizar dados locais
   - Se SKU não existe: criar no banco local do Magis5
3. Repetir para todas as páginas (pagination.total_pages)
```

**Sync Incremental (a partir da segunda vez):**
```
Magis5:
1. Buscar última sincronização (timestamp salvo localmente)
2. GET /api/v1/products?updated_since={last_sync_timestamp}
3. Processar apenas produtos que mudaram
4. Atualizar timestamp de última sync
```

## 4.C Criação de Produtos pelo Magis5

```
Magis5 (ERP):
1. Admin cadastra novo produto no Magis5
2. Admin clica "Publicar no Kaza Tem"
3. Magis5 → POST /api/v1/products com todos os dados
4. Kaza Tem cria o produto e retorna ID
5. Magis5 salva o marketplace_product_id localmente (mapear SKU ↔ ID Kaza Tem)
```

## 4.D Atualização de Preço/Estoque

```
Magis5 (ERP):
1. Admin altera preço de R$ 100 para R$ 120 no Magis5
2. Magis5 detecta mudança
3. Magis5 → PATCH /api/v1/products/{id} { "price": 120 }
4. Kaza Tem atualiza e responde sucesso
5. Produto no site Kaza Tem já exibe novo preço
```

---

# 5. WEBHOOK DE PEDIDOS

## 5.A Notificar Magis5 quando houver Pedido

Quando um pedido é pago no Kaza Tem, enviar webhook para o Magis5.

### Configuração no Admin

Adicionar campo na tabela `marketplace_api_keys`:
```sql
ALTER TABLE marketplace_api_keys
ADD COLUMN webhook_url VARCHAR(500);

-- Exemplo: https://magis5.com/webhooks/kazatem/orders
```

### Backend — Enviar Webhook ao Pagar Pedido

**Event Handler:**
```typescript
@OnEvent('order.paid')
export class SendOrderWebhookHandler {
  constructor(
    private readonly httpService: HttpService,
    @Inject(API_KEY_REPOSITORY) 
    private readonly apiKeyRepo: ApiKeyRepositoryPort,
  ) {}

  async handle(event: OrderPaidEvent) {
    const apiKey = await this.apiKeyRepo.findActive();  // única key ativa (Magis5)
    
    if (!apiKey || !apiKey.webhookUrl) {
      return;  // sem webhook configurado
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

    try {
      await this.httpService.post(apiKey.webhookUrl, payload, {
        headers: {
          'X-Webhook-Signature': this.generateSignature(payload, apiKey.apiSecret),
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }).toPromise();

      // Log sucesso
    } catch (error) {
      // Log erro mas NÃO bloqueia o fluxo do pedido
      console.error('Failed to send webhook to Magis5:', error.message);
    }
  }

  private generateSignature(payload: any, secret: string): string {
    const crypto = require('crypto');
    const data = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
}
```

### Magis5 — Endpoint Receptor do Webhook

```
POST https://magis5.com/webhooks/kazatem/orders
Body: (payload acima)
Headers:
  X-Webhook-Signature: {assinatura HMAC-SHA256}

Magis5 valida assinatura:
  - Gera HMAC do body com o api_secret
  - Compara com header recebido
  - Se bate: processa pedido
  - Responde 200 OK em < 3 segundos
```

---

# 6. INTERFACE ADMIN — CONFIGURAÇÕES

## 6.A Tela de Configurações Marketplace

**Página:** `/admin/configuracoes`

### Seção: Integração Magis5

```typescript
// Accordion "Integração com Magis5 (ERP)"

// Campos (exibição):
//   API Key: [XXXXXX...XXX] (parcialmente oculta) [Copiar]
//   API Secret: [●●●●●●●●] (nunca exibe) [Regenerar]
//   Status: Chip verde "Conectado" | Chip cinza "Nunca usado"
//   Última sincronização: [timestamp do last_used_at]
//   Total de produtos: [count de products]

// Campo editável:
//   URL do Webhook (Magis5): TextField
//     placeholder: "https://magis5.com/webhooks/kazatem/orders"
//     Hint: "Magis5 receberá notificações de pedidos pagos nesta URL"

// Botões:
//   "TESTAR WEBHOOK" → envia payload de teste para a URL configurada
//   "SALVAR CONFIGURAÇÕES"
//   "REGENERAR CREDENCIAIS" → Dialog de confirmação (ATENÇÃO: Magis5 para de funcionar até atualizar)
```

### Backend — Endpoints Admin

```typescript
GET  /api/admin/marketplace/config  [AdminGuard]
// Retorna: { apiKey (parcial), hasSecret: true, webhookUrl, lastUsedAt, totalProducts }

PUT  /api/admin/marketplace/config  [AdminGuard]
// Body: { webhookUrl }
// Atualiza webhook_url

POST /api/admin/marketplace/test-webhook  [AdminGuard]
// Envia payload de teste para o webhook configurado
// Responde sucesso/erro

POST /api/admin/marketplace/regenerate-credentials  [AdminGuard]
// Gera novos api_key e api_secret
// Retorna ambos (única vez que mostra o secret)
// IMPORTANTE: Avisar admin que Magis5 precisa atualizar
```

### Exibição Segura da API Key

```typescript
// Nunca exibir api_key completa, apenas:
function maskApiKey(key: string): string {
  if (key.length <= 12) return key;
  return key.substring(0, 6) + '...' + key.substring(key.length - 6);
}

// Exemplo: abc123...xyz789
```

---

# 7. MIGRAÇÃO: REMOVER INTEGRAÇÃO BLING

## 7.A Tabelas a Remover

```sql
-- Deletar tabela (se não houver dados históricos importantes)
DROP TABLE IF EXISTS bling_tokens;
```

## 7.B Código Backend a Remover

**Arquivos/pastas a deletar:**
```
backend/src/infrastructure/integrations/bling/
  ├── bling-oauth.client.ts          ❌ DELETAR
  ├── bling-products.client.ts       ❌ DELETAR
  ├── bling-orders.client.ts         ❌ DELETAR
  ├── bling-payables.client.ts       ❌ DELETAR
  └── bling.module.ts                ❌ DELETAR

backend/src/contexts/*/application/use-cases/
  └── sync-products-from-bling/      ❌ DELETAR

backend/src/infrastructure/cron/
  └── sync-bling-products.job.ts     ❌ DELETAR
```

**Controllers a limpar:**
```typescript
// backend/src/infrastructure/http/controllers/admin/bling.controller.ts
// ❌ DELETAR arquivo completo

// Remover rotas:
// GET  /api/admin/bling/auth
// GET  /api/admin/bling/callback
// POST /api/admin/products/sync  (não deletar, apenas modificar — ver abaixo)
```

## 7.C Variáveis de Ambiente a Remover

```env
# ❌ DELETAR do .env:
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=
BLING_API_URL=
```

## 7.D Modificar (não deletar)

**Produtos continuam existindo, mas agora são gerenciados pelo Magis5.**

Substituir:
```typescript
// ANTES (Bling sync):
POST /api/admin/products/sync
  → Dispara SyncProductsFromBlingUseCase
  → Busca produtos na API do Bling
  → Cria/atualiza no banco local

// DEPOIS (Magis5 push):
POST /api/admin/products/sync
  → Responde com mensagem:
    "Sincronização deve ser feita pelo Magis5. Acesse o painel do Magis5 e clique em 'Sincronizar com Kaza Tem'"
  → OU remove endpoint completamente (já que não faz mais sentido o admin clicar aqui)
```

## 7.E Saques — Substituir Bling por Transferência Manual

**ANTES:**
```
Admin aprova saque → cria conta a pagar no Bling → admin paga pela plataforma do Bling
```

**DEPOIS:**
```
Admin aprova saque → marca como aprovado → faz transferência bancária manual → marca como pago
```

**Atualizar ApproveWithdrawalUseCase:**
```typescript
// REMOVER chamada:
// BlingPayablesClient.create(...)

// MANTER apenas:
// withdrawal.approve(adminId)
// status='approved'
// Emitir WithdrawalApprovedEvent
// Email para revendedor: "Saque aprovado! Transferência em até 5 dias."

// Admin faz transferência manual fora do sistema
// Depois: POST /api/admin/withdrawals/:id/mark-paid (já existe)
```

## 7.F Frontend — Remover Menções ao Bling

**Admin — Configurações:**
```typescript
// /admin/configuracoes

// ANTES:
// Card "Bling ERP"
// Status: Conectado/Desconectado
// Botão "Reconectar"
// Botão "Sincronizar Agora"

// DEPOIS:
// ❌ REMOVER card do Bling completamente
// ✅ ADICIONAR card "Magis5 ERP" (conforme seção 6.A acima)
```

**Admin — Produtos:**
```typescript
// /admin/produtos

// ANTES:
// Botão "SINCRONIZAR COM BLING"

// DEPOIS:
// ❌ REMOVER botão
// ✅ ADICIONAR nota informativa:
//   Alert severity="info"
//   "Os produtos são sincronizados automaticamente pelo Magis5.
//    Para adicionar/atualizar produtos, acesse o painel do Magis5."
```

---

# 8. CHECKLIST DE IMPLEMENTAÇÃO

## Backend

```
AUTENTICAÇÃO
[ ] Criar tabela marketplace_api_keys
[ ] Implementar GenerateApiKeyUseCase
[ ] Implementar MarketplaceAuthGuard
[ ] Gerar credenciais iniciais para Magis5 (script de seed)

ENDPOINTS MARKETPLACE API
[ ] GET  /api/v1/products (listar)
[ ] GET  /api/v1/products/:id (detalhes)
[ ] POST /api/v1/products (criar)
[ ] PATCH /api/v1/products/:id (atualizar)
[ ] DELETE /api/v1/products/:id (desativar)
[ ] Todos os endpoints protegidos com MarketplaceAuthGuard
[ ] Validações de request (DTOs com class-validator)
[ ] Testes unitários dos use cases

WEBHOOK DE PEDIDOS
[ ] Campo webhook_url na tabela marketplace_api_keys
[ ] SendOrderWebhookHandler (@OnEvent order.paid)
[ ] Geração de assinatura HMAC-SHA256
[ ] Logs de webhooks (sucesso/erro)
[ ] Retry em caso de falha (3 tentativas)

ENDPOINTS ADMIN
[ ] GET  /api/admin/marketplace/config
[ ] PUT  /api/admin/marketplace/config (webhook_url)
[ ] POST /api/admin/marketplace/test-webhook
[ ] POST /api/admin/marketplace/regenerate-credentials

REMOVER BLING
[ ] Deletar pasta integrations/bling/
[ ] Deletar use cases de sync Bling
[ ] Deletar cron job sync Bling
[ ] Deletar bling.controller.ts
[ ] Remover variáveis BLING_* do .env
[ ] Atualizar ApproveWithdrawalUseCase (sem Bling)
[ ] Atualizar README.md (remover menção ao Bling)
```

## Frontend

```
ADMIN — CONFIGURAÇÕES
[ ] Seção "Integração com Magis5"
[ ] Exibir API Key (parcialmente mascarada)
[ ] Campo webhook_url editável
[ ] Botão "Copiar API Key"
[ ] Botão "Testar Webhook"
[ ] Botão "Regenerar Credenciais" com confirmação
[ ] Dialog mostrando novas credenciais (API Key + Secret) após regenerar
[ ] Status da integração (última sync, total produtos)

ADMIN — PRODUTOS
[ ] Remover botão "Sincronizar com Bling"
[ ] Adicionar Alert informativo sobre Magis5
[ ] Manter listagem/edição de produtos (agora gerenciados pelo Magis5)

ADMIN — SAQUES
[ ] Atualizar mensagem do botão "Aprovar"
[ ] Remover menção ao Bling
[ ] Texto: "Aprovar saque? Você deverá fazer a transferência manualmente."
```

## Documentação

```
[ ] Criar documento para Magis5: "Guia de Integração Kaza Tem"
    - Base URL da API
    - Como obter credenciais (API Key + Secret)
    - Endpoints disponíveis
    - Exemplos de request/response
    - Como configurar webhook
    - Validar assinatura do webhook
[ ] Atualizar README.md do projeto (remover Bling, adicionar Magis5)
[ ] Variáveis de ambiente necessárias (documentar API_BASE_URL)
```

---

# 9. EXEMPLO: GUIA PARA O MAGIS5

## Documento a fornecer para o time do Magis5

```markdown
# Integração Magis5 ↔ Kaza Tem Imports

## 1. Obter Credenciais

Entre em contato com o admin do Kaza Tem para receber:
- API Key (64 caracteres)
- API Secret (64 caracteres)

Guarde estas credenciais em local seguro. O API Secret só é exibido uma vez.

## 2. Endpoints Disponíveis

Base URL: https://api.kazatem.shop/v1

Todos os requests devem incluir headers:
```http
X-API-Key: {sua_api_key}
X-API-Secret: {seu_api_secret}
```

### Listar produtos
```http
GET /api/v1/products?page=1&limit=100
```

### Criar produto
```http
POST /api/v1/products
Content-Type: application/json

{
  "sku": "PROD-001",
  "name": "Nome do Produto",
  "price": 99.90,
  "stock": 10,
  "images": [
    { "url": "https://...", "position": 0, "is_primary": true }
  ]
}
```

### Atualizar produto
```http
PATCH /api/v1/products/{product_id}
Content-Type: application/json

{
  "price": 119.90,
  "stock": 15
}
```

## 3. Webhook de Pedidos

Configure a URL no painel do Kaza Tem (Admin → Configurações → Magis5).

Você receberá um POST nesta URL sempre que um pedido for pago:

```http
POST {sua_url_webhook}
Headers:
  X-Webhook-Signature: {assinatura_hmac_sha256}
Content-Type: application/json

Body:
{
  "event": "order.paid",
  "order_id": "uuid",
  "order_number": "KT-2025-00123",
  "items": [...],
  // ...
}
```

**Validar assinatura:**
```javascript
const crypto = require('crypto');
const receivedSignature = req.headers['x-webhook-signature'];
const calculatedSignature = crypto
  .createHmac('sha256', API_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (receivedSignature !== calculatedSignature) {
  // Assinatura inválida, rejeitar request
}
```

## 4. Sincronização Recomendada

**Inicial (primeira vez):**
1. GET /api/v1/products?page=1&limit=100
2. Processar todos os produtos
3. Repetir para todas as páginas

**Incremental (após a primeira):**
1. Guardar timestamp da última sync
2. GET /api/v1/products?updated_since={timestamp}
3. Processar apenas produtos que mudaram

**Tempo real:**
- Ao alterar preço/estoque no Magis5: PATCH imediato
```

---

# 10. SEGURANÇA E BOAS PRÁTICAS

## Rate Limiting

```typescript
// Aplicar ThrottlerGuard nos endpoints marketplace
@UseGuards(MarketplaceAuthGuard, ThrottlerGuard)
@Throttle(100, 60)  // 100 requests por minuto
export class MarketplaceProductsController {
  // ...
}
```

## Logs de Auditoria

```typescript
// Logar todas as operações via marketplace API
@Injectable()
export class MarketplaceAuditLogger {
  async log(operation: string, apiKeyId: string, details: any) {
    await this.auditRepo.create({
      source: 'marketplace_api',
      operation,  // 'products.list', 'products.create', etc.
      api_key_id: apiKeyId,
      details: JSON.stringify(details),
      timestamp: new Date(),
    });
  }
}
```

## Validação de Imagens

```typescript
// Ao receber URLs de imagens do Magis5, validar:
// - URL válida (regex)
// - Protocolo HTTPS
// - Domínio permitido (whitelist: magis5.com, cdn.magis5.com)

function validateImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    
    const allowedDomains = ['magis5.com', 'cdn.magis5.com'];
    const hostname = parsed.hostname.replace('www.', '');
    
    return allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}
```

---

**Documento criado para implementação da integração Magis5.**  
**Todas as referências ao Bling devem ser removidas do sistema.**  
**O Codex deve seguir este documento para desenvolver a funcionalidade completa.**
