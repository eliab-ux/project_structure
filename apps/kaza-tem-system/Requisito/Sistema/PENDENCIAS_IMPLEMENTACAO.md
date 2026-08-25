# PENDÊNCIAS DE IMPLEMENTAÇÃO - KAZA TEM SYSTEM

**Data da Análise:** 03/02/2026
**Baseado em:** GUIA_IMPLEMENTACAO_KAZA_TEM.md
**Status Geral:** ~45% implementado

---

## 🔴 CRÍTICO - Funcionalidade "Esqueci Minha Senha"

A funcionalidade está **parcialmente implementada** e **não funciona completamente**.

### O que já existe:

| Componente | Arquivo | Status |
|------------|---------|--------|
| Endpoint `POST /auth/forgot-password` | `backend/src/infrastructure/http/controllers/auth/auth.controller.ts` | ✅ |
| `RequestPasswordResetUseCase` | `backend/src/contexts/auth/application/use-cases/request-password-reset/request-password-reset.use-case.ts` | ✅ |
| `SupabaseAuthService.resetPassword()` | `backend/src/infrastructure/security/supabase-auth.service.ts` | ✅ |
| Página `/auth/forgot-password` | `frontend/app/auth/forgot-password/page.tsx` | ✅ |
| Link "Esqueci minha senha" no login | `frontend/components/auth/LoginScreen.tsx:176` | ✅ |

### O que FALTA implementar:

#### 1. Página de Reset de Senha (Frontend)

**Arquivo a criar:** `frontend/app/auth/reset-password/page.tsx`

```typescript
// Estrutura esperada:
'use client';

import { ResetPasswordScreen } from '@/components/auth/ResetPasswordScreen';

export default function AuthResetPasswordPage() {
  return <ResetPasswordScreen />;
}
```

**Componente a criar:** `frontend/components/auth/ResetPasswordScreen.tsx`

Funcionalidades necessárias:
- [ ] Campo "Nova senha"
- [ ] Campo "Confirmar senha"
- [ ] Validação com yup (mínimo 8 caracteres, senhas iguais)
- [ ] Capturar token da URL (`?token=...` ou fragmento `#access_token=...`)
- [ ] Chamar API `POST /auth/reset-password`
- [ ] Feedback de sucesso/erro
- [ ] Redirecionamento para login após sucesso

#### 2. Endpoint de Reset de Senha (Backend)

**Arquivo a criar:** `backend/src/contexts/auth/application/use-cases/reset-password/reset-password.command.ts`

```typescript
export class ResetPasswordCommand {
  constructor(
    public readonly accessToken: string,
    public readonly newPassword: string,
  ) {}
}
```

**Arquivo a criar:** `backend/src/contexts/auth/application/use-cases/reset-password/reset-password.use-case.ts`

```typescript
@Injectable()
export class ResetPasswordUseCase implements UseCase<ResetPasswordCommand, void> {
  constructor(private readonly supabaseAuthService: SupabaseAuthService) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    await this.supabaseAuthService.updatePassword(command.accessToken, command.newPassword);
  }
}
```

**Adicionar ao SupabaseAuthService:**

```typescript
async updatePassword(accessToken: string, newPassword: string): Promise<void> {
  // Criar cliente com o token do usuário
  const { error } = await this.supabase.auth.updateUser(
    { password: newPassword },
    { accessToken }
  );

  if (error) {
    throw error;
  }
}
```

**Adicionar ao AuthController:**

```typescript
@Post('reset-password')
@HttpCode(HttpStatus.OK)
async resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<{ message: string }> {
  await this.resetPasswordUseCase.execute(
    new ResetPasswordCommand(dto.accessToken, dto.newPassword)
  );

  return { message: 'Senha alterada com sucesso.' };
}
```

**DTO a criar:** `backend/src/infrastructure/http/controllers/auth/dto/reset-password.request.dto.ts`

```typescript
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordRequestDto {
  @IsString()
  accessToken: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
```

#### 3. Configuração no Supabase Dashboard

1. Acessar: https://supabase.com/dashboard
2. Selecionar projeto `kaza-tem-production`
3. Ir em: **Authentication > URL Configuration**
4. Configurar:
   - **Site URL:** `http://localhost:3003` (dev) ou URL de produção
   - **Redirect URLs:** Adicionar `http://localhost:3003/auth/reset-password`

5. Ir em: **Authentication > Email Templates**
6. Customizar template "Reset Password" (opcional)

---

## 🟡 FRONTEND - Fase 2 Incompleta

### Páginas de Catálogo

#### Listagem de Produtos

**Arquivo a criar:** `frontend/app/products/page.tsx`

- [ ] Grid de produtos responsivo (4 colunas desktop, 2 mobile)
- [ ] FilterSidebar (desktop) / FilterDrawer (mobile)
- [ ] Breadcrumb
- [ ] Paginação
- [ ] Ordenação (relevância, preço, mais vendidos)
- [ ] Integração com `GET /api/products`

