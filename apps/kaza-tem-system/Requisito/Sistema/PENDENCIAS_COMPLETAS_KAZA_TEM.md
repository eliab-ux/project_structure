# PENDÊNCIAS COMPLETAS - KAZA TEM SYSTEM

**Data da Análise:** 03/02/2026
**Baseado em:** REQUISITOS_KAZA_TEM_SYSTEM.md
**Status Geral:** ~25% implementado

---

## 📁 DOCUMENTAÇÃO POR MÓDULOS

Para facilitar a implementação incremental, cada módulo tem seu próprio documento detalhado em:

**`docs/modulos/`**

| Arquivo | Módulo | Prioridade |
|---------|--------|------------|
| [01-ORDER-CONTEXT.md](docs/modulos/01-ORDER-CONTEXT.md) | Order Context | CRÍTICA |
| [02-INTEGRACAO-CIELO.md](docs/modulos/02-INTEGRACAO-CIELO.md) | Integração Cielo | CRÍTICA |
| [04-FRONTEND-CHECKOUT.md](docs/modulos/04-FRONTEND-CHECKOUT.md) | Carrinho/Checkout | CRÍTICA |
| [06-COMMISSION-CONTEXT.md](docs/modulos/06-COMMISSION-CONTEXT.md) | Commission Context | ALTA |

**Instrução para Codex:** Pegue um módulo por vez, começando pelo Order Context.

---

## 📊 RESUMO EXECUTIVO

| Módulo | Implementado | Pendente | Progresso |
|--------|:------------:|:--------:|:---------:|
| Product Context | 3/6 use cases | 3 use cases | 50% |
| Reseller Context | 4/8 use cases | 4 use cases | 50% |
| Order Context | 0/6 use cases | 6 use cases | 0% |
| Commission Context | 0/4 use cases | 4 use cases | 0% |
| Subscription Context | 0/5 use cases | 5 use cases | 0% |
| Withdrawal Context | 0/5 use cases | 5 use cases | 0% |
| Marketing Context | 0/5 use cases | 5 use cases | 0% |
| Analytics Context | 0/4 use cases | 4 use cases | 0% |
| Frontend E-commerce | 2/12 páginas | 10 páginas | 17% |
| Frontend Revendedor | 2/8 páginas | 6 páginas | 25% |
| Integrações | 1/4 | 3 integrações | 25% |

---

## 🔴 BACKEND - CONTEXTOS PENDENTES

### 1. ORDER CONTEXT (0% implementado)

**Entidades a criar:**
```
src/contexts/order/
├── domain/
│   ├── entities/
│   │   ├── order.entity.ts
│   │   └── order-item.entity.ts
│   ├── value-objects/
│   │   ├── order-id.vo.ts
│   │   ├── order-status.vo.ts
│   │   ├── tracking-code.vo.ts
│   │   └── shipping-address.vo.ts
│   ├── events/
│   │   ├── order-created.event.ts
│   │   ├── order-paid.event.ts
│   │   ├── order-shipped.event.ts
│   │   └── order-canceled.event.ts
│   └── exceptions/
│       ├── order-not-found.exception.ts
│       ├── invalid-order-status.exception.ts
│       └── insufficient-stock.exception.ts
├── application/
│   ├── dto/
│   │   ├── order.dto.ts
│   │   ├── order-item.dto.ts
│   │   └── create-order.dto.ts
│   ├── ports/output/
│   │   └── order-repository.port.ts
│   └── use-cases/
│       ├── create-order/
│       ├── process-payment/
│       ├── calculate-shipping/
│       ├── create-order-in-bling/
│       ├── handle-payment-webhook/
│       └── track-order-status/
└── order.module.ts
```

**Use Cases pendentes:**
- [ ] `CreateOrder` - Criar pedido a partir do carrinho
- [ ] `ProcessPayment` - Processar pagamento via Cielo
- [ ] `CalculateShipping` - Calcular frete via Melhor Envio
- [ ] `CreateOrderInBling` - Criar pedido no Bling após pagamento
- [ ] `HandlePaymentWebhook` - Receber webhook do Cielo
- [ ] `TrackOrderStatus` - Rastrear status do pedido

