# PLANO DE DESENVOLVIMENTO — ENTREGA 5
## Kaza Tem Imports — Tudo que Falta Implementar

> **Baseado em:** Entregas 1–4 + Conversa Original (PDF 51 páginas) + Auditoria do código
> **Arquitetura:** Hexagonal (Ports & Adapters) — seguir CLAUDE.md obrigatoriamente
> **Stack:** NestJS + Fastify + MikroORM + PostgreSQL (Supabase) | Next.js 14 + MUI
> **Regras inegociáveis do CLAUDE.md:**
> - Domain entity nunca tem decorator de framework
> - Controller tem exatamente 1 try-catch por método
> - DI usa Symbols (nunca strings)
> - Unit of Work para transações
> - Frontend: sem `export default` em componentes, sem inline styles

---

## ÍNDICE

1. [SPRINT E5-01: Database + Contexto de Cupons](#sprint-e5-01)
2. [SPRINT E5-02: Contexto de Materiais + Imagens de Produtos](#sprint-e5-02)
3. [SPRINT E5-03: Dados Bancários + Cadastro do Revendedor](#sprint-e5-03)
4. [SPRINT E5-04: Suspend/Reactivate + Admin Pages Completas](#sprint-e5-04)
5. [SPRINT E5-05: E-mails Transacionais + Templates HTML](#sprint-e5-05)
6. [SPRINT E5-06: Frontend Revendedor — Páginas Faltantes](#sprint-e5-06)
7. [SPRINT E5-07: Checkout Completo (CEP + Frete + Cupom)](#sprint-e5-07)
8. [SPRINT E5-08: Comissões + Níveis + Jobs](#sprint-e5-08)
9. [SPRINT E5-09: Design System + Visual Identity](#sprint-e5-09)
10. [SPRINT E5-10: Integrações Finais + QR Code + Validações E2E](#sprint-e5-10)

---

# SPRINT E5-01
## Database: Tabelas Faltantes + Contexto de Cupons

### Objetivo
Criar as tabelas ausentes no banco e implementar o contexto de cupons completo (backend + frontend admin).

---

### 1.1 Migration: Tabelas Faltantes

Adicionar ao arquivo de migration existente (`Migration20260213190000.ts`) ou criar uma nova migration:

```sql
-- PRODUCT IMAGES (imagens de produtos sincronizadas do Magis5/Bling)
CREATE TABLE product_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  position   INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_product_images_product ON product_images(product_id);

-- COUPONS (cupons de desconto)
CREATE TABLE coupons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) UNIQUE NOT NULL,
  reseller_id    UUID REFERENCES resellers(id),  -- NULL = criado pelo admin
  discount_type  VARCHAR(20) NOT NULL,           -- 'percentage' | 'fixed'
  discount_value DECIMAL(10,2) NOT NULL,
  valid_from     TIMESTAMP NOT NULL DEFAULT NOW(),
  valid_until    TIMESTAMP NOT NULL,
  usage_limit    INT,                            -- NULL = ilimitado
  usage_count    INT DEFAULT 0,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_coupons_code     ON coupons(code);
CREATE INDEX idx_coupons_reseller ON coupons(reseller_id);
CREATE INDEX idx_coupons_active   ON coupons(is_active, valid_until);

-- MATERIALS (materiais de marketing)
CREATE TABLE materials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  type        VARCHAR(50) NOT NULL,   -- 'banner' | 'post' | 'video' | 'text' | 'link'
  url         TEXT NOT NULL,          -- URL do arquivo no Supabase Storage
  thumbnail   TEXT,                   -- URL da miniatura
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- WITHDRAWAL_COMMISSIONS (junction table)
CREATE TABLE withdrawal_commissions (
  withdrawal_id UUID NOT NULL REFERENCES withdrawals(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  PRIMARY KEY (withdrawal_id, commission_id)
);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  read       BOOLEAN DEFAULT false,
  data       JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);

-- Adicionar campos de banco aos revendedores (se não existirem)
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS bank_code VARCHAR(10);
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS bank_agency VARCHAR(20);
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS bank_account VARCHAR(30);
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS bank_account_type VARCHAR(20);  -- 'checking' | 'savings'
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS bank_holder_name VARCHAR(255);
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS bank_holder_cpf VARCHAR(14);
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255);
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS pix_key_type VARCHAR(20);  -- 'cpf' | 'email' | 'phone' | 'random'
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS total_sold_year DECIMAL(12,2) DEFAULT 0;
```

---

### 1.2 Contexto de Cupons — Backend

**Estrutura de arquivos:**
```
src/contexts/coupon/
├── domain/
│   ├── entities/coupon.entity.ts
│   ├── value-objects/
│   │   ├── coupon-id.vo.ts
│   │   ├── coupon-code.vo.ts
│   │   └── discount-type.vo.ts
│   ├── events/coupon-applied.event.ts
│   └── exceptions/
│       ├── coupon-not-found.exception.ts
│       ├── coupon-expired.exception.ts
│       ├── coupon-limit-reached.exception.ts
│       └── coupon-already-used.exception.ts
├── application/
│   ├── dto/coupon.dto.ts
│   ├── ports/output/coupon-repository.port.ts
│   └── use-cases/
│       ├── create-coupon/
│       │   ├── create-coupon.command.ts
│       │   └── create-coupon.use-case.ts
│       ├── validate-coupon/
│       │   ├── validate-coupon.query.ts
│       │   └── validate-coupon.use-case.ts
│       ├── apply-coupon/
│       │   ├── apply-coupon.command.ts
│       │   └── apply-coupon.use-case.ts
│       └── list-coupons/
│           ├── list-coupons.query.ts
│           └── list-coupons.use-case.ts
└── coupon.module.ts
```

**Domain Entity — `coupon.entity.ts`:**
```typescript
export class Coupon extends AggregateRoot {
  private constructor(
    private readonly _id: CouponId,
    private readonly _code: CouponCode,
    private readonly _resellerId: string | null,
    private readonly _discountType: DiscountType,
    private readonly _discountValue: number,
    private readonly _validFrom: Date,
    private readonly _validUntil: Date,
    private readonly _usageLimit: number | null,
    private _usageCount: number,
    private _isActive: boolean,
  ) { super(); }

  static create(props: CreateCouponProps): Coupon {
    if (props.discountValue <= 0) throw new Error('Discount value must be positive');
    if (props.validUntil <= props.validFrom) throw new Error('validUntil must be after validFrom');
    if (props.discountType === 'percentage' && props.discountValue > 100) {
      throw new Error('Percentage discount cannot exceed 100%');
    }
    return new Coupon(
      CouponId.generate(),
      CouponCode.from(props.code.toUpperCase()),
      props.resellerId ?? null,
      DiscountType.from(props.discountType),
      props.discountValue,
      props.validFrom,
      props.validUntil,
      props.usageLimit ?? null,
      0,
      true,
    );
  }

  validate(): void {
    const now = new Date();
    if (!this._isActive) throw new CouponExpiredException(this._code.value);
    if (now < this._validFrom || now > this._validUntil) throw new CouponExpiredException(this._code.value);
    if (this._usageLimit !== null && this._usageCount >= this._usageLimit) {
      throw new CouponLimitReachedException(this._code.value);
    }
  }

  calculateDiscount(subtotal: number): number {
    if (this._discountType.value === 'percentage') {
      return Number(((subtotal * this._discountValue) / 100).toFixed(2));
    }
    return Math.min(this._discountValue, subtotal);
  }

  incrementUsage(): void {
    this._usageCount++;
    this.addDomainEvent(new CouponAppliedEvent(this._id.value, this._code.value));
  }

  // getters...
  get id() { return this._id; }
  get code() { return this._code; }
  get discountType() { return this._discountType; }
  get discountValue() { return this._discountValue; }
  get usageCount() { return this._usageCount; }
  get isActive() { return this._isActive; }
  get validUntil() { return this._validUntil; }
}
```

**Use Case — `validate-coupon.use-case.ts`:**
```typescript
@Injectable()
export class ValidateCouponUseCase implements UseCase<ValidateCouponQuery, CouponDto> {
  constructor(
    @Inject(COUPON_REPOSITORY)
    private readonly couponRepository: CouponRepositoryPort,
  ) {}

  async execute(query: ValidateCouponQuery): Promise<CouponDto> {
    const coupon = await this.couponRepository.findByCode(query.code);
    if (!coupon) throw new CouponNotFoundException(query.code);
    coupon.validate(); // throws se expirado, limite atingido, inativo
    return CouponDto.fromDomain(coupon);
  }
}
```

**API Endpoints:**
```typescript
// Admin
POST   /api/admin/coupons          → CreateCouponUseCase
GET    /api/admin/coupons          → ListCouponsUseCase (todos)
PATCH  /api/admin/coupons/:id      → UpdateCouponUseCase (ativar/desativar)
DELETE /api/admin/coupons/:id      → DeactivateCouponUseCase

// Público (checkout)
GET    /api/coupons/validate?code=X → ValidateCouponUseCase

// Revendedor
POST   /api/resellers/coupons      → CreateCouponUseCase (resellerId = auth.resellerId)
GET    /api/resellers/coupons      → ListCouponsUseCase (filtrado por resellerId)
```

**Regras:**
- Código deve ser único, maiúsculo, sem espaços
- Tipo: `percentage` (0-100%) ou `fixed` (R$ fixo)
- Ao aplicar no checkout: `usageCount++`, `discountAmount` calculado sobre o subtotal
- Comissão do revendedor incide sobre `subtotal - discountAmount` (base sem desconto de cupom)

**Checklist SPRINT E5-01:**
- [ ] Criar migration com as 5 novas tabelas + campos de banco em `resellers`
- [ ] ORM Entity `CouponOrmEntity` e campos novos em `ResellerOrmEntity`
- [ ] Atualizar `ResellerMapper` para incluir os campos bancários
- [ ] Domain Entity `Coupon` com validações completas
- [ ] `CouponRepositoryPort` + `MikroOrmCouponRepository`
- [ ] `CouponMapper`
- [ ] Use Cases: create, validate, apply, list
- [ ] `CouponModule` registrado em `app.module.ts`
- [ ] Controllers: admin e público
- [ ] Registrar `CouponController` em `http.module.ts`

---

# SPRINT E5-02
## Contexto de Materiais de Marketing + Imagens de Produtos

### 2.1 Contexto de Materiais — Backend

**Estrutura:**
```
src/contexts/materials/
├── domain/entities/material.entity.ts
├── application/
│   ├── dto/material.dto.ts
│   ├── ports/output/material-repository.port.ts
│   └── use-cases/
│       ├── create-material/...
│       ├── list-materials/...
│       └── delete-material/...
└── materials.module.ts
```

**API Endpoints:**
```typescript
// Admin
POST   /api/admin/materials        → CreateMaterialUseCase (multipart/form-data)
GET    /api/admin/materials        → ListMaterialsUseCase
DELETE /api/admin/materials/:id    → DeleteMaterialUseCase

// Revendedor (autenticado)
GET    /api/materials              → ListMaterialsUseCase (apenas ativos)
```

**Upload para Supabase Storage:**
```typescript
// src/infrastructure/storage/supabase-storage.service.ts
@Injectable()
export class SupabaseStorageService {
  async uploadFile(bucket: string, path: string, file: Buffer, mimeType: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: mimeType, upsert: true });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data: { publicUrl } } = this.supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrl;
  }
}
```

---

### 2.2 Imagens de Produtos — Backend

**ORM Entity:**
```typescript
// src/infrastructure/persistence/mikro-orm/entities/product-image-orm.entity.ts
@Entity({ tableName: 'product_images' })
export class ProductImageOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv4();

  @ManyToOne(() => ProductOrmEntity)
  product!: ProductOrmEntity;

  @Property({ type: 'text' })
  url!: string;

  @Property({ type: 'int', default: 0 })
  position: number = 0;

  @Property({ type: 'boolean', default: false })
  isPrimary: boolean = false;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
```

**Atualizar `ProductOrmEntity`:**
```typescript
@OneToMany(() => ProductImageOrmEntity, image => image.product, { cascade: [Cascade.ALL] })
images = new Collection<ProductImageOrmEntity>(this);
```

**Atualizar sync do Bling/Magis5:**
```typescript
// Ao sincronizar produto, também sincronizar imagens:
async syncProductImages(productId: string, imageUrls: string[]): Promise<void> {
  await this.em.nativeDelete(ProductImageOrmEntity, { product: productId });
  for (let i = 0; i < imageUrls.length; i++) {
    const image = this.em.create(ProductImageOrmEntity, {
      product: productId,
      url: imageUrls[i],
      position: i,
      isPrimary: i === 0,
    });
    this.em.persist(image);
  }
  await this.em.flush();
}
```

**Checklist SPRINT E5-02:**
- [ ] ORM Entity `ProductImageOrmEntity`
- [ ] Relação `images` em `ProductOrmEntity`
- [ ] Atualizar `ProductMapper` para incluir imagens
- [ ] Atualizar endpoint `GET /api/products/:id` para retornar array de imagens
- [ ] Atualizar `GET /api/products` (listagem) para retornar `primaryImage`
- [ ] `SupabaseStorageService` para upload de arquivos
- [ ] Domain Entity `Material` + Repository + UseCase + Controller
- [ ] `MaterialModule` + registrar em `app.module.ts`
- [ ] Integrar `SupabaseStorageService` no upload de materiais
- [ ] Sincronizar imagens no `BlingProductSyncService` / `Magis5Service`

---

# SPRINT E5-03
## Dados Bancários + Formulário de Cadastro do Revendedor

### 3.1 Backend — Atualizar Registro e Perfil do Revendedor

**Atualizar `RegisterResellerCommand`:**
```typescript
export class RegisterResellerCommand {
  constructor(
    public readonly userId: string,
    public readonly cpf: string,
    public readonly fullName: string,
    public readonly phone?: string,
    // Dados bancários opcionais no cadastro (podem ser adicionados depois)
    public readonly bankName?: string,
    public readonly bankCode?: string,
    public readonly bankAgency?: string,
    public readonly bankAccount?: string,
    public readonly bankAccountType?: 'checking' | 'savings',
    public readonly bankHolderName?: string,
    public readonly bankHolderCpf?: string,
    public readonly pixKey?: string,
    public readonly pixKeyType?: 'cpf' | 'email' | 'phone' | 'random',
  ) {}
}
```

**Novos endpoints:**
```typescript
PATCH /api/resellers/bank-info    → UpdateResellerBankInfoUseCase  [ResellerGuard]
GET   /api/resellers/profile      → GetResellerProfileUseCase      [ResellerGuard]
PATCH /api/resellers/profile      → UpdateResellerProfileUseCase   [ResellerGuard]
```

**Use Case — `UpdateResellerBankInfoUseCase`:**
- Recebe: bankName, bankCode, bankAgency, bankAccount, bankAccountType, bankHolderName, bankHolderCpf, pixKey, pixKeyType
- Valida CPF do titular (usando `CPF.create()`)
- Salva via unitOfWork

### 3.2 Frontend — Página de Cadastro do Revendedor

**Criar:** `frontend/app/auth/cadastro/page.tsx`

**Formulário multi-step:**
- **Passo 1 — Dados Pessoais:**
  - Email, Senha (mínimo 8 caracteres)
  - Nome completo
  - CPF (máscara `000.000.000-00`, validação matemática)
  - Telefone (máscara `(00) 00000-0000`)

- **Passo 2 — Dados Bancários (opcional, pode preencher depois):**
  - Banco (select com lista dos principais bancos)
  - Agência, Conta, Tipo de conta
  - Nome do titular, CPF do titular
  - OU: Chave PIX (CPF/email/telefone/aleatória)

- **Passo 3 — Confirmação:**
  - Resumo dos dados
  - Aceite de termos
  - Botão "Finalizar Cadastro"

**Após cadastro:** Redirecionar para página de aguardo:
```
/auth/aguardando-aprovacao
"Seu cadastro foi recebido! Aguarde a aprovação da nossa equipe.
Você receberá um e-mail quando seu cadastro for aprovado."
```

**Checklist SPRINT E5-03:**
- [ ] Atualizar `RegisterResellerCommand` com phone e dados bancários
- [ ] Atualizar `RegisterResellerUseCase` para salvar os novos campos
- [ ] `UpdateResellerBankInfoUseCase` + endpoint `PATCH /api/resellers/bank-info`
- [ ] `GetResellerProfileUseCase` + endpoint `GET /api/resellers/profile`
- [ ] Frontend: página `/auth/cadastro` com formulário multi-step
- [ ] Máscara de CPF e telefone (biblioteca: `react-imask` ou `react-input-mask`)
- [ ] Validação matemática de CPF no frontend
- [ ] Página `/auth/aguardando-aprovacao`
- [ ] Frontend: página `/reseller/profile` para editar dados bancários

---

# SPRINT E5-04
## Admin — Páginas Completas + Suspend/Reactivate

### 4.1 Backend — Use Cases Faltantes

**`SuspendResellerUseCase`:**
```typescript
// POST /api/admin/resellers/:id/suspend  [AdminGuard]
// Body: { reason: string }
// 1. Buscar revendedor
// 2. Validar: status === 'approved' ou 'active'
// 3. reseller.suspend(adminId, reason)
// 4. Cancelar assinatura Cielo (se existir)
// 5. Emitir ResellerSuspendedEvent → email notificando revendedor
// 6. Salvar via unitOfWork
```

**`ReactivateResellerUseCase`:**
```typescript
// POST /api/admin/resellers/:id/reactivate  [AdminGuard]
// 1. Buscar revendedor
// 2. Validar: status === 'suspended'
// 3. reseller.reactivate(adminId)
// 4. Emitir ResellerReactivatedEvent → email notificando revendedor
// 5. Salvar via unitOfWork
```

**`RefundOrderUseCase`:**
```typescript
// POST /api/admin/orders/:id/refund  [AdminGuard]
// Body: { amount?: number }  (parcial ou total)
// 1. Buscar pedido
// 2. Verificar status === 'paid' ou 'processing'
// 3. Chamar Cielo void: cieloClient.cancelPayment(order.cieloPaymentId, amount)
// 4. Atualizar status do pedido para 'canceled'
// 5. Reverter comissão: commission.reverse()
// 6. Emitir OrderRefundedEvent → email para cliente
```

**Admin resellers listing com filtros:**
```typescript
// GET /api/admin/resellers?page=1&limit=20&status=X&level=X&search=X
// Query com JOIN em users, LEFT JOIN em subscriptions, GROUP BY para totais
```

### 4.2 Frontend Admin — Páginas Completas

**`/admin/aprovacoes` — Nova página (diferente de `/admin/revendedores/pendentes`):**
```typescript
// Tabela: Nome | CPF | Email | Telefone | Data cadastro | Ações
// Botão "Analisar" → abre Dialog com:
//   - Dados pessoais completos
//   - Dados bancários (banco, agência, conta, tipo, titular)
//   - Botão APROVAR (verde) com confirmação
//   - Botão REJEITAR (vermelho) com campo de motivo obrigatório (min 10 chars)
//   - Botão CANCELAR (cinza)
// Skeleton loading enquanto carrega
// Estado vazio: ícone CheckCircle + "Nenhum cadastro pendente"
```

**`/admin/revendedores` — Lista completa:**
```typescript
// Filtros: status (chips), level (chips), busca textual
// Tabela: Nome | CPF | Email | Nível (Chip colorido) | Status (Chip) | Total Vendido | Data
// Ações: Ver Detalhes | Suspender | Reativar
// Paginação com total e totalPages
```

**`/admin/revendedores/[id]` — Detalhe completo:**
```typescript
// Seções:
// 1. Dados pessoais + status + nível
// 2. Dados bancários (banco, agência, conta, PIX)
// 3. Status da assinatura (ativa/suspensa/cancelada, próximo pagamento)
// 4. Métricas: total pedidos, total vendido, comissões disponíveis, comissões sacadas
// 5. Histórico de saques (lista)
// 6. Botões: Suspender / Reativar (conforme status atual)
```

**`/admin/pedidos/[id]` — Detalhe do pedido:**
```typescript
// Itens do pedido (nome, SKU, qtd, preço unitário, total)
// Dados do cliente (nome, CPF, email, telefone)
// Endereço de entrega
// Dados de pagamento (ID Cielo, método, parcelas)
// Rastreamento (código + link transportadora)
// Botões: Adicionar código de rastreio | Estornar pagamento
```

**`/admin/configuracoes` — Funcional:**
```typescript
// Seção 1: Integração Bling
//   - Status: "Conectado ✅" ou "Não conectado ❌"
//   - Botão "Conectar ao Bling" → redireciona para URL OAuth Bling
//   - Botão "Desconectar"

// Seção 2: Regras de Comissão
//   - Tabela editável: Faixa | Percentual
//   - Ex: R$ 0 - R$ 1.000 → 10%
//   - Botão "Salvar regras"

// Seção 3: Informações da empresa
//   - Razão social, CNPJ, email, telefone
```

**Checklist SPRINT E5-04:**
- [ ] `SuspendResellerUseCase` + endpoint `POST /api/admin/resellers/:id/suspend`
- [ ] `ReactivateResellerUseCase` + endpoint `POST /api/admin/resellers/:id/reactivate`
- [ ] `RefundOrderUseCase` + endpoint `POST /api/admin/orders/:id/refund`
- [ ] Endpoint Bling OAuth: `GET /api/admin/bling/auth-url` e `GET /api/admin/bling/status`
- [ ] Frontend: `/admin/aprovacoes` com modal completo de análise
- [ ] Frontend: `/admin/revendedores` com filtros e paginação real
- [ ] Frontend: `/admin/revendedores/[id]` com dados bancários e métricas
- [ ] Frontend: `/admin/pedidos/[id]` com detalhe e ações
- [ ] Frontend: `/admin/configuracoes` funcional (Bling OAuth + comissões)
- [ ] Frontend: Botão de estorno na página de detalhe do pedido

---

# SPRINT E5-05
## E-mails Transacionais — Templates HTML

### 5.1 Estrutura de Templates

**Criar:** `src/infrastructure/messaging/email/templates/`

```
templates/
├── base.template.ts           (layout base com header/footer da Kaza Tem)
├── reseller-approved.html
├── reseller-rejected.html
├── reseller-suspended.html
├── order-confirmed.html
├── order-shipped.html
├── commission-available.html
├── withdrawal-approved.html
├── withdrawal-rejected.html
├── withdrawal-paid.html
└── welcome-reseller.html
```

**`EmailTemplateService`:**
```typescript
@Injectable()
export class EmailTemplateService {
  render(templateName: string, variables: Record<string, string | number>): string {
    let template = this.loadTemplate(templateName);
    for (const [key, value] of Object.entries(variables)) {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return template;
  }

  private loadTemplate(name: string): string {
    const path = join(__dirname, 'templates', `${name}.html`);
    return readFileSync(path, 'utf-8');
  }
}
```

### 5.2 Event Handlers

**Criar/completar os seguintes handlers:**

```typescript
// src/contexts/reseller/event-handlers/reseller-event-handlers.ts

@OnEvent('reseller.approved')
async onResellerApproved(event: ResellerApprovedEvent) {
  const html = this.templateService.render('reseller-approved', {
    name: event.fullName,
    resellerCode: event.resellerCode,
    link: `https://kazatem.shop/r/${event.resellerCode}`,
    subscriptionUrl: `https://kazatem.shop/reseller/subscription/create`,
  });
  await this.emailService.sendMail(event.email, '✅ Cadastro aprovado! Crie sua assinatura', html);
}

@OnEvent('reseller.rejected')
async onResellerRejected(event: ResellerRejectedEvent) {
  const html = this.templateService.render('reseller-rejected', {
    name: event.fullName,
    reason: event.reason,
  });
  await this.emailService.sendMail(event.email, 'Sobre seu cadastro na Kaza Tem', html);
}

@OnEvent('order.paid')
async onOrderPaid(event: OrderPaidEvent) {
  const html = this.templateService.render('order-confirmed', {
    customerName: event.customerName,
    orderNumber: event.orderNumber,
    total: event.total,
    estimatedDays: event.estimatedDays,
  });
  await this.emailService.sendMail(event.customerEmail, `Pedido #${event.orderNumber} confirmado!`, html);
}

@OnEvent('order.shipped')
async onOrderShipped(event: OrderShippedEvent) { /* ... */ }

@OnEvent('commission.available')
async onCommissionAvailable(event: CommissionAvailableEvent) { /* ... */ }

@OnEvent('withdrawal.approved')
async onWithdrawalApproved(event: WithdrawalApprovedEvent) { /* ... */ }
```

**Checklist SPRINT E5-05:**
- [ ] `EmailTemplateService` com método `render()`
- [ ] Templates HTML para: approved, rejected, suspended, order-confirmed, order-shipped, commission-available, withdrawal-approved, withdrawal-rejected, withdrawal-paid
- [ ] Event handler para `ResellerApprovedEvent` → email com link para criar assinatura
- [ ] Event handler para `ResellerRejectedEvent` → email com motivo
- [ ] Event handler para `OrderPaidEvent` → email de confirmação para cliente
- [ ] Event handler para `OrderShippedEvent` → email com código de rastreio
- [ ] Event handler para `CommissionAvailableEvent` → email de notificação
- [ ] Event handler para `WithdrawalApprovedEvent/RejectedEvent/PaidEvent`
- [ ] Testar envio real com configuração SMTP

---

# SPRINT E5-06
## Frontend Revendedor — Páginas Faltantes

### 6.1 `/reseller/sales` — Histórico de Vendas

```typescript
// Tabela paginada de pedidos do revendedor:
// Colunas: Nº Pedido | Cliente | Produtos (lista resumida) | Total | Comissão | Status | Data
// Filtros: por status (chips), por período (date picker)
// API: GET /api/resellers/orders?page=1&status=X&from=X&to=X

// Backend faltante:
// ListResellerOrdersUseCase
// GET /api/resellers/orders [ResellerGuard]
```

### 6.2 `/reseller/materials` — Materiais de Marketing

```typescript
// Grid de materiais:
// Cada card: thumbnail + título + tipo (badge) + botão Download
// Filtros por tipo: banner | post | vídeo | texto | link
// API: GET /api/materials [ResellerGuard]
// Depende do SPRINT E5-02 (contexto de materiais)
```

### 6.3 `/reseller/profile` — Perfil e Dados Bancários

```typescript
// Seção 1: Dados pessoais
//   - Nome, CPF (readonly), email, telefone
//   - Botão "Editar perfil"

// Seção 2: Dados bancários
//   - Banco, agência, conta, tipo, titular
//   - OU: Chave PIX
//   - Botão "Atualizar dados bancários"

// Seção 3: Informações de revendedor
//   - Código: PAULO_ABCD1234 (readonly)
//   - Nível: Bronze / Prata / Ouro (com progresso para próximo nível)
//   - Data de aprovação
```

### 6.4 `/reseller/coupons` — Meus Cupons

```typescript
// Lista de cupons do revendedor
// Botão "Criar novo cupom" → modal com:
//   - Código (sugestão automática baseada no nome)
//   - Tipo: percentual ou fixo
//   - Valor do desconto
//   - Data de validade
//   - Limite de uso (opcional)
// Cada cupom: código (botão copiar) | tipo | desconto | usos | validade | status
// Depende do SPRINT E5-01 (contexto de cupons)
```

### 6.5 Dashboard — Corrigir Dados Hardcoded

```typescript
// Remover INITIAL_DATA com "Paulo Oliveira"
// Mostrar loading skeleton enquanto API não responde
// Gráfico de comissões por semana (Recharts LineChart)
// Tabela: últimas 10 vendas
// Card: próximo nível com barra de progresso (dados reais)

// Instalar: npm install recharts
```

### 6.6 Dashboard — QR Code do Link de Afiliado

```typescript
// Componente AffiliateLink:
import { QRCodeSVG } from 'qrcode.react';

export function AffiliateLink({ code }: { code: string }) {
  const url = `https://kazatem.shop/r/${code}`;

  function handleCopy() {
    navigator.clipboard.writeText(url);
    // snackbar "Link copiado!"
  }

  return (
    <Box>
      <Typography>Seu link exclusivo:</Typography>
      <Typography fontWeight="bold">{url}</Typography>
      <Button onClick={handleCopy}>Copiar link</Button>
      <QRCodeSVG value={url} size={200} />
      {/* Botão download QR como PNG */}
    </Box>
  );
}

// Instalar: npm install qrcode.react
```

**Checklist SPRINT E5-06:**
- [ ] Backend: `ListResellerOrdersUseCase` + `GET /api/resellers/orders`
- [ ] Frontend: `/reseller/sales` — tabela paginada com filtros
- [ ] Frontend: `/reseller/materials` — grid de materiais (depende E5-02)
- [ ] Frontend: `/reseller/profile` — editar dados pessoais e bancários
- [ ] Frontend: `/reseller/coupons` — criar e listar cupons (depende E5-01)
- [ ] Frontend: corrigir dados hardcoded do dashboard
- [ ] Frontend: `AffiliateLink` com QR Code (`qrcode.react`)
- [ ] Frontend: gráficos com Recharts (`npm install recharts`)
- [ ] Instalar dependências: `qrcode.react`, `recharts`

---

# SPRINT E5-07
## Checkout Completo: CEP + Frete + Cupom

### 7.1 CEP Lookup — ViaCEP

**Frontend — etapa de endereço do checkout:**
```typescript
async function lookupCep(cep: string) {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) throw new Error('CEP não encontrado');

    setValue('street', data.logradouro);
    setValue('neighborhood', data.bairro);
    setValue('city', data.localidade);
    setValue('state', data.uf);
  } catch {
    setError('cep', { message: 'CEP inválido ou não encontrado' });
  }
}
```

### 7.2 Cálculo de Frete — Melhor Envio

**Frontend — após preencher CEP:**
```typescript
async function calculateShipping(cep: string, items: CartItem[]) {
  const response = await api.post('/api/shipping/calculate', {
    destinationZip: cep,
    items: items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
  });
  setShippingOptions(response.data);  // Array de { service, carrier, price, days }
}
```

**Frontend — exibir opções:**
```typescript
// RadioGroup com opções:
// PAC - Correios  →  R$ 18,50  |  5-8 dias úteis
// SEDEX - Correios → R$ 35,00  |  1-3 dias úteis
// Loggi Express   → R$ 25,00  |  2-4 dias úteis
```

### 7.3 Cupom no Checkout

**Frontend — etapa de revisão:**
```typescript
// Campo de cupom com botão "Aplicar"
// Ao clicar: GET /api/coupons/validate?code=CUPOM123
// Se válido: mostrar desconto aplicado no resumo
// Resumo:
//   Subtotal:    R$ 250,00
//   Desconto:   -R$  25,00  (cupom PROMO10)
//   Frete:       R$  18,50
//   Total:       R$ 243,50
```

**Backend — aplicar cupom ao criar pedido:**
```typescript
// Em CreateOrderUseCase, se couponCode fornecido:
// 1. ValidateCouponUseCase → validar
// 2. coupon.calculateDiscount(subtotal) → discountAmount
// 3. Salvar couponCode e discountAmount no pedido
// 4. coupon.incrementUsage() → salvar cupom atualizado
// 5. Calcular comissão sobre (subtotal - discountAmount)
```

### 7.4 Cookie do Revendedor — Validar Fluxo

**Frontend — `/r/[link]/page.tsx`:** Verificar se está setando cookie corretamente:
```typescript
// Deve setar cookie httpOnly via API (não via document.cookie)
// POST /api/tracking/set-reseller-cookie  body: { code: PAULO_ABCD1234 }
// Backend seta: res.setCookie('reseller_code', code, { httpOnly: true, maxAge: 30*24*60*60 })
```

**Backend — ao criar pedido:** Verificar se lê o cookie:
```typescript
// Em CreateOrderController:
const resellerCode = request.cookies['reseller_code'];
const command = new CreateOrderCommand({ ..., resellerCode });
```

**Checklist SPRINT E5-07:**
- [ ] Frontend: CEP lookup com ViaCEP na etapa de endereço
- [ ] Frontend: exibir opções de frete após preencher CEP
- [ ] Frontend: campo de cupom na etapa de revisão
- [ ] Backend: `CreateOrderUseCase` — integrar validação e aplicação de cupom
- [ ] Backend: validar e confirmar fluxo do cookie de rastreamento
- [ ] Backend: `CreateOrderController` lendo cookie `reseller_code`
- [ ] Testar fluxo completo: link → cookie → compra → pedido vinculado → comissão calculada

---

# SPRINT E5-08
## Comissões + Níveis + Jobs Agendados

### 8.1 Jobs Agendados

**Instalar scheduler (se não instalado):**
```bash
npm install @nestjs/schedule
```

**`check-levels.job.ts` — novo job:**
```typescript
@Injectable()
export class CheckLevelUpgradeJob {
  @Cron('0 1 * * *')  // Todo dia às 01:00
  async run() {
    await this.checkLevelUpgradeUseCase.execute();
  }
}
```

**`release-commissions.job.ts`:**
```typescript
@Injectable()
export class ReleaseCommissionsJob {
  @Cron('0 6 * * *')  // Todo dia às 06:00
  async run() {
    await this.releasePendingCommissionsUseCase.execute();
  }
}
```

### 8.2 CheckLevelUpgradeUseCase — Implementar

```typescript
// Verifica todos os revendedores ativos
// Calcula vendas no mês corrente
// Aplica regras de nível (CONFIRMAR com usuário qual regra usar):
//   OPÇÃO A (mensal): > R$5.000/mês → prata | > R$15.000/mês → ouro
//   OPÇÃO B (anual):  > R$50.000 acumulado → prata | > R$150.000 → ouro
// Se mudou de nível: reseller.upgradeLevel(newLevel)
// Emite ResellerLevelChangedEvent → email de parabéns
```

### 8.3 Reverter Comissão em Cancelamento

**Event handler para `OrderCanceledEvent`:**
```typescript
@OnEvent('order.canceled')
async onOrderCanceled(event: OrderCanceledEvent) {
  const commission = await this.commissionRepository.findByOrderId(event.orderId);
  if (commission && commission.status !== 'withdrawn') {
    commission.reverse();  // status → 'reversed'
    await this.commissionRepository.save(commission);
  }
}
```

### 8.4 Atualizar `total_sold_year` do Revendedor

**Event handler para `OrderPaidEvent`:**
```typescript
@OnEvent('order.paid')
async updateTotalSoldYear(event: OrderPaidEvent) {
  if (!event.resellerId) return;
  await this.em.getKnex().raw(
    'UPDATE resellers SET total_sold_year = total_sold_year + ? WHERE id = ?',
    [event.orderTotal, event.resellerId]
  );
}
```

**Checklist SPRINT E5-08:**
- [ ] Instalar e configurar `@nestjs/schedule` no `app.module.ts`
- [ ] Job `ReleaseCommissionsJob` com `@Cron('0 6 * * *')`
- [ ] Job `CheckLevelUpgradeJob` com `@Cron('0 1 * * *')`
- [ ] Job `CheckSuspendedSubscriptionsJob` — verificar se já está configurado
- [ ] `CheckLevelUpgradeUseCase` com a regra correta de progressão
- [ ] Event handler: `OrderCanceledEvent` → reverter comissão
- [ ] Event handler: `OrderPaidEvent` → atualizar `total_sold_year`
- [ ] Event handler: `ResellerLevelChangedEvent` → email de parabéns

---

# SPRINT E5-09
## Design System — Validação e Ajustes do Frontend

### 9.1 MUI Theme Customizado

**Verificar/criar `frontend/styles/theme.ts`:**
```typescript
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary:   { main: '#FFE600', contrastText: '#333333' },
    secondary: { main: '#3483FA', contrastText: '#FFFFFF' },
    success:   { main: '#00A650' },
    error:     { main: '#F23D4F' },
    warning:   { main: '#FF6900' },
    background: { default: '#F5F5F5', paper: '#FFFFFF' },
    text: { primary: '#333333', secondary: '#666666' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '2.5rem' },
    h2: { fontWeight: 700, fontSize: '2rem' },
    h4: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          backgroundColor: '#FFE600',
          color: '#333',
          '&:hover': { backgroundColor: '#F0D800' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
        },
      },
    },
  },
});
```

### 9.2 Componentes a Revisar

**Header:**
- Background `#FFE600`, sticky, sombra ao scroll
- Logo Kaza Tem à esquerda
- Barra de busca no centro
- Ícones de carrinho + login à direita

