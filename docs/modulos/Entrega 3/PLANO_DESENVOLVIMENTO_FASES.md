# PLANO DE DESENVOLVIMENTO — KAZA TEM IMPORTS
## Guia para IA Codex: O que construir e como construir

---

> **ANTES DE COMEÇAR: Leia obrigatoriamente o arquivo `CLAUDE.md` na raiz do projeto.**
> Ele define os padrões de código, arquitetura e regras que devem ser seguidos em TUDO.
>
> **Stack:** NestJS + Fastify + MikroORM + PostgreSQL · Next.js 14 App Router + MUI + TypeScript strict  
> **Arquitetura:** Hexagonal (Ports & Adapters) — domínio puro, sem framework no domínio  
> **Regras inegociáveis:**
> - Domain entity nunca tem decorator de framework
> - Controller tem exatamente 1 try-catch por método
> - DI usa Symbols (nunca strings)
> - Unit of Work para transações (nunca EntityManager direto no use case)
> - Frontend: sem `export default` em componentes, sem inline styles, sem `any`

---

## COMO O SISTEMA FUNCIONA (leia antes de codar)

### Link do Revendedor
O link `kazatem.shop/r/PAULO_ABC123` **não é um clone do site**. É rastreamento por cookie:
```
1. Cliente acessa: /r/PAULO_ABC123
2. Backend salva cookie httpOnly: reseller_code=PAULO_ABC123 (30 dias)
3. Redireciona para a HOME normal
4. Cliente compra normalmente
5. No checkout, backend lê o cookie → vincula o pedido ao Paulo
6. Comissão calculada e criada automaticamente
```

### Regras de Comissão
```
Vendas no mês:  R$ 0–1.000      → 10%
                R$ 1.001–2.000  → 15%
                R$ 2.001–5.000  → 20%
                > R$ 5.001      → 30%

Base = subtotal do pedido (nunca inclui frete ou desconto de cupom)
Carência = 30 dias (status PENDING → AVAILABLE)
Mínimo para saque = R$ 50,00
Revendedor não recebe comissão da própria compra
```

---

# FASE 1 — BANCO DE DADOS E AUTENTICAÇÃO

## 1.A Schema do Banco de Dados

Criar uma única migration com todas as tabelas abaixo. Rodar via MikroORM.

```sql
-- USERS (todos os papéis compartilham)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'customer',
  -- role: 'customer' | 'reseller' | 'admin'
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- RESELLERS
CREATE TABLE resellers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id),
  full_name         VARCHAR(255) NOT NULL,
  cpf               VARCHAR(14) NOT NULL UNIQUE,
  phone             VARCHAR(20),
  reseller_code     VARCHAR(60) UNIQUE,       -- ex: PAULO_XY1234AB
  level             VARCHAR(20) DEFAULT 'bronze', -- bronze|silver|gold
  status            VARCHAR(20) DEFAULT 'pending',
  -- pending|approved|active|suspended|canceled

  approved_at       TIMESTAMP,
  approved_by       UUID REFERENCES users(id),
  rejected_at       TIMESTAMP,
  rejected_reason   TEXT,

  -- Dados bancários para saque
  bank_name         VARCHAR(100),
  bank_code         VARCHAR(10),
  bank_agency       VARCHAR(20),
  bank_account      VARCHAR(30),
  bank_account_type VARCHAR(20), -- 'checking'|'savings'
  bank_holder_name  VARCHAR(255),
  bank_holder_cpf   VARCHAR(14),

  total_sold_year   DECIMAL(12,2) DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_resellers_code   ON resellers(reseller_code);
CREATE INDEX idx_resellers_status ON resellers(status);

-- SUBSCRIPTIONS
CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id         UUID NOT NULL UNIQUE REFERENCES resellers(id),
  cielo_recurrence_id VARCHAR(100),
  status              VARCHAR(20) NOT NULL DEFAULT 'active',
  -- active|suspended|canceled
  amount              DECIMAL(10,2) NOT NULL DEFAULT 9.90,
  next_billing_date   DATE,
  started_at          TIMESTAMP DEFAULT NOW(),
  canceled_at         TIMESTAMP,
  last_payment_at     TIMESTAMP,
  last_payment_status VARCHAR(20),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bling_id       VARCHAR(50) UNIQUE NOT NULL,
  sku            VARCHAR(100) UNIQUE NOT NULL,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  price          DECIMAL(10,2) NOT NULL,
  cost_price     DECIMAL(10,2),
  stock          INT NOT NULL DEFAULT 0,
  category_name  VARCHAR(100),
  weight         DECIMAL(8,3),  -- kg
  width          DECIMAL(8,2),  -- cm
  height         DECIMAL(8,2),  -- cm
  length         DECIMAL(8,2),  -- cm
  is_active      BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_sku    ON products(sku);

-- PRODUCT IMAGES
CREATE TABLE product_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  position   INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

-- VISITS (rastreamento de links)
CREATE TABLE visits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_code VARCHAR(60) NOT NULL,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  referer       VARCHAR(500),
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_visits_reseller  ON visits(reseller_code);
CREATE INDEX idx_visits_created   ON visits(created_at);

-- ORDERS
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     VARCHAR(50) UNIQUE NOT NULL,
  reseller_id      UUID REFERENCES resellers(id),
  reseller_code    VARCHAR(60),

  customer_name    VARCHAR(255) NOT NULL,
  customer_email   VARCHAR(255) NOT NULL,
  customer_cpf     VARCHAR(14) NOT NULL,
  customer_phone   VARCHAR(20),

  address_zip_code     VARCHAR(9),
  address_street       VARCHAR(255),
  address_number       VARCHAR(20),
  address_complement   VARCHAR(100),
  address_neighborhood VARCHAR(100),
  address_city         VARCHAR(100),
  address_state        VARCHAR(2),

  subtotal         DECIMAL(10,2) NOT NULL,
  discount_amount  DECIMAL(10,2) DEFAULT 0,
  shipping_cost    DECIMAL(10,2) DEFAULT 0,
  total_amount     DECIMAL(10,2) NOT NULL,

  shipping_carrier VARCHAR(100),
  shipping_service VARCHAR(100),
  tracking_code    VARCHAR(100),
  estimated_days   INT,

  payment_method   VARCHAR(20) DEFAULT 'credit_card',
  installments     INT DEFAULT 1,
  cielo_payment_id VARCHAR(100),
  bling_order_id   VARCHAR(50),

  status           VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
  -- pending_payment|paid|processing|shipped|delivered|canceled

  coupon_code  VARCHAR(50),
  paid_at      TIMESTAMP,
  shipped_at   TIMESTAMP,
  delivered_at TIMESTAMP,
  canceled_at  TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_reseller ON orders(reseller_id);
CREATE INDEX idx_orders_status   ON orders(status);

-- ORDER ITEMS
CREATE TABLE order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  product_sku  VARCHAR(100) NOT NULL,
  quantity     INT NOT NULL,
  unit_price   DECIMAL(10,2) NOT NULL,
  total_price  DECIMAL(10,2) NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- COMMISSIONS
CREATE TABLE commissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id  UUID NOT NULL REFERENCES resellers(id),
  order_id     UUID NOT NULL UNIQUE REFERENCES orders(id),
  amount       DECIMAL(10,2) NOT NULL,
  base_amount  DECIMAL(10,2) NOT NULL,
  percentage   DECIMAL(5,2) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending|available|withdrawn|reversed
  available_at DATE NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_commissions_reseller     ON commissions(reseller_id);
CREATE INDEX idx_commissions_status       ON commissions(status);
CREATE INDEX idx_commissions_available_at ON commissions(available_at);

-- WITHDRAWALS
CREATE TABLE withdrawals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id      UUID NOT NULL REFERENCES resellers(id),
  amount           DECIMAL(10,2) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'requested',
  -- requested|approved|paid|rejected
  bling_payable_id VARCHAR(50),
  approved_at      TIMESTAMP,
  approved_by      UUID REFERENCES users(id),
  paid_at          TIMESTAMP,
  rejected_at      TIMESTAMP,
  rejected_reason  TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_reseller ON withdrawals(reseller_id);
CREATE INDEX idx_withdrawals_status   ON withdrawals(status);

-- WITHDRAWAL_COMMISSIONS (quais comissões foram incluídas no saque)
CREATE TABLE withdrawal_commissions (
  withdrawal_id UUID NOT NULL REFERENCES withdrawals(id),
  commission_id UUID NOT NULL REFERENCES commissions(id),
  PRIMARY KEY (withdrawal_id, commission_id)
);

-- COUPONS
CREATE TABLE coupons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) UNIQUE NOT NULL,
  reseller_id    UUID REFERENCES resellers(id), -- NULL = criado pelo admin
  discount_type  VARCHAR(20) NOT NULL, -- 'percentage'|'fixed'
  discount_value DECIMAL(10,2) NOT NULL,
  valid_from     TIMESTAMP NOT NULL DEFAULT NOW(),
  valid_until    TIMESTAMP NOT NULL,
  usage_limit    INT,        -- NULL = ilimitado
  usage_count    INT DEFAULT 0,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_coupons_code     ON coupons(code);
CREATE INDEX idx_coupons_reseller ON coupons(reseller_id);

-- MATERIALS (materiais de marketing)
CREATE TABLE materials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  type          VARCHAR(20) NOT NULL,
  -- 'image'|'banner'|'catalog'|'video'|'copy'
  file_url      TEXT NOT NULL,
  thumbnail_url TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- BLING_TOKENS (OAuth)
CREATE TABLE bling_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TIMESTAMP NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- SYSTEM_CONFIG (configurações mutáveis)
CREATE TABLE system_config (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO system_config VALUES
  ('commission_tier_1', '{"minAmount":0,"maxAmount":1000,"percentage":10}'),
  ('commission_tier_2', '{"minAmount":1001,"maxAmount":2000,"percentage":15}'),
  ('commission_tier_3', '{"minAmount":2001,"maxAmount":5000,"percentage":20}'),
  ('commission_tier_4', '{"minAmount":5001,"maxAmount":null,"percentage":30}'),
  ('commission_grace_days', '30'),
  ('withdrawal_minimum_amount', '50.00'),
  ('subscription_price', '9.90'),
  ('subscription_grace_days', '7');

-- EMAIL_LOGS
CREATE TABLE email_logs (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email  VARCHAR(255) NOT NULL,
  template  VARCHAR(100) NOT NULL,
  subject   VARCHAR(255) NOT NULL,
  status    VARCHAR(20) DEFAULT 'sent',
  error     TEXT,
  sent_at   TIMESTAMP DEFAULT NOW()
);
```

