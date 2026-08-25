# Módulo 01: ORDER CONTEXT

**Prioridade:** CRÍTICA
**Dependências:** Product Context, User Context (já implementados)
**Estimativa:** Backend completo

---

## Objetivo

Implementar o contexto de pedidos seguindo a arquitetura hexagonal existente. Este módulo é a base para o e-commerce funcionar.

---

## 1. Estrutura de Pastas

```
apps/kaza-tem-system/backend/src/contexts/order/
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
│   ├── ports/
│   │   └── output/
│   │       └── order-repository.port.ts
│   └── use-cases/
│       ├── create-order/
│       │   ├── create-order.command.ts
│       │   └── create-order.use-case.ts
│       ├── get-order/
│       │   ├── get-order.query.ts
│       │   └── get-order.use-case.ts
│       ├── list-user-orders/
│       │   └── list-user-orders.use-case.ts
│       ├── cancel-order/
│       │   └── cancel-order.use-case.ts
│       └── update-order-status/
│           └── update-order-status.use-case.ts
└── order.module.ts
```

---

## 2. Entidades de Domínio

### 2.1 Order Entity

```typescript
// domain/entities/order.entity.ts
import { AggregateRoot } from '@gitspread/domain-primitives';
import { OrderId } from '../value-objects/order-id.vo';
import { OrderStatus } from '../value-objects/order-status.vo';
import { ShippingAddress } from '../value-objects/shipping-address.vo';
import { OrderItem } from './order-item.entity';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderPaidEvent } from '../events/order-paid.event';

export class Order extends AggregateRoot {
  private constructor(
    private readonly _id: OrderId,
    private readonly _userId: string,
    private _resellerId: string | null,
    private _items: OrderItem[],
    private _status: OrderStatus,
    private _subtotal: number,
    private _shippingCost: number,
    private _discount: number,
    private _total: number,
    private _shippingAddress: ShippingAddress,
    private _shippingMethod: string | null,
    private _trackingCode: string | null,
    private _paymentId: string | null,
    private _paymentMethod: string | null,
    private _paidAt: Date | null,
    private _shippedAt: Date | null,
    private _deliveredAt: Date | null,
    private _canceledAt: Date | null,
    private _cancelReason: string | null,
    private _notes: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(props: {
    userId: string;
    resellerId?: string;
    items: { productId: string; sku: string; name: string; quantity: number; unitPrice: number }[];
    shippingAddress: ShippingAddress;
    shippingMethod?: string;
    shippingCost?: number;
    discount?: number;
    notes?: string;
  }): Order {
    const id = OrderId.generate();
    const now = new Date();

    const items = props.items.map(item =>
      OrderItem.create({
        orderId: id.value,
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })
    );

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const shippingCost = props.shippingCost ?? 0;
    const discount = props.discount ?? 0;
    const total = subtotal + shippingCost - discount;

    const order = new Order(
      id,
      props.userId,
      props.resellerId ?? null,
      items,
      OrderStatus.PENDING,
      subtotal,
      shippingCost,
      discount,
      total,
      props.shippingAddress,
      props.shippingMethod ?? null,
      null, // trackingCode
      null, // paymentId
      null, // paymentMethod
      null, // paidAt
      null, // shippedAt
      null, // deliveredAt
      null, // canceledAt
      null, // cancelReason
      props.notes ?? null,
      now,
      now,
    );

    order.addDomainEvent(new OrderCreatedEvent(id.value, props.userId, total));
    return order;
  }

  // Getters
  get id(): OrderId { return this._id; }
  get userId(): string { return this._userId; }
  get resellerId(): string | null { return this._resellerId; }
  get items(): OrderItem[] { return [...this._items]; }
  get status(): OrderStatus { return this._status; }
  get subtotal(): number { return this._subtotal; }
  get shippingCost(): number { return this._shippingCost; }
  get discount(): number { return this._discount; }
  get total(): number { return this._total; }
  get shippingAddress(): ShippingAddress { return this._shippingAddress; }
  get trackingCode(): string | null { return this._trackingCode; }
  get paymentId(): string | null { return this._paymentId; }
  get paidAt(): Date | null { return this._paidAt; }
  get createdAt(): Date { return this._createdAt; }

  // Business methods
  markAsPaid(paymentId: string, paymentMethod: string): void {
    if (!this._status.canTransitionTo(OrderStatus.PAID)) {
      throw new Error('Cannot mark order as paid in current status');
    }
    this._paymentId = paymentId;
    this._paymentMethod = paymentMethod;
    this._paidAt = new Date();
    this._status = OrderStatus.PAID;
    this._updatedAt = new Date();

    this.addDomainEvent(new OrderPaidEvent(this._id.value, this._total, this._resellerId));
  }

  markAsShipped(trackingCode: string): void {
    if (!this._status.canTransitionTo(OrderStatus.SHIPPED)) {
      throw new Error('Cannot mark order as shipped in current status');
    }
    this._trackingCode = trackingCode;
    this._shippedAt = new Date();
    this._status = OrderStatus.SHIPPED;
    this._updatedAt = new Date();
  }

  cancel(reason: string): void {
    if (!this._status.canCancel()) {
      throw new Error('Cannot cancel order in current status');
    }
    this._cancelReason = reason;
    this._canceledAt = new Date();
    this._status = OrderStatus.CANCELED;
    this._updatedAt = new Date();
  }
}
```

