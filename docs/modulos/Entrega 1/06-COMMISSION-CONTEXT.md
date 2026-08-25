# Módulo 06: COMMISSION CONTEXT

**Prioridade:** ALTA
**Dependências:** Order Context, Analytics Context
**Estimativa:** Backend completo

---

## Objetivo

Implementar o sistema de comissões por faixas progressivas com período de carência de 30 dias.

---

## 1. Regras de Negócio

### 1.1 Faixas de Comissão (Reset Mensal)

| Faixa | Vendas no Mês | Comissão |
|-------|---------------|----------|
| Bronze | R$ 0 - R$ 1.000 | 10% |
| Prata | R$ 1.001 - R$ 5.000 | 15% |
| Ouro | R$ 5.001 - R$ 10.000 | 20% |
| Diamante | R$ 10.001+ | 25% |

### 1.2 Período de Carência

- Quando um pedido é **PAGO**, a comissão é calculada com status `pending`
- Após **30 dias**, o status muda para `available`
- Somente comissões `available` podem ser sacadas

### 1.3 Base de Cálculo

```
Comissão = (Valor do Pedido - Frete) × Percentual da Faixa
```

---

## 2. Estrutura de Pastas

```
apps/kaza-tem-system/backend/src/contexts/commission/
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
│   │   └── commission-available.event.ts
│   └── exceptions/
│       └── commission-not-found.exception.ts
├── application/
│   ├── dto/
│   │   ├── commission.dto.ts
│   │   └── commission-balance.dto.ts
│   ├── ports/
│   │   └── output/
│   │       ├── commission-repository.port.ts
│   │       └── commission-rule-repository.port.ts
│   └── use-cases/
│       ├── calculate-commission-for-order/
│       ├── get-reseller-balance/
│       ├── get-commission-history/
│       ├── release-pending-commissions/ (cron)
│       └── configure-commission-rules/ (admin)
└── commission.module.ts
```

---

## 3. Entidades de Domínio

### 3.1 Commission Entity

```typescript
// domain/entities/commission.entity.ts
import { AggregateRoot } from '@gitspread/domain-primitives';
import { CommissionId } from '../value-objects/commission-id.vo';
import { CommissionStatus } from '../value-objects/commission-status.vo';

export class Commission extends AggregateRoot {
  private constructor(
    private readonly _id: CommissionId,
    private readonly _resellerId: string,
    private readonly _orderId: string,
    private readonly _orderTotal: number,
    private readonly _commissionBase: number, // orderTotal - shipping
    private readonly _percentage: number,
    private readonly _amount: number,
    private _status: CommissionStatus,
    private _availableAt: Date,
    private _withdrawnAt: Date | null,
    private _withdrawalId: string | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static calculate(props: {
    resellerId: string;
    orderId: string;
    orderTotal: number;
    shippingCost: number;
    percentage: number;
  }): Commission {
    const id = CommissionId.generate();
    const commissionBase = props.orderTotal - props.shippingCost;
    const amount = commissionBase * (props.percentage / 100);

    // Disponível após 30 dias
    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + 30);

    return new Commission(
      id,
      props.resellerId,
      props.orderId,
      props.orderTotal,
      commissionBase,
      props.percentage,
      Math.round(amount * 100) / 100, // Round to 2 decimals
      CommissionStatus.PENDING,
      availableAt,
      null,
      null,
      new Date(),
    );
  }

  // Getters
  get id(): CommissionId { return this._id; }
  get resellerId(): string { return this._resellerId; }
  get orderId(): string { return this._orderId; }
  get amount(): number { return this._amount; }
  get status(): CommissionStatus { return this._status; }
  get availableAt(): Date { return this._availableAt; }
  get percentage(): number { return this._percentage; }

  // Business methods
  release(): void {
    if (this._status.value !== 'pending') {
      throw new Error('Only pending commissions can be released');
    }
    this._status = CommissionStatus.AVAILABLE;
  }

  markAsWithdrawn(withdrawalId: string): void {
    if (this._status.value !== 'available') {
      throw new Error('Only available commissions can be withdrawn');
    }
    this._status = CommissionStatus.WITHDRAWN;
    this._withdrawnAt = new Date();
    this._withdrawalId = withdrawalId;
  }

  isReadyToRelease(): boolean {
    return this._status.value === 'pending' && new Date() >= this._availableAt;
  }
}
```