---

## 1.B Backend — Autenticação JWT

### Bounded context: `auth`
```
backend/src/contexts/auth/
├── domain/
│   ├── value-objects/
│   │   └── password.vo.ts
│   └── exceptions/
│       └── invalid-credentials.exception.ts
├── application/
│   ├── use-cases/
│   │   ├── login/
│   │   │   ├── login.command.ts
│   │   │   └── login.use-case.ts
│   │   ├── register-customer/
│   │   │   ├── register-customer.command.ts
│   │   │   └── register-customer.use-case.ts
│   │   ├── forgot-password/
│   │   │   ├── forgot-password.command.ts
│   │   │   └── forgot-password.use-case.ts
│   │   └── reset-password/
│   │       ├── reset-password.command.ts
│   │       └── reset-password.use-case.ts
│   └── dto/
│       └── auth-token.dto.ts
└── auth.module.ts

backend/src/infrastructure/http/
├── controllers/
│   └── auth/
│       └── auth.controller.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   ├── admin.guard.ts
│   └── reseller.guard.ts
├── strategies/
│   └── jwt.strategy.ts
└── decorators/
    └── current-user.decorator.ts
```

### Password Value Object
```typescript
// Responsabilidades:
// - static create(plain: string): Promise<Password> → hash com bcrypt, cost 12
// - static fromHash(hash: string): Password → reconstrói de hash salvo
// - compare(plain: string): Promise<boolean>
// - get value(): string → retorna o hash (nunca a senha plain)
```

### Login Use Case
```typescript
// Recebe: { email: string, password: string, expectedRole: string }
// 1. Buscar user pelo email → se não existe: throw InvalidCredentialsException
// 2. Verificar role bate com expectedRole → se não: throw InvalidCredentialsException
// 3. password.compare(plain) → se false: throw InvalidCredentialsException
// 4. Gerar JWT: payload = { sub: userId, email, role, resellerId? }
// 5. Retornar: { accessToken: string, expiresIn: number, user: { id, email, role, name } }
// Nunca revelar qual campo está errado (segurança)
```

### JWT Strategy (NestJS Passport)
```typescript
// Validar assinatura do JWT
// Extrair payload: { sub, email, role, resellerId }
// Adicionar user ao request para uso nos controllers
```

### Guards
```typescript
// JwtAuthGuard  → aplica em qualquer rota protegida
// AdminGuard    → verifica role === 'admin', herda de JwtAuthGuard
// ResellerGuard → verifica role === 'reseller' E subscription.status === 'active'
```

### @CurrentUser() Decorator
```typescript
// Extrai o user do request (injetado pela JwtStrategy)
// Uso: async getMe(@CurrentUser() user: JwtPayload)
```

### Endpoints de Autenticação
```
POST /api/auth/login                → login cliente (role: customer)
POST /api/auth/register             → cadastro cliente
POST /api/auth/forgot-password      → enviar email de reset
POST /api/auth/reset-password       → definir nova senha com token
GET  /api/auth/me                   → dados do usuário logado [JwtAuthGuard]

POST /api/reseller/auth/login       → login revendedor (role: reseller)
POST /api/admin/auth/login          → login admin (role: admin)
```

---

## 1.C Frontend — Autenticação

### Arquivos a criar
```
frontend/src/
├── contexts/
│   ├── AuthContext.tsx          → cliente
│   ├── ResellerAuthContext.tsx  → revendedor
│   └── AdminAuthContext.tsx     → admin
├── hooks/
│   ├── useAuth.ts
│   ├── useResellerAuth.ts
│   └── useAdminAuth.ts
├── services/
│   └── auth/
│       ├── authService.ts
│       ├── resellerAuthService.ts
│       └── adminAuthService.ts
└── app/
    ├── admin/
    │   ├── layout.tsx           → proteção: redirect se não admin
    │   └── login/page.tsx       → formulário de login admin
    └── reseller/
        ├── layout.tsx           → proteção: redirect se não revendedor ativo
        └── login/page.tsx       → substituir visual atual por funcional
```

### Regras do contexto de autenticação
```typescript
// JWT armazenado em cookie httpOnly (set pelo backend via Set-Cookie)
// AuthContext verifica autenticação ao montar:
//   GET /api/auth/me com cookie → se 401, limpa estado
// layout.tsx de /admin/* redireciona para /admin/login se não autenticado
// layout.tsx de /reseller/* redireciona para /reseller/login se não autenticado
// Formulários com react-hook-form + yup
// Erros exibidos com useSnackbar() (jamais alert())
```

### Tela de Login do Revendedor (substituir comportamento atual)
```typescript
// /reseller/login
// O visual já existe. Conectar ao backend:
//   POST /api/reseller/auth/login → { email, password }
//   Sucesso: redirecionar para /reseller/dashboard
//   Erro: exibir snackbar "Email ou senha inválidos"
// "Esqueci minha senha" → POST /api/auth/forgot-password
// Verificar ao entrar: se revendedor status === 'approved' (sem assinatura ativa),
//   redirecionar para /reseller/subscription/create
```

### Tela de Login Admin (criar do zero)
```typescript
// /admin/login
// Card centralizado com logo Kaza Tem
// Campos: email, senha
// Botão "ENTRAR"
// Sem link de registro (admin é criado via seed/script)
// Sucesso: redirecionar para /admin/dashboard
```

---

# FASE 2 — PAINEL ADMINISTRATIVO

## 2.A Layout e Estrutura Admin

### Arquivo de layout
```typescript
// frontend/src/app/admin/layout.tsx
// Verificar autenticação (role === 'admin') ao montar
// Se não autenticado: redirect('/admin/login')
// Estrutura:
//   <AdminSidebar /> → menu lateral fixo
//   <AdminHeader />  → barra superior com nome do admin + logout
//   <main>{children}</main>

// AdminSidebar — itens do menu:
const menu = [
  { href: '/admin/dashboard',              label: 'Dashboard',     icon: 'DashboardIcon'    },
  { href: '/admin/revendedores/pendentes', label: 'Aprovações',    icon: 'PendingIcon',     badge: pendingCount  },
  { href: '/admin/revendedores',           label: 'Revendedores',  icon: 'PeopleIcon'       },
  { href: '/admin/saques',                 label: 'Saques',        icon: 'PaymentsIcon',    badge: withdrawalCount },
  { href: '/admin/pedidos',                label: 'Pedidos',       icon: 'ShoppingBagIcon'  },
  { href: '/admin/produtos',               label: 'Produtos',      icon: 'InventoryIcon'    },
  { href: '/admin/materiais',              label: 'Materiais',     icon: 'PhotoLibraryIcon' },
  { href: '/admin/configuracoes',          label: 'Configurações', icon: 'SettingsIcon'     },
];
// Badges (pendingCount, withdrawalCount) buscados via API ao carregar o layout
```

---

## 2.B Dashboard Admin

### API a implementar
```
GET /api/admin/dashboard/metrics  [AdminGuard]
```

### Resposta
```typescript
{
  salesToday: number,
  salesThisMonth: number,
  ordersToday: number,
  averageTicket: number,
  activeResellers: number,
  pendingRegistrations: number,
  pendingWithdrawals: number,
  salesChart: { date: string; amount: number; orders: number }[],  // últimos 30 dias
  topResellers: { id: string; name: string; totalSold: number; level: string }[],  // top 5
  topProducts:  { id: string; name: string; quantity: number; revenue: number }[], // top 5
}
```