### 2.2 Order Status Value Object

```typescript
// domain/value-objects/order-status.vo.ts
import { ValueObject } from '@gitspread/domain-primitives';

export type OrderStatusValue =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'canceled';

export class OrderStatus extends ValueObject<{ value: OrderStatusValue }> {
  static readonly PENDING = new OrderStatus({ value: 'pending' });
  static readonly AWAITING_PAYMENT = new OrderStatus({ value: 'awaiting_payment' });
  static readonly PAID = new OrderStatus({ value: 'paid' });
  static readonly PROCESSING = new OrderStatus({ value: 'processing' });
  static readonly SHIPPED = new OrderStatus({ value: 'shipped' });
  static readonly DELIVERED = new OrderStatus({ value: 'delivered' });
  static readonly CANCELED = new OrderStatus({ value: 'canceled' });

  get value(): OrderStatusValue {
    return this.props.value;
  }

  canTransitionTo(newStatus: OrderStatus): boolean {
    const transitions: Record<OrderStatusValue, OrderStatusValue[]> = {
      pending: ['awaiting_payment', 'canceled'],
      awaiting_payment: ['paid', 'canceled'],
      paid: ['processing', 'canceled'],
      processing: ['shipped', 'canceled'],
      shipped: ['delivered'],
      delivered: [],
      canceled: [],
    };
    return transitions[this.value].includes(newStatus.value);
  }

  canCancel(): boolean {
    return ['pending', 'awaiting_payment', 'paid', 'processing'].includes(this.value);
  }

  static from(value: string): OrderStatus {
    const map: Record<string, OrderStatus> = {
      pending: OrderStatus.PENDING,
      awaiting_payment: OrderStatus.AWAITING_PAYMENT,
      paid: OrderStatus.PAID,
      processing: OrderStatus.PROCESSING,
      shipped: OrderStatus.SHIPPED,
      delivered: OrderStatus.DELIVERED,
      canceled: OrderStatus.CANCELED,
    };
    const status = map[value];
    if (!status) throw new Error(`Invalid order status: ${value}`);
    return status;
  }
}
```

---

## 3. Migration SQL