**Componentes necessários:**
- [ ] `frontend/components/FilterSidebar.tsx`
- [ ] `frontend/components/FilterDrawer.tsx`
- [ ] `frontend/components/Breadcrumb.tsx`
- [ ] `frontend/components/Pagination.tsx`
- [ ] `frontend/components/SortSelect.tsx`

#### Detalhes do Produto

**Arquivo a criar:** `frontend/app/products/[id]/page.tsx`

- [ ] ProductGallery (zoom, lightbox, thumbnails)
- [ ] PriceDisplay (preço atual, desconto, parcelamento)
- [ ] StockIndicator
- [ ] ShippingCalculator (CEP input + consulta frete)
- [ ] Botão "Adicionar ao Carrinho"
- [ ] Especificações do produto
- [ ] Produtos relacionados

**Componentes necessários:**
- [ ] `frontend/components/ProductGallery.tsx`
- [ ] `frontend/components/PriceDisplay.tsx`
- [ ] `frontend/components/ShippingCalculator.tsx`
- [ ] `frontend/components/QuantitySelector.tsx`
- [ ] `frontend/components/RelatedProducts.tsx`

### SearchBar Funcional

**Arquivo a modificar:** `frontend/components/SearchBar.tsx`

- [ ] Conectar com endpoint `GET /api/products?q=...`
- [ ] Autocomplete com sugestões
- [ ] Histórico de buscas (localStorage)
- [ ] Redirecionamento para `/products?q=termo`

### Serviço de Produtos (Frontend)

**Arquivo a criar:** `frontend/services/productService.ts`

```typescript
import api from './api';

export interface Product {
  id: string;
  name: string;
  price: number;
  // ...
}

async function getAll(params?: { q?: string; category?: string; limit?: number }) {
  return api.get<Product[]>('/products', { params });
}

async function getById(id: string) {
  return api.get<Product>(`/products/${id}`);
}

const productService = { getAll, getById };
export default productService;
```

**Arquivo a criar:** `frontend/services/api.ts`

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
});

// Interceptor para token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const auth = localStorage.getItem('kazaTemAuth');
    if (auth) {
      const { accessToken } = JSON.parse(auth);
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return config;
});

export default api;
```

---

## 🟡 BACKEND - Contextos Não Implementados

### Order Context (Fase 3)

**Estrutura a criar:**

```
src/contexts/order/
├── domain/
│   ├── entities/
│   │   ├── order.entity.ts
│   │   └── order-item.entity.ts
│   ├── value-objects/
│   │   ├── order-id.vo.ts
│   │   ├── order-status.vo.ts
│   │   └── shipping-address.vo.ts
│   ├── events/
│   │   ├── order-created.event.ts
│   │   ├── order-paid.event.ts
│   │   └── order-shipped.event.ts
│   └── exceptions/
│       ├── order-not-found.exception.ts
│       └── invalid-order-status.exception.ts
├── application/
│   ├── dto/
│   │   └── order.dto.ts
│   ├── ports/
│   │   └── output/
│   │       └── order-repository.port.ts
│   └── use-cases/
│       ├── create-order/
│       ├── get-order/
│       └── update-order-status/
└── order.module.ts
```

**ORM Entity:** `src/infrastructure/persistence/mikro-orm/entities/order-orm.entity.ts`

**Tabela SQL (Supabase):**

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  reseller_id UUID REFERENCES resellers(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  shipping_address JSONB,
  tracking_code VARCHAR(100),
  paid_at TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_reseller ON orders(reseller_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
```

### Commission Context (Fase 5)

**Estrutura a criar:**

```
src/contexts/commission/
├── domain/
│   ├── entities/
│   │   └── commission.entity.ts
│   ├── value-objects/
│   │   ├── commission-id.vo.ts
│   │   ├── commission-rate.vo.ts
│   │   └── commission-status.vo.ts
│   ├── events/
│   │   ├── commission-created.event.ts
│   │   └── commission-released.event.ts
│   └── exceptions/
├── application/
│   ├── dto/
│   ├── ports/
│   └── use-cases/
│       ├── calculate-commission/
│       └── release-commission/
└── commission.module.ts
```

**Tabela SQL:**

```sql
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES resellers(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  rate DECIMAL(5,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  available_at TIMESTAMP,
  released_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_commissions_reseller ON commissions(reseller_id);
CREATE INDEX idx_commissions_status ON commissions(status);
```

### Subscription Context (Fase 5)

```
src/contexts/subscription/
├── domain/
│   ├── entities/
│   │   └── subscription.entity.ts
│   ├── value-objects/
│   │   ├── subscription-id.vo.ts
│   │   └── subscription-status.vo.ts
│   └── events/
├── application/
└── subscription.module.ts
```