### Backend — GetAdminDashboardMetricsUseCase
```typescript
// Usar queries SQL diretas/otimizadas (não carregar entidades completas)
// salesToday: SUM(total_amount) WHERE paid_at >= hoje às 00:00
// salesThisMonth: SUM(total_amount) WHERE paid_at no mês corrente
// ordersToday: COUNT(*) WHERE paid_at >= hoje às 00:00
// averageTicket: salesThisMonth / COUNT de pedidos no mês
// activeResellers: COUNT WHERE status = 'active'
// pendingRegistrations: COUNT WHERE status = 'pending'
// pendingWithdrawals: COUNT WHERE status = 'requested'
// salesChart: GROUP BY DATE(paid_at) últimos 30 dias
// topResellers: JOIN commissions, GROUP BY reseller, ORDER BY SUM desc, LIMIT 5
// topProducts: GROUP BY product_id, SUM(quantity), ORDER BY desc, LIMIT 5
```

### Frontend — /admin/dashboard
```typescript
// Métricas em cards:
//   "Vendas Hoje" | "Vendas no Mês" | "Pedidos Hoje" | "Ticket Médio"
//   "Revendedores Ativos" | "Cadastros Pendentes" | "Saques Pendentes"
// Gráfico de linha (Recharts LineChart) de vendas dos últimos 30 dias
// Tabela top 5 revendedores do mês
// Tabela top 5 produtos do mês
// Loading: Skeleton em todos os componentes
// Refresh automático a cada 5 minutos
```

---

## 2.C Gestão de Cadastros de Revendedores

### APIs a implementar
```
GET  /api/admin/resellers          [AdminGuard]  → lista com paginação e filtros
GET  /api/admin/resellers/pending  [AdminGuard]  → apenas status=pending
GET  /api/admin/resellers/:id      [AdminGuard]  → detalhes completos
POST /api/admin/resellers/:id/approve  [AdminGuard]
POST /api/admin/resellers/:id/reject   [AdminGuard]  body: { reason: string }
POST /api/admin/resellers/:id/suspend  [AdminGuard]
POST /api/admin/resellers/:id/reactivate [AdminGuard]
```

### Backend — ApproveResellerUseCase
```typescript
// 1. Buscar reseller por id
// 2. Validar: status deve ser 'pending' → senão: throw InvalidResellerStatusException
// 3. Gerar reseller_code único:
//    - Pegar primeiro nome sem acentos: "Paulo Souza" → "PAULO"
//    - Adicionar underscore + 8 chars aleatórios (letras maiúsculas + números)
//    - Ex: PAULO_XY12AB34
//    - Verificar unicidade no banco → se colisão, gerar outro
// 4. reseller.approve(adminId, resellerCode)
//    → sets: status='approved', approved_at=NOW(), approved_by=adminId, reseller_code
//    → emite ResellerApprovedEvent
// 5. Salvar via unitOfWork
// 6. Handler do evento → envia email 'reseller-approved'
```

### Backend — RejectResellerUseCase
```typescript
// 1. Buscar reseller por id
// 2. Validar: status deve ser 'pending'
// 3. Validar: reason não pode ser vazio
// 4. reseller.reject(adminId, reason)
//    → sets: status='rejected', rejected_at=NOW(), rejected_reason=reason
//    → emite ResellerRejectedEvent
// 5. Salvar via unitOfWork
// 6. Handler → email 'reseller-rejected' com o motivo
```

### Frontend — /admin/revendedores/pendentes
```typescript
// Tabela:
//   Colunas: Nome | CPF | Email | Telefone | Data do cadastro | Ações
// Botão "Analisar" em cada linha → abre Modal de detalhes
// Modal:
//   Dados pessoais completos
//   Dados bancários (banco, agência, conta)
//   Botão "APROVAR" → confirmação → chama API → toast sucesso → remove da lista
//   Botão "REJEITAR" → abre campo de texto (motivo obrigatório) → chama API
// Contador no título: "Cadastros Pendentes (X)"
// Estado vazio: "Nenhum cadastro pendente"
```

### Frontend — /admin/revendedores
```typescript
// Filtros: status (chips: Todos|Ativo|Pendente|Suspenso|Cancelado) | busca por nome/CPF
// Tabela: Nome | CPF | Email | Nível | Status | Vendas no mês | Data | Ação
// Clicar em linha → /admin/revendedores/[id]
// Paginação (20 por página)
```

### Frontend — /admin/revendedores/[id]
```typescript
// Dados pessoais + dados bancários
// Status atual com badge colorido
// Total vendido no mês / histórico
// Assinatura: status, próxima cobrança
// Botões de ação conforme status atual:
//   active → "Suspender"
//   suspended → "Reativar"
// Histórico de pedidos vinculados (tabela resumida)
// Histórico de saques (tabela resumida)
```

---

## 2.D Gestão de Saques

### APIs a implementar
```
GET  /api/admin/withdrawals?status=requested [AdminGuard]
POST /api/admin/withdrawals/:id/approve      [AdminGuard]
POST /api/admin/withdrawals/:id/reject       [AdminGuard]  body: { reason }
POST /api/admin/withdrawals/:id/mark-paid    [AdminGuard]
```

### Backend — ApproveWithdrawalUseCase
```typescript
// 1. Buscar withdrawal por id
// 2. Validar: status === 'requested'
// 3. Buscar dados do revendedor (nome, CPF, dados bancários)
// 4. Criar conta a pagar no Bling:
//    BlingPayablesClient.create({
//      fornecedor: { nome, cpfCnpj },
//      valor: withdrawal.amount,
//      vencimento: addDays(today, 5),
//      categoria: 'Comissão de revendedor'
//    })
// 5. withdrawal.approve(blingPayableId)
//    → status='approved', approved_at, bling_payable_id
//    → emite WithdrawalApprovedEvent
// 6. Salvar via unitOfWork
// 7. Handler → email 'withdrawal-approved' para revendedor
```

### Backend — MarkWithdrawalAsPaidUseCase
```typescript
// 1. Buscar withdrawal por id
// 2. Validar: status === 'approved'
// 3. withdrawal.markAsPaid()
//    → status='paid', paid_at=NOW()
//    → emite WithdrawalPaidEvent
// 4. Buscar commissions vinculadas (via withdrawal_commissions)
// 5. Para cada commission: status='withdrawn'
// 6. Salvar tudo via unitOfWork
// 7. Handler → email 'withdrawal-paid' para revendedor
```

### Frontend — /admin/saques
```typescript
// Abas: Pendentes | Aprovados | Pagos | Rejeitados
// Tabela (Pendentes): Revendedor | Valor | Banco | Agência | Conta | Data | Ações
// Ações (Pendentes): botão "Aprovar" (verde) + "Rejeitar" (vermelho)
//   Aprovar: confirmação simples → chama API → toast
//   Rejeitar: dialog com campo motivo obrigatório → chama API
// Ações (Aprovados): botão "Marcar como Pago" → confirmação → chama API
// Estado vazio por aba: "Nenhum saque [pendente/aprovado/etc.]"
```

---

## 2.E Gestão de Pedidos (Admin)

### API a implementar
```
GET /api/admin/orders?page=1&status=X&startDate=X&endDate=X [AdminGuard]
GET /api/admin/orders/:id [AdminGuard]
POST /api/admin/orders/:id/cancel [AdminGuard]
```

### Frontend — /admin/pedidos
```typescript
// Filtros: status | período (date range)
// Busca: por número do pedido ou CPF do cliente
// Tabela: # Pedido | Cliente | Revendedor | Valor | Status | Data | Ação
// Clicar → detalhes do pedido
// Detalhes: itens, endereço, pagamento, status Bling, comissão gerada
```

---

## 2.F Gestão de Produtos (Admin)

### APIs a implementar
```
GET  /api/admin/products?page=1&inStock=true&category=X [AdminGuard]
PUT  /api/admin/products/:id  [AdminGuard]  body: { is_active, name, description }
POST /api/admin/products/sync [AdminGuard]  → dispara sync manual com Bling
GET  /api/admin/products/sync/status [AdminGuard] → data/resultado da última sync
```

### Frontend — /admin/produtos
```typescript
// Barra superior: botão "SINCRONIZAR COM BLING" + "Última sync: [data]"
// Filtros: status (ativo/inativo) | em estoque | busca por nome ou SKU
// Tabela: Imagem (thumbnail) | SKU | Nome | Preço | Estoque | Ativo | Ação
// Toggle ativo/inativo inline na tabela (switch MUI)
// Clicar em linha → modal de edição (nome, descrição, is_active)
```

---

## 2.G Gestão de Materiais (Admin)

### APIs a implementar
```
GET    /api/admin/materials         [AdminGuard]
POST   /api/admin/materials         [AdminGuard]  multipart/form-data
PUT    /api/admin/materials/:id     [AdminGuard]
DELETE /api/admin/materials/:id     [AdminGuard]
```

### Backend — Upload de Material
```typescript
// Aceitar arquivos: image/*, application/pdf, video/*
// Upload para Supabase Storage (bucket: 'materials')
// Se imagem/banner: gerar thumbnail com sharp (400x300px)
// Salvar { title, description, type, file_url, thumbnail_url } no banco
```

### Frontend — /admin/materiais
```typescript
// Grid de cards dos materiais existentes
// Botão "NOVO MATERIAL" → abre modal com form:
//   Título (text), Tipo (select), Descrição (textarea), Arquivo (upload)
//   Preview do arquivo antes de enviar
//   Botão "ENVIAR"
// Em cada card: botão editar + botão remover (com confirmação)
```

---

