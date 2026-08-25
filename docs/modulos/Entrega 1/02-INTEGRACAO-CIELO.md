# Módulo 02: INTEGRAÇÃO CIELO

**Prioridade:** CRÍTICA
**Dependências:** Order Context
**Estimativa:** Backend - integração de pagamentos

---

## Objetivo

Integrar a API Cielo para processamento de pagamentos de produtos (checkout) e assinaturas recorrentes.

---

## 1. Estrutura de Pastas

```
apps/kaza-tem-system/backend/src/infrastructure/integrations/cielo/
├── cielo-client.port.ts       # Interface do cliente
├── cielo.client.ts            # Implementação HTTP
├── cielo-checkout.service.ts  # Pagamentos de checkout
├── cielo-recurrence.service.ts # Assinaturas recorrentes
├── cielo-webhook.controller.ts # Webhooks
├── dto/
│   ├── cielo-payment.request.dto.ts
│   ├── cielo-payment.response.dto.ts
│   └── cielo-webhook.dto.ts
└── cielo.module.ts
```

---

## 2. Configuração de Ambiente

```env
# .env
CIELO_MERCHANT_ID=seu-merchant-id
CIELO_MERCHANT_KEY=sua-merchant-key
CIELO_ENVIRONMENT=sandbox  # ou production
CIELO_WEBHOOK_URL=https://api.kazatem.shop/api/payments/webhook
```

---

## 3. Interfaces

### 3.1 Cielo Client Port

```typescript
// cielo-client.port.ts
export const CIELO_CLIENT = Symbol('CIELO_CLIENT');

export interface CieloPaymentRequest {
  orderId: string;
  amount: number; // em centavos
  installments: number;
  card: {
    number: string;
    holder: string;
    expirationDate: string; // MM/YYYY
    securityCode: string;
    brand: 'Visa' | 'Master' | 'Elo' | 'Amex' | 'Hipercard';
  };
  customer: {
    name: string;
    email: string;
    document: string; // CPF
  };
}

export interface CieloPaymentResponse {
  paymentId: string;
  status: number;
  returnCode: string;
  returnMessage: string;
  authorizationCode?: string;
  tid?: string;
}

export interface CieloClientPort {
  createPayment(request: CieloPaymentRequest): Promise<CieloPaymentResponse>;
  capturePayment(paymentId: string, amount?: number): Promise<CieloPaymentResponse>;
  cancelPayment(paymentId: string, amount?: number): Promise<CieloPaymentResponse>;
  getPayment(paymentId: string): Promise<CieloPaymentResponse>;
}
```

---

## 4. Implementação

### 4.1 Cielo Client