### 3.2 Commission Rule Entity

```typescript
// domain/entities/commission-rule.entity.ts
export class CommissionRule {
  constructor(
    public readonly id: string,
    public readonly minAmount: number,
    public readonly maxAmount: number | null,
    public readonly percentage: number,
    public readonly isActive: boolean,
  ) {}

  matches(monthlySales: number): boolean {
    if (monthlySales < this.minAmount) return false;
    if (this.maxAmount !== null && monthlySales > this.maxAmount) return false;
    return this.isActive;
  }
}
```

---

## 4. Use Cases

### 4.1 Calculate Commission For Order

```typescript
// use-cases/calculate-commission-for-order/calculate-commission-for-order.use-case.ts
@Injectable()
export class CalculateCommissionForOrderUseCase {
  constructor(
    @Inject(COMMISSION_REPOSITORY)
    private readonly commissionRepository: CommissionRepositoryPort,
    @Inject(COMMISSION_RULE_REPOSITORY)
    private readonly ruleRepository: CommissionRuleRepositoryPort,
  ) {}

  async execute(command: {
    resellerId: string;
    orderId: string;
    orderTotal: number;
    shippingCost: number;
  }): Promise<CommissionDto> {
    // 1. Buscar vendas do mês do revendedor
    const monthlySales = await this.commissionRepository.getResellerMonthlySales(
      command.resellerId,
    );

    // 2. Determinar faixa de comissão
    const rules = await this.ruleRepository.findActive();
    const applicableRule = rules.find(rule => rule.matches(monthlySales + command.orderTotal));

    if (!applicableRule) {
      throw new Error('No commission rule found');
    }

    // 3. Calcular comissão
    const commission = Commission.calculate({
      resellerId: command.resellerId,
      orderId: command.orderId,
      orderTotal: command.orderTotal,
      shippingCost: command.shippingCost,
      percentage: applicableRule.percentage,
    });

    // 4. Salvar
    const saved = await this.commissionRepository.save(commission);

    return CommissionDto.fromDomain(saved);
  }
}
```

### 4.2 Get Reseller Balance

```typescript
// use-cases/get-reseller-balance/get-reseller-balance.use-case.ts
export interface CommissionBalanceDto {
  pending: number;
  available: number;
  withdrawn: number;
  total: number;
}

@Injectable()
export class GetResellerBalanceUseCase {
  constructor(
    @Inject(COMMISSION_REPOSITORY)
    private readonly repository: CommissionRepositoryPort,
  ) {}

  async execute(resellerId: string): Promise<CommissionBalanceDto> {
    return this.repository.getBalance(resellerId);
  }
}
```

### 4.3 Release Pending Commissions (Cron)

```typescript
// use-cases/release-pending-commissions/release-pending-commissions.use-case.ts
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ReleasePendingCommissionsUseCase {
  constructor(
    @Inject(COMMISSION_REPOSITORY)
    private readonly repository: CommissionRepositoryPort,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async execute(): Promise<number> {
    // Buscar comissões pendentes com availableAt <= now
    const pendingCommissions = await this.repository.findReadyToRelease();

    let releasedCount = 0;
    for (const commission of pendingCommissions) {
      commission.release();
      await this.repository.save(commission);
      releasedCount++;
    }

    return releasedCount;
  }
}
```

---

## 5. Migration SQL