## 2.H Configurações do Sistema

### API a implementar
```
GET /api/admin/config     [AdminGuard]  → retorna todos os pares key/value
PUT /api/admin/config     [AdminGuard]  body: { key: string, value: string }
```

### Frontend — /admin/configuracoes
```typescript
// Seções:
// 1. Regras de Comissão: 4 campos numéricos (percentuais por faixa)
// 2. Período de carência: input numérico (dias)
// 3. Mínimo para saque: input monetário
// 4. Valor da assinatura: input monetário (exibição apenas)
// 5. Status das integrações: Bling (conectado/desconectado + botão reconectar)
// Botão "SALVAR" em cada seção
// Toast de confirmação ao salvar
```

---

# FASE 3 — E-COMMERCE FUNCIONAL

## 3.A Integração Bling

### Estrutura
```
backend/src/infrastructure/integrations/bling/
├── bling-oauth.client.ts
├── bling-products.client.ts
├── bling-orders.client.ts
├── bling-payables.client.ts
└── bling.module.ts
```

### OAuth 2.0 — fluxo completo
```typescript
// BlingOAuthClient:
//
// getAuthorizationUrl(): string
//   → https://www.bling.com.br/Api/v3/oauth/authorize
//     ?response_type=code&client_id=${BLING_CLIENT_ID}&redirect_uri=${BLING_REDIRECT_URI}
//
// exchangeCode(code: string): Promise<void>
//   → POST https://www.bling.com.br/Api/v3/oauth/token
//     { grant_type: 'authorization_code', code, redirect_uri }
//     Auth: Basic base64(clientId:clientSecret)
//   → Salvar access_token, refresh_token, expires_at na tabela bling_tokens
//
// getValidToken(): Promise<string>
//   → Buscar último token da tabela
//   → Se expires_at < NOW() + 5min: chamar refreshToken()
//   → Retornar access_token
//
// refreshToken(): Promise<void>
//   → POST /token com grant_type='refresh_token'
//   → Atualizar registro na tabela
//
// Endpoints:
//   GET  /api/admin/bling/auth       → redireciona para Bling (login admin)
//   GET  /api/admin/bling/callback   → troca code, salva token, redireciona para /admin/configuracoes
```

### Sincronização de Produtos
```typescript
// SyncProductsFromBlingUseCase:
// 1. Obter token válido (BlingOAuthClient.getValidToken)
// 2. Iterar páginas: GET /produtos?pagina={page}&limite=100&situacao=A
//    enquanto retornar resultados
// 3. Para cada produto Bling:
//    if (existsByBlingId): atualizar name, price, cost_price, stock, is_active
//    else: criar novo produto
// 4. Retornar { created, updated, errors, syncedAt }
//
// Campos do Bling usados:
//   id → bling_id
//   codigo → sku
//   descricao → name
//   descricaoComplementar → description
//   preco → price
//   precoCusto → cost_price
//   estoqueAtual → stock
//   situacao: 'A'=ativo, 'I'=inativo
//   peso → weight (se disponível)
//
// Cron job: @Cron('0 * * * *') → toda hora
// Em erros individuais de produto: logar e continuar (não parar tudo)
```

### Envio de Pedido para Bling
```typescript
// BlingOrdersClient.createOrder(order: Order): Promise<string>
// POST /pedidos
// Payload:
// {
//   cliente: { nome, cpf, email, telefone,
//     endereco: { logradouro, numero, complemento, bairro, cep, municipio, uf }
//   },
//   itens: [{ codigo (sku), descricao, quantidade, valor }],
//   vlrFrete: shippingCost,
//   desconto: discountAmount,
//   obs: `Pedido Kaza Tem ${orderNumber}`,
// }
// Retorna: id do pedido no Bling
// Em falha: logar e agendar retry (3 tentativas, intervalo 30s)
```

### Criação de Conta a Pagar (Saque)
```typescript
// BlingPayablesClient.create(data): Promise<string>
// POST /contaspagar
// {
//   vencimento: data (YYYY-MM-DD),
//   valor: amount,
//   historico: `Comissão revendedor ${resellerName}`,
//   contato: { nome, cpf_cnpj }
// }
// Retorna: id da conta no Bling
```

---

## 3.B Integração Magis5 — Imagens

```typescript
// Magis5Client.getProductImages(sku: string): Promise<string[]>
// GET ${MAGIS5_API_URL}/products/${sku}/images
// Headers: X-API-Key: ${MAGIS5_API_KEY}
// Retorna: array de URLs de imagens
// Em erro 404 (produto sem imagem): retornar [] silenciosamente

// SyncProductImagesUseCase:
// 1. Buscar todos os produtos ativos (somente id + sku)
// 2. Processar em batches de 10 (para não sobrecarregar a API)
// 3. Para cada produto:
//    a. Chamar Magis5Client.getProductImages(sku)
//    b. Se retornou imagens:
//       - DELETE FROM product_images WHERE product_id = X
//       - INSERT cada URL com position = index, is_primary = (index === 0)
//    c. Se erro: logar, continuar para o próximo
// 4. Cron: @Cron('0 3 * * *') → todo dia às 03:00
```

---

## 3.C Produtos — APIs Públicas

```
GET /api/products?page=1&limit=20&category=X&minPrice=0&maxPrice=999&inStock=true&sort=price_asc&q=termo
GET /api/products/:id
```

### Backend — ListProductsUseCase
```typescript
// Filtros aplicados:
//   is_active = true SEMPRE (público só vê ativos)
//   stock > 0 se inStock = true
//   price BETWEEN minPrice AND maxPrice
//   category_name = category
//   ILIKE '%q%' em name se q fornecido
// Ordenação:
//   price_asc, price_desc, name_asc, newest
// Retornar junto com cada produto: primeira imagem (is_primary = true)
// Paginação: total, totalPages, currentPage
```

---

## 3.D Frontend — E-commerce

### Listagem de Produtos — /produtos
```typescript
// Layout: sidebar de filtros (desktop) | grid de produtos
// Filtros: categoria (chips), faixa de preço (slider), em estoque (switch)
// Ordenação: select no topo
// ProductCard:
//   thumbnail (primeira imagem), badge (Oferta/Novo/Mais Vendido se aplicável)
//   nome, preço atual, preço anterior riscado (se houver desconto)
//   botão "ADICIONAR AO CARRINHO" → feedback visual imediato
//   botão "VER PRODUTO" → navega para detalhes
// Skeleton loading (8 cards) durante fetch
// Estado vazio: "Nenhum produto encontrado" com botão limpar filtros
// Paginação (MUI Pagination)
// Manter filtros na URL (Next.js searchParams) para compartilhamento
```

### Detalhes do Produto — /produtos/[id]
```typescript
// ProductGallery:
//   Imagem principal grande (400px+)
//   Row de thumbnails clicáveis abaixo
//   Zoom ao passar mouse (desktop)
// Informações:
//   Nome, SKU, categoria
//   Preço atual em destaque, preço anterior riscado
//   Cálculo de parcelamento: "12x de R$ X sem juros"
//   Badge "Frete GRÁTIS" se stock > 0
//   Seletor de quantidade (1 até stock disponível)
//   Botão "COMPRAR AGORA" (adiciona + vai para /checkout)
//   Botão "ADICIONAR AO CARRINHO" com ícone de carrinho
// ShippingCalculator:
//   Input de CEP com máscara (00000-000)
//   Botão "CALCULAR"
//   Lista de opções: transportadora | prazo | preço
// Tabs: Descrição | Especificações
// Exibir "Esgotado" e desabilitar botões se stock = 0
// RelatedProducts: 4 produtos da mesma categoria
```

---

## 3.E Carrinho de Compras

### Backend
```
GET    /api/cart                    → identificar por session_id (cookie)
POST   /api/cart/items              body: { productId, quantity }
PUT    /api/cart/items/:productId   body: { quantity }
DELETE /api/cart/items/:productId
DELETE /api/cart
```

```typescript
// Tabela cart_sessions:
CREATE TABLE cart_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) UNIQUE NOT NULL,
  user_id    UUID REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cart_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cart_sessions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity   INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, product_id)
);

// session_id gerado pelo backend, salvo em cookie httpOnly
// Se usuário faz login: vincular session ao user_id
// Validar estoque ao adicionar (se qty > stock: retornar 400 com mensagem)
// Calcular subtotal sempre no backend (não confiar no frontend)
```

### Frontend — CartContext + CartDrawer
```typescript
// CartContext (global, em RootLayout):
//   items[], totalItems, subtotal
//   addItem(productId, quantity) → POST /api/cart/items
//   removeItem(productId) → DELETE /api/cart/items/:id
//   updateQuantity(productId, qty) → PUT /api/cart/items/:id
//   clearCart() → DELETE /api/cart
//   fetchCart() → GET /api/cart (ao montar o contexto)

// Header: ícone de carrinho com Badge mostrando totalItems
// CartDrawer (Drawer lateral direito):
//   Lista de itens: thumbnail, nome, preço, seletor de quantidade, botão remover
//   Subtotal em destaque
//   Botão "FINALIZAR COMPRA" → navega para /checkout
//   Botão "CONTINUAR COMPRANDO" → fecha drawer
//   Estado vazio: ícone + "Seu carrinho está vazio"
```