**Tabela SQL:**

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES resellers(id),
  plan VARCHAR(50) NOT NULL DEFAULT 'basic',
  price DECIMAL(10,2) NOT NULL DEFAULT 9.90,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  starts_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Withdrawal Context (Fase 6)

```
src/contexts/withdrawal/
├── domain/
│   ├── entities/
│   │   └── withdrawal.entity.ts
│   ├── value-objects/
│   └── events/
├── application/
└── withdrawal.module.ts
```

**Tabela SQL:**

```sql
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES resellers(id),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  pix_key VARCHAR(255),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_reseller ON withdrawals(reseller_id);
```

---

## 🟡 INTEGRAÇÕES EXTERNAS

### Bling (Parcialmente implementado)

**Arquivos existentes:**
- `backend/src/infrastructure/integrations/bling/bling.client.ts`
- `backend/src/infrastructure/integrations/bling/bling.module.ts`

**O que falta:**
- [ ] OAuth flow completo (callback, refresh token)
- [ ] Sincronização de produtos
- [ ] Sincronização de pedidos
- [ ] Webhook para atualizações de estoque

### Magis5 (Não implementado)

**Estrutura a criar:**

```
src/infrastructure/integrations/magis5/
├── magis5-client.port.ts
├── magis5.client.ts
└── magis5.module.ts
```

### Cielo (Não implementado)

**Estrutura a criar:**

```
src/infrastructure/integrations/cielo/
├── cielo-payment.port.ts
├── cielo.client.ts
└── cielo.module.ts
```

Funcionalidades:
- [ ] Pagamento com cartão de crédito
- [ ] Pagamento recorrente (assinaturas)
- [ ] Consulta de transações

### Melhor Envio (Não implementado)

**Estrutura a criar:**

```
src/infrastructure/integrations/melhor-envio/
├── melhor-envio.port.ts
├── melhor-envio.client.ts
└── melhor-envio.module.ts
```

Funcionalidades:
- [ ] Cotação de frete
- [ ] Geração de etiquetas
- [ ] Rastreamento

---

## 📊 RESUMO DE PROGRESSO

| Fase | Descrição | Status | % |
|------|-----------|--------|---|
| 0 | Setup inicial | ✅ Concluído | 90% |
| 1 | Backend - Product Context | ✅ Concluído | 85% |
| 2 | Frontend - Catálogo | ⚠️ Parcial | 50% |
| 3 | Sistema de Revendedores | ⚠️ Parcial | 70% |
| 4 | Dashboard do Revendedor | ⚠️ Básico | 30% |
| 5 | Sistema de Comissões | ❌ Não iniciado | 0% |
| 6 | Sistema de Saques | ❌ Não iniciado | 0% |
| 7 | Integração Bling Completa | ⚠️ Parcial | 20% |
| 8 | Funcionalidades Adicionais | ❌ Não iniciado | 0% |

---

## 🎯 PRIORIDADES SUGERIDAS

### Alta Prioridade (Bloqueia uso básico)

1. **Completar "Esqueci Minha Senha"** - Usuários não conseguem recuperar acesso
2. **Página de listagem de produtos** - Core do e-commerce
3. **Página de detalhes do produto** - Core do e-commerce

### Média Prioridade (Funcionalidades essenciais)

4. Order Context - Processar pedidos
5. Commission Context - Calcular comissões
6. Integração Cielo - Pagamentos

### Baixa Prioridade (Pode esperar MVP)

7. Subscription Context
8. Withdrawal Context
9. Integrações Bling/Magis5 completas
10. Marketing/Analytics Context

---

## 📁 ARQUIVOS A CRIAR (Resumo)

### Frontend (12 arquivos)
```
frontend/app/auth/reset-password/page.tsx
frontend/app/products/page.tsx
frontend/app/products/[id]/page.tsx
frontend/components/auth/ResetPasswordScreen.tsx
frontend/components/FilterSidebar.tsx
frontend/components/ProductGallery.tsx
frontend/components/ShippingCalculator.tsx
frontend/components/Pagination.tsx
frontend/components/Breadcrumb.tsx
frontend/components/PriceDisplay.tsx
frontend/services/api.ts
frontend/services/productService.ts
```

### Backend (15+ arquivos)
```
backend/src/contexts/auth/application/use-cases/reset-password/reset-password.command.ts
backend/src/contexts/auth/application/use-cases/reset-password/reset-password.use-case.ts
backend/src/infrastructure/http/controllers/auth/dto/reset-password.request.dto.ts
backend/src/contexts/order/**/*
backend/src/contexts/commission/**/*
backend/src/contexts/subscription/**/*
backend/src/contexts/withdrawal/**/*
backend/src/infrastructure/persistence/mikro-orm/entities/order-orm.entity.ts
backend/src/infrastructure/persistence/mikro-orm/entities/commission-orm.entity.ts
backend/src/infrastructure/integrations/cielo/**/*
backend/src/infrastructure/integrations/melhor-envio/**/*
```

---

**Última atualização:** 03/02/2026