**Tabelas SQL (Supabase):**
```sql
-- orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  reseller_id UUID REFERENCES resellers(id),
  bling_order_id VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  shipping_method VARCHAR(100),
  shipping_address JSONB NOT NULL,
  billing_address JSONB,
  tracking_code VARCHAR(100),
  payment_id VARCHAR(100),
  payment_method VARCHAR(50),
  paid_at TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  canceled_at TIMESTAMP,
  cancel_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- order_items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_reseller ON orders(reseller_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_bling ON orders(bling_order_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
```

**Endpoints a criar:**
```
POST   /api/orders              # Criar pedido
GET    /api/orders              # Listar pedidos do usuário
GET    /api/orders/:id          # Detalhes do pedido
POST   /api/orders/:id/pay      # Processar pagamento
POST   /api/orders/webhook      # Webhook Cielo
GET    /api/orders/:id/track    # Rastrear pedido
PUT    /api/orders/:id/cancel   # Cancelar pedido
```

---

### 2. COMMISSION CONTEXT (0% implementado)

**Entidades a criar:**
```
src/contexts/commission/
├── domain/
│   ├── entities/
│   │   ├── commission.entity.ts
│   │   └── commission-rule.entity.ts
│   ├── value-objects/
│   │   ├── commission-id.vo.ts
│   │   ├── commission-status.vo.ts
│   │   └── percentage.vo.ts
│   ├── events/
│   │   ├── commission-calculated.event.ts
│   │   ├── commission-available.event.ts
│   │   └── commission-withdrawn.event.ts
│   └── exceptions/
│       └── commission-not-found.exception.ts
├── application/
│   ├── dto/
│   │   ├── commission.dto.ts
│   │   └── commission-balance.dto.ts
│   ├── ports/output/
│   │   └── commission-repository.port.ts
│   └── use-cases/
│       ├── calculate-commission-for-order/
│       ├── get-reseller-commission-balance/
│       ├── get-commission-history/
│       └── configure-commission-rules/
└── commission.module.ts
```

**Regras de negócio a implementar:**
```typescript
// Faixas de comissão progressivas (reset mensal)
const COMMISSION_TIERS = [
  { min: 0, max: 1000, percentage: 10 },
  { min: 1001, max: 5000, percentage: 15 },
  { min: 5001, max: 10000, percentage: 20 },
  { min: 10001, max: Infinity, percentage: 25 },
];

// Período de carência: 30 dias
// Após 30 dias: status muda de 'pending' para 'available'
// Somente 'available' pode ser sacado
```

**Use Cases pendentes:**
- [ ] `CalculateCommissionForOrder` - Calcular comissão quando pedido é pago
- [ ] `GetResellerCommissionBalance` - Obter saldo (pending + available)
- [ ] `GetCommissionHistory` - Histórico de comissões
- [ ] `ConfigureCommissionRules` - Admin configura faixas

**Tabelas SQL:**
```sql
-- commission_rules (configuração das faixas)
CREATE TABLE commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_amount DECIMAL(10,2) NOT NULL,
  max_amount DECIMAL(10,2),
  percentage DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- commissions
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES resellers(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  order_total DECIMAL(10,2) NOT NULL,
  commission_base DECIMAL(10,2) NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  available_at TIMESTAMP,
  withdrawn_at TIMESTAMP,
  withdrawal_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_commissions_reseller ON commissions(reseller_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_available ON commissions(available_at);

-- Inserir regras padrão
INSERT INTO commission_rules (min_amount, max_amount, percentage) VALUES
(0, 1000, 10),
(1000.01, 5000, 15),
(5000.01, 10000, 20),
(10000.01, NULL, 25);
```

**Endpoints:**
```
GET    /api/commissions/balance     # Saldo do revendedor
GET    /api/commissions/history     # Histórico
GET    /api/commissions/rules       # Regras (admin)
PUT    /api/commissions/rules       # Atualizar regras (admin)
```