---

## 3.F Cálculo de Frete

### API a implementar
```
POST /api/shipping/calculate
body: { zipCode: string, items: [{ productId: string, quantity: number }] }
```

```typescript
// 1. Buscar produtos no banco para obter peso + dimensões
// 2. Calcular totais: peso total, maior dimensão por eixo (embalagem)
// 3. Chamar Melhor Envio:
//    POST https://www.melhorenvio.com.br/api/v2/me/shipment/calculate
//    Headers: Authorization: Bearer ${MELHOR_ENVIO_TOKEN}
//    {
//      from: { postal_code: MELHOR_ENVIO_CEP_ORIGIN },
//      to:   { postal_code: zipCode },
//      package: { weight, width, height, length }
//    }
// 4. Filtrar opções com erro
// 5. Ordenar por preço crescente
// 6. Retornar: [{ id, carrier, service, price, deliveryTime, deliveryDate }]
```

---

## 3.G Checkout Completo

### Frontend — /checkout (4 etapas)

**Etapa 1 — Dados Pessoais**
```typescript
// Campos: fullName, email, cpf, phone
// Validar CPF (algoritmo de dígitos verificadores, não só formato)
// Se usuário logado: pré-preencher dados do perfil
// react-hook-form + yup com validações completas
```

**Etapa 2 — Endereço**
```typescript
// Campo CEP com máscara (00000-000)
// Ao sair do campo CEP: GET https://viacep.com.br/ws/{cep}/json/
//   → preencher automaticamente: logradouro, bairro, cidade, uf
// Campos: street, number, complement, neighborhood, city, state
```

**Etapa 3 — Frete**
```typescript
// Ao entrar na etapa: POST /api/shipping/calculate automaticamente
// Loading enquanto calcula
// Exibir cada opção: logo da transportadora, nome do serviço, prazo (X dias úteis), preço
// Usuário seleciona uma opção
// Se API falhar: exibir mensagem + campo manual para digitar valor de frete
```

**Etapa 4 — Pagamento e Confirmação**
```typescript
// Formulário de cartão:
//   cardNumber: máscara "0000 0000 0000 0000"
//   cardHolder: letras maiúsculas
//   cardExpiration: máscara "00/00"
//   cardCvv: 3-4 dígitos
//   installments: select (1x a 12x com valores calculados)
// Resumo do pedido (readonly): itens, subtotal, frete, desconto, total
// Campo de cupom: input + botão "APLICAR"
//   → POST /api/coupons/validate { code, subtotal }
//   → Exibir desconto aplicado ou mensagem de erro
// Botão "CONFIRMAR PEDIDO" → POST /api/orders
// Overlay de loading com mensagem "Processando pagamento..."
// Sucesso: redirect para /pedido/confirmado/[orderNumber]
// Erro de pagamento: Alert com mensagem clara (ex: "Cartão recusado")
//   manter formulário preenchido para o usuário corrigir
```

### Backend — CreateOrderUseCase
```typescript
// POST /api/orders
// 1. Buscar carrinho pelo session_id (cookie)
// 2. Validar cada item: produto existe, is_active, qty <= stock
// 3. Ler cookie 'reseller_code' do request
//    → Buscar revendedor pelo code
//    → Se revendedor.user_id === usuário logado → NÃO vincular (anti-self-purchase)
//    → Se revendedor está ativo → vincular ao pedido
// 4. Aplicar cupom se fornecido:
//    → CouponService.validate(code, subtotal, resellerCode)
//    → Se válido: calcular discount_amount, incrementar usage_count
// 5. Processar pagamento: CieloCheckoutClient.processPayment(cardData, amount)
//    → Se status !== 2 (aprovado): throw PaymentFailedException(returnMessage)
// 6. Gerar orderNumber: 'KT-' + year + '-' + sequência 5 dígitos
// 7. Criar Order + OrderItems no banco (status='paid')
// 8. Reduzir stock de cada produto
// 9. Enviar para Bling: BlingOrdersClient.createOrder (async, não bloqueia)
// 10. Se tem resellerId: emitir OrderPaidWithResellerEvent
// 11. Limpar carrinho (DELETE session)
// 12. Enviar email confirmação para cliente (async)
// 13. Retornar { orderId, orderNumber }
// TUDO dentro de unitOfWork.execute exceto chamadas externas (Cielo, Bling)
```

---

## 3.H Integração Cielo — Pagamento Único

```typescript
// CieloCheckoutClient:
// POST ${CIELO_API_URL}/1/sales
// Headers: { MerchantId, MerchantKey }
//
// Payload:
// {
//   MerchantOrderId: orderNumber,
//   Customer: { Name: customerName, Email: customerEmail },
//   Payment: {
//     Type: 'CreditCard',
//     Amount: Math.round(totalAmount * 100), // em centavos!
//     Installments: installments,
//     SoftDescriptor: 'KAZATEM',
//     CreditCard: {
//       CardNumber: cardNumber.replace(/\s/g, ''),
//       Holder: cardHolder,
//       ExpirationDate: cardExpiration,   // "MM/YY"
//       SecurityCode: cardCvv,
//       Brand: detectBrand(cardNumber)    // Visa|Master|Amex|Elo
//     }
//   }
// }
//
// detectBrand(number): string
//   '4' → 'Visa'
//   '5' → 'Master'
//   '3' → 'Amex'
//   '6' → 'Elo'
//   default → 'Visa'
//
// Resposta: { Payment: { Status, PaymentId, ReturnCode, ReturnMessage } }
// Status 2 = Capturado/Aprovado
// Status 3 = Negado
// Outros: consultar documentação Cielo

// Variáveis de ambiente:
// CIELO_MERCHANT_ID=
// CIELO_MERCHANT_KEY=
// CIELO_API_URL=https://apisandbox.cieloecommerce.cielo.com.br   (sandbox)
// CIELO_QUERY_URL=https://apiquerysandbox.cieloecommerce.cielo.com.br
```

---

# FASE 4 — PORTAL DO REVENDEDOR

## 4.A Rota de Rastreamento — /r/[code]

### Página Next.js
```typescript
// frontend/src/app/r/[code]/page.tsx
// 'use client'
// useEffect ao montar:
//   1. POST /api/tracking/visit { resellerCode, referer: document.referrer }
//   2. POST /api/set-reseller-cookie (API Route Next.js que seta cookie httpOnly)
//   3. router.replace('/')
// Renderizar só um spinner enquanto processa
```

### API Route para cookie httpOnly
```typescript
// frontend/src/app/api/set-reseller-cookie/route.ts
// POST recebe { code: string }
// Validar se code existe no banco (GET /api/resellers/code/:code no backend)
// Setar cookie: cookies().set('reseller_code', code, {
//   maxAge: 30 * 24 * 60 * 60,  // 30 dias
//   httpOnly: true,
//   secure: process.env.NODE_ENV === 'production',
//   path: '/',
// })
// Retornar 200
```

### Backend — Endpoints de rastreamento
```
POST /api/tracking/visit         → body: { resellerCode, ipAddress, userAgent, referer }
GET  /api/resellers/code/:code   → retornar se código existe (para validação)
```

---

## 4.B Dashboard do Revendedor — Dados Reais

### API a implementar
```
GET /api/resellers/me/dashboard  [ResellerGuard]
```

### Resposta
```typescript
{
  reseller: { name, level, code, status },
  metrics: {
    totalSoldMonth: number,       // SUM pedidos vinculados no mês
    commissionsAvailable: number, // SUM commissions WHERE status='available'
    commissionsPending: number,   // SUM commissions WHERE status='pending'
    visitsThisMonth: number,      // COUNT visits WHERE created_at no mês
    ordersThisMonth: number,      // COUNT pedidos no mês
    conversionRate: number,       // (orders / visits) * 100, arredondado 1 decimal
  },
  salesChart: { date: string; amount: number }[],  // últimos 30 dias
  recentSales: {
    orderNumber: string; amount: number;
    commissionAmount: number; commissionStatus: string; date: string
  }[]  // últimas 5 vendas
}
```

### Frontend — Substituir completamente o conteúdo atual
```typescript
// REMOVER: todos os valores hardcoded, mensagem de erro "Não foi possível carregar"
// IMPLEMENTAR:
// Hero card amarelo (manter visual atual):
//   "Olá, [nome]!"
//   Badge de nível
//   Link: kazatem.shop/r/[code] com botão "Copiar"
//   Botões: "VER VENDAS" → /reseller/sales | "MATERIAIS" → /reseller/materials
//
// Cards de métricas (dados reais da API):
//   Total Vendido no Mês | Comissão Disponível | Visitas este Mês | Taxa de Conversão
//
// Gráfico de vendas (Recharts LineChart):
//   eixo X = datas, eixo Y = R$ vendidos
//   últimos 30 dias
//
// Tabela "Vendas Recentes" (5 últimas)
//
// Loading: Skeleton em todos os componentes durante fetch
// Erro de API: Alert com botão "Tentar novamente" (sem sumir com a tela)
```

---

## 4.C Vendas do Revendedor — /reseller/sales

### API a implementar
```
GET /api/resellers/me/sales?page=1&limit=20&startDate=X&endDate=X  [ResellerGuard]
```