**ProductCard:**
- Imagem principal (ou placeholder)
- Badge de desconto (vermelho, posição absoluta)
- Badge "Frete Grátis" (verde, quando aplicável)
- Preço original tachado + preço com desconto
- Hover: `translateY(-4px)` + sombra

**Skeleton Loading:**
- Todas as telas que fazem fetch devem ter skeleton
- Usar `<Skeleton variant="rectangular" />` do MUI

### 9.3 Fonte Roboto

**`frontend/app/layout.tsx`:**
```typescript
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={roboto.className}>
      {/* ... */}
    </html>
  );
}
```

**Checklist SPRINT E5-09:**
- [ ] Criar/atualizar `theme.ts` com a paleta completa definida na conversa original
- [ ] Importar `Roboto` via `next/font/google` no `layout.tsx`
- [ ] Validar Header: background `#FFE600`, sticky com sombra
- [ ] Validar ProductCard: hover effects, badges de desconto/frete grátis
- [ ] Adicionar imagens nos ProductCards (campo `primaryImage`)
- [ ] Adicionar skeleton loading em todas as páginas com fetch
- [ ] Validar responsividade mobile do catálogo (2 colunas no mobile)
- [ ] Corrigir Dashboard Admin: botões, cores, tipografia conforme design system

---

# SPRINT E5-10
## Integrações Finais + Rastreamento + QR Code + E2E