**Cron Jobs:**
- [ ] `ReleaseCommissionsCron` - Diário, libera comissões com 30+ dias

---

### 3. SUBSCRIPTION CONTEXT (0% implementado)

**Entidades a criar:**
```
src/contexts/subscription/
├── domain/
│   ├── entities/
│   │   ├── subscription.entity.ts
│   │   └── payment.entity.ts
│   ├── value-objects/
│   │   ├── subscription-id.vo.ts
│   │   ├── subscription-status.vo.ts
│   │   └── amount.vo.ts
│   ├── events/
│   │   ├── subscription-created.event.ts
│   │   ├── payment-processed.event.ts
│   │   ├── payment-failed.event.ts
│   │   └── subscription-canceled.event.ts
│   └── exceptions/
├── application/
│   └── use-cases/
│       ├── create-subscription/
│       ├── process-recurring-payment/
│       ├── handle-payment-webhook/
│       ├── cancel-subscription/
│       └── reactivate-subscription/
└── subscription.module.ts
```

**Use Cases pendentes:**
- [ ] `CreateSubscription` - Criar assinatura via Cielo Recorrência
- [ ] `ProcessRecurringPayment` - Cron mensal para cobranças
- [ ] `HandlePaymentWebhook` - Webhook de pagamento Cielo
- [ ] `CancelSubscription` - Cancelar assinatura
- [ ] `ReactivateSubscription` - Reativar após cancelamento