### Resposta
```typescript
{
  sales: {
    orderNumber: string;
    date: string;
    customerName: string;
    subtotal: number;
    shippingCost: number;
    totalAmount: number;
    commissionPercentage: number;
    commissionAmount: number;
    commissionStatus: 'pending'|'available'|'withdrawn'|'reversed';
    commissionAvailableAt: string;
    orderStatus: string;
  }[];
  total: number;
  totalPages: number;
  summary: { totalSales: number; totalCommissions: number };
}
```

### Frontend
```typescript
// DateRangePicker para filtrar período
// Tabela com todas as colunas
// commissionStatus badge colorido:
//   pending → chip amarelo "Aguardando (X dias)"
//   available → chip verde "Disponível"
//   withdrawn → chip azul "Sacada"
//   reversed → chip vermelho "Revertida"
// Resumo no topo: "Total vendido: R$ X | Comissões: R$ Y"
// Botão "Exportar CSV"
// Paginação
```

---

## 4.D Comissões — /reseller/commissions

### APIs a implementar
```
GET /api/resellers/me/commissions/summary  [ResellerGuard]
GET /api/resellers/me/commissions?status=pending|available|withdrawn|reversed  [ResellerGuard]
```

### Frontend
```typescript
// 3 cards no topo:
//   Pendente: R$ X — "Disponível em ~N dias"
//   Disponível: R$ X — "Pronto para saque"
//   Sacado: R$ X — "Total recebido"
//
// Progress bar se disponível < R$ 50:
//   "Faltam R$ X para atingir o mínimo de saque"
//
// Abas: Pendentes | Disponíveis | Sacadas | Revertidas
// Tabela por aba:
//   Data | Pedido | Base R$ | % | Comissão | Status/Data disponível
//
// Se disponível >= R$ 50: botão "SOLICITAR SAQUE" em destaque (amarelo)
```

---

## 4.E Saques do Revendedor

### APIs a implementar
```
GET  /api/resellers/me/withdrawals  [ResellerGuard]
POST /api/withdrawals               [ResellerGuard]  → solicitar saque
```

### Backend — RequestWithdrawalUseCase
```typescript
// 1. Verificar subscription.status === 'active'
//    → senão: throw InactiveSubscriptionException
// 2. Verificar não existe withdrawal com status 'requested' ou 'approved'
//    → senão: throw PendingWithdrawalException
// 3. Buscar commissions WHERE reseller_id=X AND status='available'
// 4. Somar total: se < 50: throw InsufficientBalanceException
// 5. Criar Withdrawal com o total
// 6. Inserir em withdrawal_commissions (quais commissions fazem parte)
// 7. IMPORTANTE: NÃO alterar status das commissions ainda
//    (só muda para 'withdrawn' quando admin marcar como pago)
// 8. Emitir WithdrawalRequestedEvent
//    → handler: email para admin + email para revendedor
```

### Páginas Frontend
```typescript
// /reseller/withdrawals → histórico
//   Abas: Pendentes | Aprovados | Pagos | Rejeitados
//   Tabela: Data | Valor | Status | Data aprovação/pagamento | Motivo rejeição
//   Botão "NOVO SAQUE" se não tem pendente/aprovado em aberto
//
// /reseller/withdrawals/request → solicitar saque
//   Exibir: "Saldo disponível: R$ X"
//   Exibir dados bancários cadastrados (readonly)
//   Mensagem: "Você receberá R$ X na conta acima em até 5 dias após aprovação"
//   Botão "CONFIRMAR SOLICITAÇÃO"
//   Bloqueado com mensagem se saldo < R$ 50
```

---

## 4.F Cupons — /reseller/coupons

### APIs a implementar
```
GET    /api/resellers/me/coupons   [ResellerGuard]
POST   /api/coupons                [ResellerGuard]
DELETE /api/coupons/:id            [ResellerGuard]
POST   /api/coupons/validate       [público]  body: { code, subtotal, resellerCode? }
```

### Regras de negócio — validação
```typescript
// Ao criar cupom:
//   discount_type='percentage' → discount_value max = 10
//   discount_type='fixed'      → discount_value max = 50.00
//   valid_until mínimo = amanhã
//   code: automático (PRIMEIRNOME_XXXXXXXX) ou customizado (sem espaços, só alfanumérico)
//   Verificar unicidade do code
//
// Ao validar no checkout:
//   1. Buscar por code (case-insensitive)
//   2. Verificar is_active=true
//   3. Verificar valid_from <= now <= valid_until
//   4. Verificar usage_count < usage_limit (se limit não é null)
//   5. Se cupom tem reseller_id: verificar que cookie resellerCode == dono do cupom
//   6. Calcular discount_amount:
//      percentage → subtotal * (value/100)
//      fixed → min(value, subtotal)  // não pode ser maior que o subtotal
//   7. NÃO incrementar usage_count aqui (só ao confirmar o pedido)
//   8. Retornar { valid: true, discountAmount, code }
//
// A comissão é sempre calculada sobre: subtotal - discountAmount
```

### Frontend — /reseller/coupons
```typescript
// Lista de cupons: código | tipo | desconto | usos/limite | válido até | status | ações
// Formulário de criação (modal ou página):
//   Tipo: radio "Porcentagem (máx. 10%)" | "Valor fixo (máx. R$ 50)"
//   Valor: input numérico com hint do máximo
//   Válido até: DatePicker (mínimo amanhã)
//   Limite de uso: número ou "Ilimitado"
//   Código: gerado automaticamente OU campo para customizar
// Botão "Desativar" em cupom ativo (com confirmação)
// Estado vazio: "Você não tem cupons. Crie um para oferecer desconto aos clientes."
```

---

## 4.G Materiais de Marketing — /reseller/materials

```typescript
// GET /api/materials  [ResellerGuard]  → listar materiais ativos

// Página:
// Filtros por tipo no topo: Todos | Imagens | Banners | Catálogos | Vídeos | Textos
// Grid de cards:
//   Thumbnail (imagem/banner/PDF preview)
//   Título + tipo (chip)
//   Botão "BAIXAR" → window.open(file_url, '_blank')
//   Botão "COPIAR LINK" → copia file_url para clipboard com toast "Link copiado!"
// Estado vazio: "Nenhum material disponível ainda."
```

---

## 4.H Assinatura — /reseller/subscription

### Integração Cielo Recorrência
```typescript
// CieloRecurrenceClient:
//
// createRecurrence(data): Promise<{ recurrenceId, paymentStatus }>
// POST ${CIELO_API_URL}/1/sales
// {
//   MerchantOrderId: `SUB-${resellerId}`,
//   Customer: { Name, Email },
//   Payment: {
//     Type: 'CreditCard',
//     Amount: 990,  // R$ 9,90 em centavos
//     Installments: 1,
//     SoftDescriptor: 'KAZATEM',
//     RecurrentPayment: {
//       AuthorizeNow: true,
//       Interval: 'Monthly',
//       EndDate: '2099-12-31'
//     },
//     CreditCard: { CardNumber, Holder, ExpirationDate, SecurityCode, Brand }
//   }
// }
// Retornar: { Payment.RecurrentPayment.RecurrentPaymentId, Payment.Status }
//
// cancelRecurrence(recurrenceId): Promise<void>
// PUT ${CIELO_API_URL}/1/RecurrentPayment/{recurrenceId}/Deactivate
```

### Backend — CreateSubscriptionUseCase
```typescript
// 1. Verificar reseller.status === 'approved' (não 'active')
// 2. Verificar não existe subscription ativa para este reseller
// 3. CieloRecurrenceClient.createRecurrence(cardData + resellerData)
// 4. Se Payment.Status !== 2: throw PaymentFailedException(ReturnMessage)
// 5. Criar Subscription no banco:
//    { reseller_id, cielo_recurrence_id, status='active', amount=9.90,
//      next_billing_date = hoje + 30 dias }
// 6. reseller.activate() → status='active'
// 7. Salvar via unitOfWork
// 8. Emitir SubscriptionCreatedEvent
//    → handler: email 'subscription-created' para revendedor
// 9. Retornar subscription criada
```

### APIs a implementar
```
GET  /api/resellers/me/subscription      [ResellerGuard]
POST /api/subscriptions                  [JwtAuthGuard - role reseller com status approved]
PUT  /api/subscriptions/me/payment-method [ResellerGuard]  body: { cardData }
POST /api/subscriptions/me/cancel        [ResellerGuard]
```

### Página — /reseller/subscription/create
```typescript
// Exibida automaticamente após aprovação (antes de ativar a conta)
// Redirecionamento: se reseller.status === 'approved' ao fazer login → redirect aqui
//
// Layout:
//   "Seu cadastro foi aprovado! 🎉"
//   "Para começar a usar a plataforma, ative sua assinatura:"
//   Card com: Plano R$ 9,90/mês | Renovação automática | Cancele quando quiser
//   Formulário de cartão:
//     número (máscara), titular, validade (MM/AA), CVV, parcelamento (fixo: 1x)
//   Nota de segurança: "Pagamento processado pela Cielo. Não armazenamos seus dados."
//   Botão "ATIVAR MINHA CONTA"
//   Loading overlay durante processamento
//   Sucesso → redirect para /reseller/dashboard
//   Erro → Alert com mensagem do Cielo
```