### 10.1 Rastreamento de Pedido — Página Pública

**Criar:** `frontend/app/track/page.tsx`

```typescript
// Formulário: Número do Pedido + CPF do cliente
// Botão "Rastrear"
// Exibe: status atual | código de rastreio | link transportadora | histórico de status
// API: GET /api/orders/track?orderNumber=X&cpf=Y (sem auth)
```

**Backend:**
```typescript
// GET /api/orders/track  [sem guard]
// 1. Buscar pedido por orderNumber e customerCpf (privacidade)
// 2. Retornar: status, trackingCode, shippingCarrier, estimatedDays, items (apenas nomes)
// 3. Se trackingCode: fazer request para Melhor Envio e retornar eventos de rastreio
```

### 10.2 Etiqueta de Envio (Melhor Envio)

```typescript
// Quando admin marca pedido como "enviado" e adiciona tracking code:
// GenerateShippingLabelUseCase → chama Melhor Envio API
// Salva tracking code no pedido
// Emite OrderShippedEvent → email para cliente com tracking
```

### 10.3 Webhook Cielo — Subscription

```typescript
// Handler para eventos de recorrência Cielo:
// RecurrentPaymentCanceled → suspender revendedor
// RecurrentPaymentReactivated → reativar revendedor

// Em cielo-webhook.service.ts:
case 'RecurrentPaymentCanceled':
  await this.suspendResellerBySubscriptionUseCase.execute(event.orderId);
  break;
```