```typescript
// cielo.client.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CieloClientPort, CieloPaymentRequest, CieloPaymentResponse } from './cielo-client.port';

@Injectable()
export class CieloClient implements CieloClientPort {
  private readonly apiUrl: string;
  private readonly queryUrl: string;
  private readonly merchantId: string;
  private readonly merchantKey: string;

  constructor(private readonly configService: ConfigService) {
    const environment = this.configService.get<string>('CIELO_ENVIRONMENT') || 'sandbox';

    if (environment === 'production') {
      this.apiUrl = 'https://api.cieloecommerce.cielo.com.br';
      this.queryUrl = 'https://apiquery.cieloecommerce.cielo.com.br';
    } else {
      this.apiUrl = 'https://apisandbox.cieloecommerce.cielo.com.br';
      this.queryUrl = 'https://apiquerysandbox.cieloecommerce.cielo.com.br';
    }

    this.merchantId = this.configService.getOrThrow<string>('CIELO_MERCHANT_ID');
    this.merchantKey = this.configService.getOrThrow<string>('CIELO_MERCHANT_KEY');
  }

  async createPayment(request: CieloPaymentRequest): Promise<CieloPaymentResponse> {
    const body = {
      MerchantOrderId: request.orderId,
      Customer: {
        Name: request.customer.name,
        Email: request.customer.email,
        Identity: request.customer.document,
        IdentityType: 'CPF',
      },
      Payment: {
        Type: 'CreditCard',
        Amount: request.amount,
        Installments: request.installments,
        Capture: true,
        CreditCard: {
          CardNumber: request.card.number,
          Holder: request.card.holder,
          ExpirationDate: request.card.expirationDate,
          SecurityCode: request.card.securityCode,
          Brand: request.card.brand,
        },
      },
    };

    const response = await fetch(`${this.apiUrl}/1/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        MerchantId: this.merchantId,
        MerchantKey: this.merchantKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return {
      paymentId: data.Payment?.PaymentId,
      status: data.Payment?.Status,
      returnCode: data.Payment?.ReturnCode,
      returnMessage: data.Payment?.ReturnMessage,
      authorizationCode: data.Payment?.AuthorizationCode,
      tid: data.Payment?.Tid,
    };
  }

  async capturePayment(paymentId: string, amount?: number): Promise<CieloPaymentResponse> {
    const url = amount
      ? `${this.apiUrl}/1/sales/${paymentId}/capture?amount=${amount}`
      : `${this.apiUrl}/1/sales/${paymentId}/capture`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        MerchantId: this.merchantId,
        MerchantKey: this.merchantKey,
      },
    });

    const data = await response.json();
    return this.mapResponse(data);
  }

  async cancelPayment(paymentId: string, amount?: number): Promise<CieloPaymentResponse> {
    const url = amount
      ? `${this.apiUrl}/1/sales/${paymentId}/void?amount=${amount}`
      : `${this.apiUrl}/1/sales/${paymentId}/void`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        MerchantId: this.merchantId,
        MerchantKey: this.merchantKey,
      },
    });

    const data = await response.json();
    return this.mapResponse(data);
  }

  async getPayment(paymentId: string): Promise<CieloPaymentResponse> {
    const response = await fetch(`${this.queryUrl}/1/sales/${paymentId}`, {
      method: 'GET',
      headers: {
        MerchantId: this.merchantId,
        MerchantKey: this.merchantKey,
      },
    });

    const data = await response.json();
    return this.mapResponse(data);
  }

  private mapResponse(data: any): CieloPaymentResponse {
    return {
      paymentId: data.Payment?.PaymentId,
      status: data.Payment?.Status,
      returnCode: data.Payment?.ReturnCode,
      returnMessage: data.Payment?.ReturnMessage,
      authorizationCode: data.Payment?.AuthorizationCode,
      tid: data.Payment?.Tid,
    };
  }
}
```

---

## 5. Webhook Controller

```typescript
// cielo-webhook.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ProcessPaymentWebhookUseCase } from '@contexts/order/application/use-cases/process-payment-webhook/process-payment-webhook.use-case';

interface CieloWebhookPayload {
  PaymentId: string;
  ChangeType: number;
}

@Controller('payments')
export class CieloWebhookController {
  constructor(private readonly processWebhook: ProcessPaymentWebhookUseCase) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: CieloWebhookPayload): Promise<void> {
    // ChangeType: 1 = Atualização de status
    if (payload.ChangeType === 1) {
      await this.processWebhook.execute({ paymentId: payload.PaymentId });
    }
  }
}
```

---

## 6. Status de Pagamento Cielo

| Status | Descrição |
|--------|-----------|
| 0 | NotFinished |
| 1 | Authorized |
| 2 | PaymentConfirmed |
| 3 | Denied |
| 10 | Voided |
| 11 | Refunded |
| 12 | Pending |
| 13 | Aborted |
| 20 | Scheduled |

---

## 7. Endpoints

```
POST   /api/orders/:id/pay          # Processar pagamento
POST   /api/payments/webhook        # Webhook Cielo
GET    /api/payments/:id            # Consultar pagamento
POST   /api/payments/:id/refund     # Estornar pagamento
```

---

## 8. Checklist de Implementação

- [ ] Configurar variáveis de ambiente
- [ ] Criar `cielo-client.port.ts`
- [ ] Criar `cielo.client.ts`
- [ ] Criar `cielo-checkout.service.ts`
- [ ] Criar `cielo-webhook.controller.ts`
- [ ] Criar DTOs de request/response
- [ ] Criar `cielo.module.ts`
- [ ] Criar `ProcessPaymentUseCase` no Order Context
- [ ] Criar `ProcessPaymentWebhookUseCase` no Order Context
- [ ] Integrar com Order - marcar como pago quando aprovado
- [ ] Testes com sandbox Cielo

---

## 9. Testes no Sandbox

**Cartões de teste Cielo:**

| Bandeira | Número | CVV | Validade |
|----------|--------|-----|----------|
| Visa | 4551870000000183 | 123 | 12/2030 |
| Master | 5155901222280001 | 123 | 12/2030 |
| Elo | 6362970000457013 | 123 | 12/2030 |

---

**Próximo módulo:** [03-INTEGRACAO-MELHOR-ENVIO.md](./03-INTEGRACAO-MELHOR-ENVIO.md)