```sql
-- commission_rules
CREATE TABLE commission_rules (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  min_amount DECIMAL(10,2) NOT NULL,
  max_amount DECIMAL(10,2) NULL,
  percentage DECIMAL(5,2) NOT NULL,
  is_active BIT DEFAULT 1,
  created_at DATETIME2 DEFAULT GETDATE()
);

-- commissions
CREATE TABLE commissions (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  reseller_id UNIQUEIDENTIFIER NOT NULL,
  order_id UNIQUEIDENTIFIER NOT NULL,
  order_total DECIMAL(10,2) NOT NULL,
  commission_base DECIMAL(10,2) NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  available_at DATETIME2 NOT NULL,
  withdrawn_at DATETIME2 NULL,
  withdrawal_id UNIQUEIDENTIFIER NULL,
  created_at DATETIME2 DEFAULT GETDATE(),

  CONSTRAINT FK_commissions_reseller FOREIGN KEY (reseller_id) REFERENCES resellers(id),
  CONSTRAINT FK_commissions_order FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IX_commissions_reseller ON commissions(reseller_id);
CREATE INDEX IX_commissions_status ON commissions(status);
CREATE INDEX IX_commissions_available ON commissions(available_at);

-- Inserir regras padrão
INSERT INTO commission_rules (min_amount, max_amount, percentage) VALUES
(0, 1000, 10),
(1000.01, 5000, 15),
(5000.01, 10000, 20),
(10000.01, NULL, 25);
```

---

## 6. Event Handlers

Quando `OrderPaidEvent` é disparado, calcular a comissão:

```typescript
// commission-event-handlers.ts
@Injectable()
export class CommissionEventHandlers {
  constructor(
    private readonly calculateCommission: CalculateCommissionForOrderUseCase,
  ) {}

  @OnEvent('order.paid')
  async handleOrderPaid(event: OrderPaidEvent): Promise<void> {
    if (!event.resellerId) return; // Venda direta, sem revendedor

    await this.calculateCommission.execute({
      resellerId: event.resellerId,
      orderId: event.orderId,
      orderTotal: event.total,
      shippingCost: event.shippingCost ?? 0,
    });
  }
}
```

---

## 7. Endpoints

```
GET    /api/commissions/balance     # Saldo do revendedor logado
GET    /api/commissions/history     # Histórico de comissões
GET    /api/commissions/rules       # Regras de comissão (público)

# Admin
PUT    /api/admin/commissions/rules  # Atualizar regras
GET    /api/admin/commissions        # Listar todas as comissões
```

---

## 8. Checklist de Implementação

### Domain Layer
- [ ] Criar `commission-id.vo.ts`
- [ ] Criar `commission-status.vo.ts`
- [ ] Criar `percentage.vo.ts`
- [ ] Criar `commission.entity.ts`
- [ ] Criar `commission-rule.entity.ts`
- [ ] Criar eventos de domínio

### Application Layer
- [ ] Criar DTOs
- [ ] Criar `commission-repository.port.ts`
- [ ] Criar `commission-rule-repository.port.ts`
- [ ] Criar `CalculateCommissionForOrderUseCase`
- [ ] Criar `GetResellerBalanceUseCase`
- [ ] Criar `GetCommissionHistoryUseCase`
- [ ] Criar `ReleasePendingCommissionsUseCase` (cron)
- [ ] Criar `ConfigureCommissionRulesUseCase` (admin)

### Infrastructure Layer
- [ ] Criar migration
- [ ] Criar ORM entities
- [ ] Criar mappers
- [ ] Criar repositories
- [ ] Criar controller
- [ ] Criar event handlers

### Integration
- [ ] Ouvir `OrderPaidEvent` para calcular comissão
- [ ] Configurar cron job para liberar comissões
- [ ] Integrar com Withdrawal Context

---

**Próximo módulo:** [07-FRONTEND-DASHBOARD.md](./07-FRONTEND-DASHBOARD.md)