### 10.4 Supabase Realtime — Notificações

```typescript
// Frontend (dashboard revendedor e admin):
const subscription = supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    showNotification(payload.new);
    incrementUnreadCount();
  })
  .subscribe();

// Componente NotificationBell no header com badge de contagem
```

### 10.5 Validação End-to-End

**Fluxos para testar:**
1. Revendedor se cadastra → aguarda aprovação → admin aprova → email enviado → revendedor cria assinatura
2. Cliente acessa `/r/PAULO_ABC` → cookie setado → navega catálogo → aplica cupom → calcula frete → finaliza compra → pedido criado → comissão calculada
3. Admin vê pedido → adiciona tracking → cliente recebe email → revendedor vê comissão pendente
4. 30 dias passam (simular) → comissão disponível → revendedor solicita saque → admin aprova → Bling recebe conta a pagar

**Checklist SPRINT E5-10:**
- [ ] Página pública `/track` de rastreamento de pedido
- [ ] Backend: `GET /api/orders/track` sem autenticação
- [ ] `GenerateShippingLabelUseCase` ao marcar pedido como enviado
- [ ] Webhook Cielo para suspensão/reativação de assinatura
- [ ] Notificações Supabase Realtime no frontend
- [ ] Componente `NotificationBell` no header
- [ ] Teste end-to-end do fluxo completo de compra
- [ ] Teste end-to-end do fluxo de saque