```sql
-- Criar migration: npm run migration:create -- --name=CreateOrderTables

-- orders
CREATE TABLE orders (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NOT NULL,
  reseller_id UNIQUEIDENTIFIER NULL,
  bling_order_id VARCHAR(50) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  shipping_method VARCHAR(100) NULL,
  shipping_address NVARCHAR(MAX) NOT NULL, -- JSON
  billing_address NVARCHAR(MAX) NULL, -- JSON
  tracking_code VARCHAR(100) NULL,
  payment_id VARCHAR(100) NULL,
  payment_method VARCHAR(50) NULL,
  paid_at DATETIME2 NULL,
  shipped_at DATETIME2 NULL,
  delivered_at DATETIME2 NULL,
  canceled_at DATETIME2 NULL,
  cancel_reason NVARCHAR(MAX) NULL,
  notes NVARCHAR(MAX) NULL,
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),

  CONSTRAINT FK_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT FK_orders_reseller FOREIGN KEY (reseller_id) REFERENCES resellers(id)
);

-- order_items
CREATE TABLE order_items (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  order_id UNIQUEIDENTIFIER NOT NULL,
  product_id UNIQUEIDENTIFIER NOT NULL,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at DATETIME2 DEFAULT GETDATE(),

  CONSTRAINT FK_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT FK_order_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Indexes
CREATE INDEX IX_orders_user ON orders(user_id);
CREATE INDEX IX_orders_reseller ON orders(reseller_id);
CREATE INDEX IX_orders_status ON orders(status);
CREATE INDEX IX_orders_created ON orders(created_at);
CREATE INDEX IX_order_items_order ON order_items(order_id);
```

---

## 4. Endpoints HTTP

```
POST   /api/orders              # Criar pedido
GET    /api/orders              # Listar pedidos do usuário logado
GET    /api/orders/:id          # Detalhes do pedido
PUT    /api/orders/:id/cancel   # Cancelar pedido
POST   /api/orders/:id/pay      # Processar pagamento (integra com Cielo)
GET    /api/orders/:id/track    # Rastrear pedido

# Admin endpoints
GET    /api/admin/orders        # Listar todos os pedidos
PUT    /api/admin/orders/:id/status  # Atualizar status
```

---

## 5. Checklist de Implementação

### Domain Layer
- [ ] Criar `order-id.vo.ts`
- [ ] Criar `order-status.vo.ts`
- [ ] Criar `shipping-address.vo.ts`
- [ ] Criar `tracking-code.vo.ts`
- [ ] Criar `order-item.entity.ts`
- [ ] Criar `order.entity.ts`
- [ ] Criar `order-created.event.ts`
- [ ] Criar `order-paid.event.ts`
- [ ] Criar `order-shipped.event.ts`
- [ ] Criar `order-canceled.event.ts`
- [ ] Criar `order-not-found.exception.ts`
- [ ] Criar `invalid-order-status.exception.ts`
- [ ] Criar `insufficient-stock.exception.ts`

### Application Layer
- [ ] Criar `order.dto.ts`
- [ ] Criar `order-item.dto.ts`
- [ ] Criar `create-order.dto.ts`
- [ ] Criar `order-repository.port.ts`
- [ ] Criar `CreateOrderUseCase`
- [ ] Criar `GetOrderUseCase`
- [ ] Criar `ListUserOrdersUseCase`
- [ ] Criar `CancelOrderUseCase`
- [ ] Criar `UpdateOrderStatusUseCase`

### Infrastructure Layer
- [ ] Criar migration SQL
- [ ] Criar `order-orm.entity.ts`
- [ ] Criar `order-item-orm.entity.ts`
- [ ] Criar `order.mapper.ts`
- [ ] Criar `order.repository.ts`
- [ ] Criar `order.controller.ts`
- [ ] Criar request/response DTOs

### Module
- [ ] Criar `order.module.ts`
- [ ] Registrar no `app.module.ts`
- [ ] Registrar no `http.module.ts`

### Testes
- [ ] Testes unitários das entidades
- [ ] Testes unitários dos use cases
- [ ] Testes de integração do repository
- [ ] Testes E2E dos endpoints

---

## 6. Validação Final

Após implementar, verificar:

1. **Criar pedido:**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "productId": "uuid", "quantity": 2 }
    ],
    "shippingAddress": {
      "street": "Rua Teste",
      "number": "123",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01234-567"
    }
  }'
```

2. **Listar pedidos:**
```bash
curl http://localhost:3000/api/orders \
  -H "Authorization: Bearer TOKEN"
```

3. **Cancelar pedido:**
```bash
curl -X PUT http://localhost:3000/api/orders/{id}/cancel \
  -H "Authorization: Bearer TOKEN" \
  -d '{ "reason": "Desisti da compra" }'
```

---

**Próximo módulo:** [02-INTEGRACAO-CIELO.md](./02-INTEGRACAO-CIELO.md)