### Página — /reseller/subscription
```typescript
// Status atual: badge "Ativa" (verde) | "Suspensa" (amarelo) | "Cancelada" (vermelho)
// Valor: R$ 9,90/mês
// Próxima cobrança: [data]
// Histórico de pagamentos (últimos 6 meses)
// Botão "Atualizar cartão"
// Botão "Cancelar assinatura" (com confirmação severa)
```

---

# FASE 5 — AUTOMAÇÃO

## 5.A Cálculo Automático de Comissões

### Trigger via Domain Event
```typescript
// Handler: OrderPaidWithResellerHandler
// @OnEvent('order.paid_with_reseller')
// Chama: CalculateCommissionUseCase.execute({ orderId })
```

### CalculateCommissionUseCase — lógica completa
```typescript
// 1. Buscar pedido com resellerId confirmado
// 2. base_amount = order.subtotal - order.discount_amount
//    (NUNCA incluir shipping_cost na base)
// 3. Buscar vendas do mês atual do revendedor:
//    SELECT COALESCE(SUM(o.subtotal - o.discount_amount), 0)
//    FROM orders o
//    WHERE o.reseller_id = X
//      AND o.status = 'paid'
//      AND DATE_TRUNC('month', o.paid_at) = DATE_TRUNC('month', NOW())
//      AND o.id != currentOrderId  -- excluir pedido atual
// 4. total_month = previous_sales + base_amount
// 5. Buscar tiers de commission_tier_1...4 da tabela system_config
//    Determinar percentual pelo total_month
// 6. commission_amount = base_amount * (percentage / 100)
// 7. grace_days = system_config['commission_grace_days'] → default 30
// 8. available_at = TODAY + grace_days
// 9. INSERT INTO commissions { reseller_id, order_id, amount, base_amount,
//    percentage, status='pending', available_at }
```

### Cron — Liberar Comissões
```typescript
// ReleaseCommissionsJob
// @Cron('0 1 * * *') → todo dia às 01:00
//
// SELECT * FROM commissions
// WHERE status = 'pending' AND available_at <= CURRENT_DATE
//
// Para cada commission (em batch, unitOfWork individual por item):
//   commission.release() → status='available'
//   Salvar
//   Emitir CommissionReleasedEvent
//
// CommissionReleasedHandler:
//   Verificar se é a primeira comissão disponível do revendedor neste mês
//   Agregar todas disponíveis do revendedor (pode ter várias liberadas juntas)
//   Enviar um único email: 'commission-available' com total disponível
```

---

## 5.B Webhooks Cielo

### Endpoint
```
POST /api/webhooks/cielo   [SEM autenticação JWT]
```

```typescript
// CieloWebhookController:
// 1. Logar o payload recebido (para debug)
// 2. Idempotência: verificar se PaymentId já foi processado
//    (guardar em tabela processed_webhooks ou checar status atual)
// 3. Responder 200 em < 3 segundos (processar em background se necessário)

// Webhook de pagamento único (pedido):
// payload.PaymentId existe E payload.RecurrentPaymentId não existe
// Status 2 → order.status = 'paid', emitir OrderPaidEvent
// Status 3 → order.status = 'payment_failed', notificar cliente (email)

// Webhook de recorrência (assinatura):
// payload.RecurrentPaymentId existe
// ChangeType 2 → pagamento efetuado: subscription.status='active', atualizar next_billing_date
// ChangeType 3 → recorrência desabilitada: subscription.status='canceled'
// ChangeType 4 → pagamento falhou:
//   subscription.status = 'suspended'
//   reseller.status = 'suspended'
//   Emitir SubscriptionPaymentFailedEvent
//   Handler: email 'subscription-payment-failed'
```

---

## 5.C Cron — Cancelar Inadimplentes

```typescript
// CancelSuspendedSubscriptionsJob
// @Cron('0 2 * * *') → todo dia às 02:00
//
// SELECT s.* FROM subscriptions s
// WHERE s.status = 'suspended'
//   AND s.updated_at < NOW() - INTERVAL '7 days'
//
// Para cada subscription:
//   CieloRecurrenceClient.cancelRecurrence(cielo_recurrence_id)
//   subscription.status = 'canceled'
//   reseller.status = 'canceled'
//   Emitir SubscriptionCanceledEvent
//   Handler: email 'subscription-canceled'
// Salvar via unitOfWork
```

---

## 5.D Sistema de Emails

### Configuração (Nodemailer)
```typescript
// EmailService:
// transporter = nodemailer com SMTP configurado via env
// send({ to, subject, html }): Promise<void>
//   → try/catch: em erro, salvar em email_logs com status='failed', NÃO lançar
//   → em sucesso: salvar em email_logs com status='sent'
//
// renderTemplate(templateName, variables): string
//   → ler arquivo HTML de templates/emails/
//   → substituir variáveis: {{ name }}, {{ amount }}, etc.
```

### Templates HTML a criar (pasta: `backend/src/infrastructure/email/templates/`)

| Template | Assunto | Variáveis |
|---|---|---|
| `reseller-registration.html` | "Recebemos seu cadastro!" | `name` |
| `reseller-approved.html` | "Cadastro aprovado! 🎉" | `name`, `subscriptionUrl` |
| `reseller-rejected.html` | "Atualização sobre seu cadastro" | `name`, `reason` |
| `subscription-created.html` | "Conta ativa! Comece a vender" | `name`, `link`, `nextBillingDate` |
| `subscription-payment-failed.html` | "Problema no pagamento" | `name`, `graceDays` |
| `subscription-suspended.html` | "Conta suspensa" | `name` |
| `subscription-canceled.html` | "Assinatura cancelada" | `name` |
| `order-confirmed.html` | "Pedido #{{orderNumber}} confirmado!" | `customerName`, `orderNumber`, `items[]`, `total`, `address` |
| `commission-available.html` | "Comissão disponível para saque!" | `name`, `amount`, `totalAvailable` |
| `withdrawal-requested-reseller.html` | "Saque solicitado" | `name`, `amount` |
| `withdrawal-requested-admin.html` | "Novo saque para aprovar" | `resellerName`, `amount`, `bankInfo` |
| `withdrawal-approved.html` | "Saque aprovado!" | `name`, `amount` |
| `withdrawal-paid.html` | "Seu saque foi pago!" | `name`, `amount` |
| `withdrawal-rejected.html` | "Saque não aprovado" | `name`, `amount`, `reason` |
| `commission-reversed.html` | "Comissão revertida" | `name`, `amount`, `orderNumber` |

### Mapeamento Event → Template
```typescript
// Em cada handler (@OnEvent), após salvar no banco:
// ResellerRegisteredEvent       → reseller-registration         → para revendedor
// ResellerApprovedEvent         → reseller-approved             → para revendedor
// ResellerRejectedEvent         → reseller-rejected             → para revendedor
// SubscriptionCreatedEvent      → subscription-created          → para revendedor
// SubscriptionPaymentFailedEvent → subscription-payment-failed  → para revendedor
// SubscriptionSuspendedEvent    → subscription-suspended        → para revendedor
// SubscriptionCanceledEvent     → subscription-canceled         → para revendedor
// OrderPaidEvent                → order-confirmed               → para cliente
// CommissionReleasedEvent       → commission-available          → para revendedor
// WithdrawalRequestedEvent      → withdrawal-requested-reseller → para revendedor
//                               → withdrawal-requested-admin    → para admin
// WithdrawalApprovedEvent       → withdrawal-approved           → para revendedor
// WithdrawalPaidEvent           → withdrawal-paid               → para revendedor
// WithdrawalRejectedEvent       → withdrawal-rejected           → para revendedor
// CommissionReversedEvent       → commission-reversed           → para revendedor
```

---

# FASE 6 — QUALIDADE E SEGURANÇA

## 6.A Segurança

```typescript
// 1. Rate limiting (@nestjs/throttler):
//    POST /api/auth/*        → 5 req/min por IP
//    POST /api/orders        → 10 req/hora por usuário
//    POST /api/webhooks/*    → sem limite

// 2. Helmet: app.use(helmet()) no main.ts

// 3. CORS:
//    origin: [FRONTEND_URL] (via env)
//    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
//    credentials: true  // necessário para cookies

// 4. Todos os DTOs com class-validator:
//    @IsString(), @IsEmail(), @MaxLength(), @IsNumber(), @IsEnum(), etc.
//    Global ValidationPipe com whitelist:true, forbidNonWhitelisted:true

// 5. CPF validation:
//    Implementar como método estático em CPF Value Object
//    Validar dígitos verificadores (não só formato)
//    Testar com CPFs inválidos conhecidos

// 6. Logs de auditoria para ações críticas:
//    Aprovar/rejeitar revendedor | Aprovar/rejeitar saque | Cancelar pedido
```

## 6.B Estados de UI Obrigatórios

**Todo componente que faz fetch deve ter os 3 estados:**
```typescript
// Loading: MUI Skeleton ou CircularProgress centralizado
// Erro: Alert severity="error" com mensagem amigável + botão "Tentar novamente"
// Vazio: ícone + mensagem contextual + ação sugerida

// Exemplos de mensagens de estado vazio:
// /reseller/sales:       "Você ainda não tem vendas. Compartilhe seu link!"
// /reseller/commissions: "Nenhuma comissão ainda. Comece a vender!"
// /admin/saques:         "Nenhum saque [pendente/aprovado/pago]."
// /produtos:             "Nenhum produto encontrado com esses filtros."
```