---

## RESUMO DE DEPENDÊNCIAS

```
E5-01 (Cupons + Migration)
  ↓
E5-02 (Materiais + Imagens)    E5-03 (Dados Bancários + Cadastro)
  ↓                                   ↓
E5-04 (Admin completo) ←──────────────┘
  ↓
E5-05 (E-mails)
  ↓
E5-06 (Frontend Revendedor) ←── depende E5-01 (cupons) + E5-02 (materiais)
  ↓
E5-07 (Checkout: CEP + Frete + Cupom) ←── depende E5-01 (cupons)
  ↓
E5-08 (Comissões + Níveis + Jobs)
  ↓
E5-09 (Design System)
  ↓
E5-10 (Integrações + E2E)
```

---

## CHECKLIST CONSOLIDADO

### Backend
- [ ] Migration com tabelas: `product_images`, `coupons`, `materials`, `withdrawal_commissions`, `notifications` + campos banco em `resellers`
- [ ] Contexto Coupon completo (entity, repo, use cases, controller, module)
- [ ] Contexto Materials completo
- [ ] ORM Entity `ProductImageOrmEntity` + relação em `ProductOrmEntity`
- [ ] `SupabaseStorageService` para uploads
- [ ] `UpdateResellerBankInfoUseCase` + endpoint
- [ ] `SuspendResellerUseCase` + endpoint
- [ ] `ReactivateResellerUseCase` + endpoint
- [ ] `RefundOrderUseCase` + endpoint
- [ ] `ListResellerOrdersUseCase` + endpoint
- [ ] `CheckLevelUpgradeUseCase` + Job agendado
- [ ] Job agendado `ReleaseCommissionsJob`
- [ ] `EmailTemplateService` + templates HTML
- [ ] Event handlers para todos os eventos
- [ ] Bling OAuth endpoints (auth-url, status)
- [ ] Rastreamento público de pedido