**Tabelas SQL:**
```sql
-- subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES resellers(id),
  cielo_recurrence_id VARCHAR(100),
  plan VARCHAR(50) NOT NULL DEFAULT 'monthly',
  price DECIMAL(10,2) NOT NULL DEFAULT 9.90,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  canceled_at TIMESTAMP,
  cancel_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- subscription_payments
CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  cielo_payment_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  paid_at TIMESTAMP,
  failed_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_reseller ON subscriptions(reseller_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

**Endpoints:**
```
POST   /api/subscriptions           # Criar assinatura
GET    /api/subscriptions/me        # Minha assinatura
POST   /api/subscriptions/cancel    # Cancelar
POST   /api/subscriptions/webhook   # Webhook Cielo
GET    /api/subscriptions/payments  # Histórico de pagamentos
```

---

### 4. WITHDRAWAL CONTEXT (0% implementado)

**Entidades a criar:**
```
src/contexts/withdrawal/
├── domain/
│   ├── entities/
│   │   └── withdrawal.entity.ts
│   ├── value-objects/
│   │   ├── withdrawal-id.vo.ts
│   │   ├── withdrawal-status.vo.ts
│   │   └── bank-account.vo.ts
│   ├── events/
│   │   ├── withdrawal-requested.event.ts
│   │   ├── withdrawal-approved.event.ts
│   │   ├── withdrawal-rejected.event.ts
│   │   └── withdrawal-paid.event.ts
│   └── exceptions/
├── application/
│   └── use-cases/
│       ├── request-withdrawal/
│       ├── approve-withdrawal/
│       ├── reject-withdrawal/
│       ├── create-payable-in-bling/
│       └── get-withdrawal-history/
└── withdrawal.module.ts
```

**Use Cases pendentes:**
- [ ] `RequestWithdrawal` - Solicitar saque
- [ ] `ApproveWithdrawal` - Admin aprova
- [ ] `RejectWithdrawal` - Admin rejeita
- [ ] `CreatePayableInBling` - Criar conta a pagar no Bling
- [ ] `GetWithdrawalHistory` - Histórico de saques

**Regras de negócio:**
```
- Valor mínimo para saque: R$ 50,00 (configurável)
- Somente comissões com status 'available'
- Assinatura deve estar ativa
- Dados bancários devem estar cadastrados
- Aprovação manual pelo admin
```

**Tabelas SQL:**
```sql
-- withdrawals
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES resellers(id),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'requested',
  pix_key VARCHAR(255),
  pix_key_type VARCHAR(50),
  bank_code VARCHAR(10),
  bank_agency VARCHAR(10),
  bank_account VARCHAR(20),
  bank_account_type VARCHAR(20),
  bling_payable_id VARCHAR(50),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMP,
  reject_reason TEXT,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_reseller ON withdrawals(reseller_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
```

**Endpoints:**
```
POST   /api/withdrawals              # Solicitar saque
GET    /api/withdrawals              # Meus saques
GET    /api/withdrawals/pending      # Admin: saques pendentes
PUT    /api/withdrawals/:id/approve  # Admin: aprovar
PUT    /api/withdrawals/:id/reject   # Admin: rejeitar
```

---

### 5. MARKETING CONTEXT (0% implementado)

**Entidades a criar:**
```
src/contexts/marketing/
├── domain/
│   ├── entities/
│   │   ├── marketing-material.entity.ts
│   │   └── coupon.entity.ts
│   ├── value-objects/
│   │   ├── coupon-code.vo.ts
│   │   └── discount-percentage.vo.ts
├── application/
│   └── use-cases/
│       ├── upload-marketing-material/
│       ├── get-marketing-materials/
│       ├── create-coupon/
│       ├── validate-coupon/
│       └── track-coupon-usage/
└── marketing.module.ts
```

**Use Cases pendentes:**
- [ ] `UploadMarketingMaterial` - Admin faz upload de banners/posts
- [ ] `GetMarketingMaterials` - Listar materiais disponíveis
- [ ] `CreateCoupon` - Criar cupom de desconto
- [ ] `ValidateCoupon` - Validar cupom no checkout
- [ ] `TrackCouponUsage` - Rastrear uso de cupons

**Tabelas SQL:**
```sql
-- marketing_materials
CREATE TABLE marketing_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- coupons
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_value DECIMAL(10,2),
  max_uses INT,
  used_count INT DEFAULT 0,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- coupon_usage
CREATE TABLE coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  user_id UUID NOT NULL REFERENCES users(id),
  discount_applied DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 6. ANALYTICS CONTEXT (0% implementado)

**Entidades a criar:**
```
src/contexts/analytics/
├── domain/
│   ├── entities/
│   │   ├── visit.entity.ts
│   │   ├── lead.entity.ts
│   │   └── conversion.entity.ts
├── application/
│   └── use-cases/
│       ├── track-visit/
│       ├── track-lead/
│       ├── record-conversion/
│       └── get-reseller-analytics/
└── analytics.module.ts
```

**Use Cases pendentes:**
- [ ] `TrackVisit` - Registrar visita ao link do revendedor
- [ ] `TrackLead` - Registrar lead (add to cart)
- [ ] `RecordConversion` - Registrar conversão (compra)
- [ ] `GetResellerAnalytics` - Métricas para dashboard

**Tabelas SQL:**
```sql
-- visits
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES resellers(id),
  visitor_id VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer VARCHAR(500),
  page_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES resellers(id),
  visitor_id VARCHAR(100),
  product_id UUID REFERENCES products(id),
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- conversions
CREATE TABLE conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES resellers(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  visitor_id VARCHAR(100),
  order_value DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_visits_reseller ON visits(reseller_id);
CREATE INDEX idx_visits_date ON visits(created_at);
CREATE INDEX idx_leads_reseller ON leads(reseller_id);
CREATE INDEX idx_conversions_reseller ON conversions(reseller_id);
```

---

### 7. PRODUCT CONTEXT - Pendências (50% implementado)

**Use Cases faltantes:**
- [ ] `SyncProductImagesFromMagis5` - Buscar imagens do Magis5
- [ ] `GetProductsByCategory` - Listar por categoria
- [ ] `UpdateProductStock` - Webhook do Bling para atualizar estoque

**Melhorias necessárias:**
- [ ] Implementar sincronização automática (cron job)
- [ ] Webhook para receber atualizações do Bling
- [ ] Cache de produtos (Redis ou similar)

---

### 8. RESELLER CONTEXT - Pendências (50% implementado)

**Use Cases faltantes:**
- [ ] `GenerateUniqueLink` - Já existe, mas precisa integrar no registro
- [ ] `GetResellerByLink` - Buscar revendedor pelo link único
- [ ] `UpdateResellerLevel` - Atualizar nível (cron mensal)
- [ ] `AllowCustomPricing` - Admin habilita preços customizados

**Melhorias necessárias:**
- [ ] Cron job para atualizar níveis baseado em faturamento anual
- [ ] Validação de CPF via API externa
- [ ] Envio de email de boas-vindas após aprovação

---

## 🟢 FRONTEND - BUGS CORRIGIDOS

### 1. Redirecionamento após Login
- **Status:** ✅ CORRIGIDO (03/02/2026)
- **Arquivo:** `frontend/components/auth/LoginScreen.tsx`
- **Solução:** Adicionado `useRouter` e `setTimeout` para redirecionar para `/reseller/dashboard` após 1.5s

---

## 🔴 FRONTEND - PÁGINAS PENDENTES

### E-commerce (Cliente Final)

| Página | Rota | Status | Componentes Necessários |
|--------|------|--------|------------------------|
| Listagem de Produtos | `/products` | ❌ | ProductGrid, FilterSidebar, Pagination, Breadcrumb |
| Detalhes do Produto | `/products/[id]` | ❌ | ProductGallery, PriceDisplay, ShippingCalculator, RelatedProducts |
| Carrinho | `/cart` | ❌ | CartItems, CartSummary, CouponInput |
| Checkout - Endereço | `/checkout/address` | ❌ | AddressForm, AddressList |
| Checkout - Pagamento | `/checkout/payment` | ❌ | PaymentForm, CardForm |
| Checkout - Revisão | `/checkout/review` | ❌ | OrderSummary, ConfirmButton |
| Confirmação | `/checkout/success` | ❌ | OrderConfirmation |
| Meus Pedidos | `/orders` | ❌ | OrderList, OrderCard |
| Detalhes do Pedido | `/orders/[id]` | ❌ | OrderDetails, TrackingInfo |
| Landing Revendedor | `/r/[link]` | ❌ | Homepage com tracking |

### Dashboard Revendedor

| Página | Rota | Status | Componentes Necessários |
|--------|------|--------|------------------------|
| Dashboard Home | `/reseller/dashboard` | ⚠️ Básico | MetricsCards, SalesChart, RecentSales |
| Minhas Vendas | `/reseller/sales` | ❌ | SalesTable, SalesFilters, ExportButton |
| Comissões | `/reseller/commissions` | ❌ | CommissionBalance, CommissionHistory |
| Saques | `/reseller/withdrawals` | ❌ | WithdrawalForm, WithdrawalHistory, BankAccountForm |
| Materiais | `/reseller/materials` | ❌ | MaterialGrid, MaterialCard, DownloadButton |
| Meu Link | `/reseller/link` | ❌ | AffiliateLinkDisplay, QRCodeGenerator, ShareButtons |
| Configurações | `/reseller/settings` | ❌ | ProfileForm, NotificationSettings |
| Assinatura | `/reseller/subscription` | ❌ | SubscriptionStatus, PaymentHistory, CancelButton |

### Área Administrativa

| Página | Rota | Status |
|--------|------|--------|
| Dashboard Admin | `/admin/dashboard` | ❌ |
| Revendedores Pendentes | `/admin/resellers/pending` | ❌ |
| Saques Pendentes | `/admin/withdrawals/pending` | ❌ |
| Configurar Comissões | `/admin/commissions/rules` | ❌ |
| Upload Materiais | `/admin/materials/upload` | ❌ |
| Gerenciar Cupons | `/admin/coupons` | ❌ |

---

## 🔴 COMPONENTES PENDENTES

### Componentes Globais
- [ ] `CartDrawer` - Drawer lateral do carrinho
- [ ] `CartIcon` - Ícone com badge de quantidade
- [ ] `UserMenu` - Dropdown do usuário logado
- [ ] `MobileMenu` - Menu hambúrguer mobile
- [ ] `Breadcrumb` - Navegação por breadcrumb
- [ ] `Pagination` - Paginação estilo ML
- [ ] `EmptyState` - Estado vazio genérico
- [ ] `LoadingSkeleton` - Skeleton loading

### Componentes de Produto
- [ ] `ProductGrid` - Grid responsivo de produtos
- [ ] `ProductGallery` - Galeria com zoom e lightbox
- [ ] `PriceDisplay` - Preço com desconto e parcelamento
- [ ] `StockIndicator` - Indicador de disponibilidade
- [ ] `RelatedProducts` - Produtos relacionados
- [ ] `ProductFilters` - Filtros (preço, categoria, marca)
- [ ] `FilterSidebar` - Sidebar de filtros (desktop)
- [ ] `FilterDrawer` - Drawer de filtros (mobile)

### Componentes de Checkout
- [ ] `CartItems` - Lista de itens do carrinho
- [ ] `CartSummary` - Resumo do pedido
- [ ] `CouponInput` - Input de cupom de desconto
- [ ] `ShippingCalculator` - Calculadora de frete
- [ ] `ShippingOptions` - Lista de opções de frete
- [ ] `AddressForm` - Formulário de endereço
- [ ] `AddressList` - Lista de endereços salvos
- [ ] `PaymentForm` - Formulário de pagamento
- [ ] `CardForm` - Formulário de cartão (Cielo)
- [ ] `CheckoutStepper` - Stepper do checkout
- [ ] `OrderSummary` - Resumo final do pedido

### Componentes do Revendedor
- [ ] `SalesChart` - Gráfico de vendas
- [ ] `SalesTable` - Tabela de vendas
- [ ] `CommissionBalance` - Saldo de comissões
- [ ] `CommissionHistory` - Histórico de comissões
- [ ] `WithdrawalForm` - Formulário de saque
- [ ] `WithdrawalHistory` - Histórico de saques
- [ ] `BankAccountForm` - Formulário de dados bancários
- [ ] `AffiliateLinkDisplay` - Exibição do link
- [ ] `QRCodeGenerator` - Gerador de QR Code
- [ ] `ShareButtons` - Botões de compartilhamento
- [ ] `MaterialGrid` - Grid de materiais
- [ ] `MaterialCard` - Card de material para download
- [ ] `SubscriptionStatus` - Status da assinatura

---

## 🔴 INTEGRAÇÕES PENDENTES

### 1. BLING - Completar (20% implementado)

**O que existe:**
- [x] Cliente básico (`bling.client.ts`)
- [x] Módulo (`bling.module.ts`)

**O que falta:**
- [ ] OAuth flow completo (redirect, callback, refresh token)
- [ ] Sincronização de produtos (GET /produtos)
- [ ] Criar pedido no Bling (POST /pedidos/vendas)
- [ ] Criar conta a pagar (POST /contas/pagar)
- [ ] Webhook handler (estoque, pedidos)
- [ ] Cron job para sincronização automática

**Arquivos a criar/modificar:**
```
src/infrastructure/integrations/bling/
├── bling-client.port.ts      ✅ Existe
├── bling.client.ts           ⚠️ Completar
├── bling.module.ts           ✅ Existe
├── bling-oauth.service.ts    ❌ Criar
├── bling-product.service.ts  ❌ Criar
├── bling-order.service.ts    ❌ Criar
├── bling-payable.service.ts  ❌ Criar
└── bling-webhook.controller.ts ❌ Criar
```

### 2. MAGIS5 (0% implementado)

**Arquivos a criar:**
```
src/infrastructure/integrations/magis5/
├── magis5-client.port.ts
├── magis5.client.ts
└── magis5.module.ts
```

**Funcionalidades:**
- [ ] Buscar imagens por SKU
- [ ] Sincronização com produtos do Bling

### 3. CIELO (0% implementado)

**Arquivos a criar:**
```
src/infrastructure/integrations/cielo/
├── cielo-client.port.ts
├── cielo.client.ts
├── cielo-checkout.service.ts
├── cielo-recurrence.service.ts
├── cielo-webhook.controller.ts
└── cielo.module.ts
```

**Funcionalidades:**
- [ ] Checkout (pagamento de produtos)
- [ ] Recorrência (assinaturas mensais)
- [ ] Consulta de transações
- [ ] Cancelamento/estorno
- [ ] Webhook handler

### 4. MELHOR ENVIO (0% implementado)

**Arquivos a criar:**
```
src/infrastructure/integrations/melhor-envio/
├── melhor-envio-client.port.ts
├── melhor-envio.client.ts
├── shipping-calculator.service.ts
└── melhor-envio.module.ts
```

**Funcionalidades:**
- [ ] Cotação de frete por CEP
- [ ] Geração de etiquetas
- [ ] Rastreamento de envios

---

## 🔴 SERVIÇOS E CONTEXTOS FRONTEND

### Services a criar
```
frontend/services/
├── api.ts              ❌ Configuração axios
├── productService.ts   ❌ CRUD produtos
├── orderService.ts     ❌ CRUD pedidos
├── cartService.ts      ❌ Carrinho (localStorage + API)
├── shippingService.ts  ❌ Cálculo de frete
├── paymentService.ts   ❌ Pagamentos Cielo
├── commissionService.ts ❌ Comissões
├── withdrawalService.ts ❌ Saques
├── analyticsService.ts  ❌ Tracking
└── materialService.ts   ❌ Materiais marketing
```

### Contexts a criar
```
frontend/contexts/
├── AuthContext.tsx      ⚠️ Parcial
├── CartContext.tsx      ❌ Criar
├── CheckoutContext.tsx  ❌ Criar
├── ResellerContext.tsx  ❌ Criar
└── TrackingContext.tsx  ❌ Criar (captura ref do revendedor)
```

### Hooks a criar
```
frontend/hooks/
├── useAuth.ts          ⚠️ Parcial
├── useCart.ts          ❌ Criar
├── useCheckout.ts      ❌ Criar
├── useProducts.ts      ❌ Criar
├── useReseller.ts      ❌ Criar
├── useCommissions.ts   ❌ Criar
├── useWithdrawals.ts   ❌ Criar
└── useTracking.ts      ❌ Criar
```

---

## 📅 ORDEM DE IMPLEMENTAÇÃO SUGERIDA

### Fase 1: Core do E-commerce (Prioridade ALTA)
1. Order Context (backend)
2. Integração Cielo Checkout
3. Carrinho (frontend)
4. Checkout completo (frontend)
5. Integração Melhor Envio

### Fase 2: Sistema de Comissões (Prioridade ALTA)
1. Analytics Context (tracking de links)
2. Commission Context (cálculo)
3. Landing page `/r/[link]`
4. Dashboard métricas reais

### Fase 3: Assinaturas e Saques (Prioridade MÉDIA)
1. Subscription Context
2. Integração Cielo Recorrência
3. Withdrawal Context
4. Integração Bling (contas a pagar)

### Fase 4: Complementos (Prioridade BAIXA)
1. Marketing Context
2. Área administrativa
3. Integração Magis5
4. Sincronização completa Bling

---

## 📊 ESTIMATIVA DE ESFORÇO

| Módulo | Complexidade | Dependências |
|--------|:------------:|--------------|
| Order Context | Alta | Cielo, Melhor Envio |
| Commission Context | Média | Order, Analytics |
| Subscription Context | Média | Cielo Recorrência |
| Withdrawal Context | Média | Commission, Bling |
| Analytics Context | Baixa | - |
| Marketing Context | Baixa | - |
| Integração Cielo | Alta | - |
| Integração Melhor Envio | Média | - |
| Integração Bling (completa) | Alta | - |
| Frontend E-commerce | Alta | Backend pronto |
| Frontend Revendedor | Média | Backend pronto |

---

**Última atualização:** 03/02/2026