## 6.C Responsividade

```typescript
// Portal Admin: sidebar colapsa em Drawer em mobile (hamburger menu)
// Portal Revendedor: mobile-first (maioria acessa pelo celular)
// E-commerce: mobile-first
// Tabelas em mobile: scroll horizontal com sticky coluna de ação
// Checkout em mobile: sem sidebar de resumo (resumo aparece no topo collapsível)
// Breakpoints MUI: xs=0, sm=600, md=900, lg=1200, xl=1536
```

## 6.D Testes Unitários Mínimos

```typescript
// Domain — obrigatório:
// Commission: calcula percentual correto para cada faixa de volume
// Commission: carência correta (available_at = created_at + 30 dias)
// Coupon: desconto porcentagem não ultrapassa 10%
// Coupon: desconto fixo não ultrapassa R$ 50
// Coupon: calculateDiscount nunca retorna > subtotal
// Withdrawal: lança exceção se amount < 50
// Reseller: approve() em status !== 'pending' lança exceção
// Reseller: reject() sem reason lança exceção
// Order: base_amount nunca inclui shippingCost

// Use Cases — mocks de repositório:
// CalculateCommissionUseCase: volume acumulado determina tier correto
// RequestWithdrawalUseCase: bloqueia se já existe saque pendente
// RequestWithdrawalUseCase: bloqueia se saldo < R$ 50
// ApproveResellerUseCase: gera reseller_code único
// CreateOrderUseCase: vincula resellerId pelo cookie corretamente
// CreateOrderUseCase: NÃO vincula se revendedor é o próprio comprador
```

---

# VARIÁVEIS DE AMBIENTE

```env
# ===== BACKEND =====
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3003

# Database
DATABASE_URL=postgresql://user:pass@host:5432/kazatem

# JWT
JWT_SECRET=minimo-32-caracteres-aqui
JWT_EXPIRES_IN=7d

# Cielo (usar sandbox para dev)
CIELO_MERCHANT_ID=
CIELO_MERCHANT_KEY=
CIELO_API_URL=https://apisandbox.cieloecommerce.cielo.com.br
CIELO_QUERY_URL=https://apiquerysandbox.cieloecommerce.cielo.com.br

# Bling
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=http://localhost:3001/api/admin/bling/callback
BLING_API_URL=https://www.bling.com.br/Api/v3

# Magis5
MAGIS5_API_URL=
MAGIS5_API_KEY=

# Melhor Envio (sandbox para dev)
MELHOR_ENVIO_TOKEN=
MELHOR_ENVIO_API_URL=https://sandbox.melhorenvio.com.br/api/v2
MELHOR_ENVIO_CEP_ORIGIN=74000000

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="Kaza Tem <noreply@kazatem.shop>"
ADMIN_EMAIL=admin@kazatem.shop

# Supabase Storage (para materiais de marketing)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_STORAGE_BUCKET=materials

# ===== FRONTEND =====
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3003
```

---

# SEQUÊNCIA DE DESENVOLVIMENTO

```
FASE 1A → Migration completa do banco (TODAS as tabelas de uma vez)
FASE 1B → Backend: JWT, guards, endpoints de autenticação
FASE 1C → Frontend: contextos de auth, proteção de rotas, login funcional
    ↓
FASE 2  → Backend: todos os endpoints admin
FASE 2  → Frontend: layout admin + dashboard + aprovações + saques + produtos + materiais
    ↓
FASE 3A → Backend: Bling OAuth + sync produtos + cron
FASE 3B → Backend: Magis5 imagens + cron
FASE 3C → Frontend: listagem de produtos + detalhes
FASE 3D → Backend: carrinho (API + sessão)
FASE 3D → Frontend: CartContext + CartDrawer
FASE 3E → Backend: Melhor Envio (cálculo de frete)
FASE 3F → Backend: Cielo pagamento único
FASE 3G → Backend: CreateOrderUseCase (checkout completo)
FASE 3G → Frontend: Checkout 4 etapas
    ↓
FASE 4A → Backend: tracking (/r/:code, cookie, visit)
FASE 4A → Frontend: página /r/[code] + API route cookie
FASE 4B → Backend: GET /resellers/me/dashboard (dados reais)
FASE 4B → Frontend: dashboard revendedor com dados reais
FASE 4C → Backend + Frontend: /reseller/sales
FASE 4D → Backend + Frontend: /reseller/commissions
FASE 4E → Backend + Frontend: /reseller/withdrawals (solicitar + histórico)
FASE 4F → Backend + Frontend: /reseller/coupons
FASE 4G → Frontend: /reseller/materials
FASE 4H → Backend: Cielo recorrência (assinatura)
FASE 4H → Frontend: /reseller/subscription/create + /reseller/subscription
    ↓
FASE 5A → Backend: CalculateCommissionUseCase + handler OrderPaid
FASE 5A → Backend: Cron ReleaseCommissionsJob
FASE 5B → Backend: Webhooks Cielo
FASE 5C → Backend: Cron CancelSuspendedSubscriptionsJob
FASE 5D → Backend: EmailService + todos os templates + todos os handlers
    ↓
FASE 6  → Rate limiting, helmet, validações extras
FASE 6  → Loading/error/empty states em todos os componentes
FASE 6  → Responsividade (admin sidebar drawer, checkout mobile)
FASE 6  → Testes unitários do domínio
```

---

# CHECKLIST DE VALIDAÇÃO FINAL

```
BANCO DE DADOS
[ ] Todas as tabelas criadas via migration
[ ] Índices criados
[ ] system_config populado com valores iniciais

AUTENTICAÇÃO
[ ] Login cliente funciona
[ ] Login revendedor funciona
[ ] Login admin funciona
[ ] JWT válido retornado
[ ] Rotas protegidas rejeitam sem JWT
[ ] /admin/* requer role admin
[ ] /reseller/* requer role reseller ativo

FLUXO PRINCIPAL (E-COMMERCE)
[ ] Produtos do Bling aparecem na listagem
[ ] Imagens do Magis5 carregam nos produtos
[ ] Adicionar ao carrinho funciona
[ ] Frete calculado com Melhor Envio
[ ] Checkout 4 etapas funciona
[ ] Pagamento Cielo processado
[ ] Pedido criado no banco com status 'paid'
[ ] Pedido enviado para o Bling
[ ] Email de confirmação enviado ao cliente

RASTREAMENTO
[ ] /r/PAULO_ABC123 salva cookie e redireciona para home
[ ] Cookie dura 30 dias
[ ] Pedido feito após acessar link → reseller_id vinculado
[ ] Revendedor comprando pelo próprio link → NÃO vincula

REVENDEDORES
[ ] Cadastro salvo com status 'pending'
[ ] Admin vê cadastro na lista de pendentes
[ ] Aprovar gera reseller_code único + email enviado
[ ] Rejeitar com motivo + email enviado
[ ] Após aprovação: login redireciona para criar assinatura
[ ] Assinatura criada com Cielo + status → 'active'
[ ] Dashboard mostra dados reais (sem hardcoded)
[ ] /reseller/sales funciona (sem 404)
[ ] /reseller/materials funciona (sem 404)
[ ] Comissão calculada automaticamente ao pagar pedido
[ ] Comissões liberadas após 30 dias (cron)
[ ] Saque solicitado quando saldo >= R$ 50
[ ] Admin aprova saque → conta a pagar no Bling
[ ] Admin marca pago → email para revendedor
[ ] Cupom criado com limites respeitados
[ ] Cupom aplicado no checkout com desconto correto

ADMIN
[ ] Login admin funciona
[ ] Dashboard com métricas reais
[ ] Aprovar revendedor funciona
[ ] Rejeitar revendedor funciona
[ ] Lista de saques pendentes funciona
[ ] Aprovar saque cria conta no Bling
[ ] Produtos sincronizam do Bling (manual + auto)
[ ] Upload de materiais funciona
[ ] Configurações de comissão persistem e são usadas

AUTOMAÇÃO
[ ] Cron Bling sync → executa a cada hora
[ ] Cron Magis5 → executa todo dia às 03:00
[ ] Cron libera comissões → executa todo dia às 01:00
[ ] Cron cancela inadimplentes → executa todo dia às 02:00
[ ] Webhook Cielo pagamento → processa corretamente
[ ] Webhook Cielo recorrência → suspende em falha
[ ] Todos os emails enviados nos gatilhos corretos

QUALIDADE
[ ] Nenhuma rota retorna 500 em uso normal
[ ] Todos os componentes têm loading state
[ ] Todos os componentes têm error state
[ ] Todos os componentes têm empty state
[ ] Funciona em mobile (testar cada tela)
[ ] Rate limiting em auth endpoints
```

---

*Este documento deve ser usado pela IA Codex como guia de desenvolvimento.*
*O Claude valida cada fase antes de avançar para a próxima.*
*Dúvidas sobre padrões de código: consultar `CLAUDE.md`.*