### Frontend
- [ ] Tema MUI completo com paleta definida
- [ ] Fonte Roboto via `next/font/google`
- [ ] Header amarelo sticky com sombra
- [ ] ProductCard com hover + imagem + badges
- [ ] Skeleton loading em todas as telas
- [ ] `/auth/cadastro` — formulário multi-step do revendedor
- [ ] `/auth/aguardando-aprovacao`
- [ ] `/reseller/profile`
- [ ] `/reseller/sales`
- [ ] `/reseller/materials`
- [ ] `/reseller/coupons`
- [ ] `/reseller/dashboard` — corrigir hardcoded + gráficos + QR Code
- [ ] `/admin/aprovacoes` — modal completo
- [ ] `/admin/revendedores` — filtros e paginação real
- [ ] `/admin/configuracoes` — Bling OAuth + comissões
- [ ] `/admin/pedidos/[id]` — detalhe com estorno
- [ ] `/track` — rastreamento público
- [ ] Checkout: CEP lookup, opções de frete, campo de cupom
- [ ] Instalar: `recharts`, `qrcode.react`, `react-imask`

---

*Próximo documento: [PENDENCIAS_COMPLETAS.md](./PENDENCIAS_COMPLETAS.md)*
*Referência obrigatória: [CLAUDE.md](../../../../CLAUDE.md)*
