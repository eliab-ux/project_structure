# SPRINT 03-04 - SISTEMA DE ASSINATURA

**Duração:** 2 semanas (10 dias úteis)  
**Prioridade:** 🔴 CRÍTICA  
**Objetivo:** Implementar sistema de assinatura mensal (R$ 9,90) com Cielo Recorrência

**Depende de:** ✅ SPRINT 01-02 (Painel Admin + Aprovação de cadastros)

---

## 🎯 OBJETIVOS DO SPRINT

### Objetivo Principal
Implementar sistema completo de assinatura mensal para revendedores, com cobrança recorrente via Cielo e gestão de inadimplência.

### Entregáveis
1. ✅ Integração com Cielo Recorrência (API)
2. ✅ Fluxo de criação de assinatura
3. ✅ Webhooks de notificação de pagamento
4. ✅ Gestão de inadimplência (suspensão/cancelamento)
5. ✅ Painel de gestão de assinaturas (Admin)
6. ✅ Dashboard de assinatura (Revendedor)

---

## 📋 BACKLOG DO SPRINT

### 1. INTEGRAÇÃO CIELO RECORRÊNCIA (3 dias)

#### 1.1 Backend - Cielo Client

**Arquivos:**
```
src/infrastructure/integrations/cielo/
├── cielo-recurrence.client.ts
├── cielo.config.ts
├── dto/
│   ├── create-recurrence.dto.ts
│   ├── recurrence-response.dto.ts
│   └── webhook-notification.dto.ts
└── cielo.module.ts
```

**Tarefas:**
- [ ] Instalar axios para HTTP requests
- [ ] Criar CieloRecurrenceClient
- [ ] Implementar autenticação (MerchantId + MerchantKey)
- [ ] Implementar métodos:
  - createRecurrence(cardData, amount) - Criar recorrência
  - getRecurrence(recurrenceId) - Consultar recorrência
  - cancelRecurrence(recurrenceId) - Cancelar recorrência
  - updatePaymentMethod(recurrenceId, newCard) - Atualizar cartão
- [ ] Tratamento de erros específicos da Cielo
- [ ] Logging de requests/responses
- [ ] Configurar credenciais no .env:
  ```env
  CIELO_MERCHANT_ID=your_merchant_id
  CIELO_MERCHANT_KEY=your_merchant_key
  CIELO_RECURRENCE_URL=https://api.cieloecommerce.cielo.com.br/1/RecurrentPayment
  ```

**Critérios de Aceite:**
- Cliente conecta com API Cielo
- Autentica corretamente
- Retorna erros tratados (não quebra app)
- Logs detalhados para debug

#### 1.2 Backend - Subscription Context (Domain)

**Arquivos:**
```
src/contexts/subscription/domain/
├── entities/subscription.entity.ts
├── value-objects/
│   ├── subscription-id.vo.ts
│   └── subscription-status.vo.ts
├── events/
│   ├── subscription-created.event.ts
│   ├── subscription-payment-confirmed.event.ts
│   ├── subscription-payment-failed.event.ts
│   └── subscription-canceled.event.ts
└── exceptions/
    ├── subscription-not-found.exception.ts
    └── invalid-subscription-status.exception.ts
```

**Tarefas:**
- [ ] Criar entity Subscription:
  ```typescript
  - id: SubscriptionId
  - reseller_id: ResellerId
  - cielo_recurrence_id: string
  - status: SubscriptionStatus (active, suspended, canceled)
  - amount: number (9.90)
  - next_billing_date: Date
  - started_at: Date
  - canceled_at: Date | null
  ```
- [ ] Métodos:
  - create() - Factory method
  - confirmPayment() - Marca pagamento como ok
  - suspend() - Suspende por falta de pagamento
  - cancel() - Cancela definitivamente
  - reactivate() - Reativa após pagamento
- [ ] Value Object SubscriptionStatus
- [ ] Domain Events para cada mudança de status
- [ ] Validações:
  - Não pode cancelar já cancelada
  - Não pode suspender já suspensa

**Critérios de Aceite:**
- Entity pura (sem decorators)
- Domain events emitidos
- Validações de estado
- Testes unitários passando

---

### 2. APPLICATION LAYER (2 dias)

#### 2.1 Use Cases

**Arquivos:**
```
src/contexts/subscription/application/
├── use-cases/
│   ├── create-subscription/
│   │   ├── create-subscription.command.ts
│   │   └── create-subscription.use-case.ts
│   ├── process-payment-webhook/
│   │   ├── process-payment-webhook.command.ts
│   │   └── process-payment-webhook.use-case.ts
│   ├── cancel-subscription/
│   │   ├── cancel-subscription.command.ts
│   │   └── cancel-subscription.use-case.ts
│   └── get-subscription/
│       ├── get-subscription.query.ts
│       └── get-subscription.use-case.ts
├── ports/output/
│   └── subscription-repository.port.ts
└── dto/
    └── subscription.dto.ts
```

**Tarefas:**
- [ ] CreateSubscription:
  - Recebe: reseller_id, cardData
  - Cria recorrência na Cielo
  - Salva subscription com cielo_recurrence_id
  - Status inicial: "active" (se primeiro pagamento ok)
  - Emite SubscriptionCreatedEvent
  
- [ ] ProcessPaymentWebhook:
  - Recebe: cielo_recurrence_id, status
  - Busca subscription
  - Se pagamento ok: confirmPayment()
  - Se pagamento falhou: suspend()
  - Atualiza next_billing_date
  
- [ ] CancelSubscription:
  - Busca subscription
  - Cancela na Cielo
  - Marca como canceled
  - Emite SubscriptionCanceledEvent
  
- [ ] GetSubscription:
  - Busca por reseller_id
  - Retorna SubscriptionDto

**Critérios de Aceite:**
- Use cases seguem padrão do CLAUDE.md
- Injeção via Symbols
- UnitOfWork para transações
- Errors tratados

---

### 3. INFRASTRUCTURE LAYER (2 dias)

#### 3.1 ORM + Repository

**Arquivos:**
```
src/infrastructure/persistence/mikro-orm/
├── entities/subscription-orm.entity.ts
├── repositories/subscription.repository.ts
└── mappers/subscription.mapper.ts
```

**Tarefas:**
- [ ] Criar SubscriptionOrmEntity:
  ```typescript
  @Entity({ tableName: 'subscriptions' })
  - id: UUID
  - reseller_id: UUID
  - cielo_recurrence_id: VARCHAR(100)
  - status: VARCHAR(20)
  - amount: DECIMAL(10,2)
  - next_billing_date: DATE
  - started_at: TIMESTAMP
  - canceled_at: TIMESTAMP | null
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
  ```
- [ ] Criar SubscriptionMapper
- [ ] Criar SubscriptionRepository (implementa port)
- [ ] Migration para criar tabela `subscriptions`
- [ ] Foreign key para `resellers`

**SQL Migration:**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL,
  cielo_recurrence_id VARCHAR(100),
  status VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  next_billing_date DATE,
  started_at TIMESTAMP DEFAULT NOW(),
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (reseller_id) REFERENCES resellers(id)
);

CREATE INDEX idx_subscriptions_reseller ON subscriptions(reseller_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

#### 3.2 Controllers

**Arquivos:**
```
src/infrastructure/http/controllers/subscription/
├── subscription.controller.ts (revendedor)
├── admin-subscription.controller.ts (admin)
└── dto/
    ├── create-subscription.request.dto.ts
    └── subscription.response.dto.ts
```

**Tarefas:**
- [ ] POST /api/subscriptions (revendedor cria assinatura)
- [ ] GET /api/subscriptions/me (revendedor vê sua assinatura)
- [ ] DELETE /api/subscriptions/me (revendedor cancela)
- [ ] PUT /api/subscriptions/me/payment-method (atualiza cartão)
- [ ] GET /api/admin/subscriptions (admin lista todas)
- [ ] GET /api/admin/subscriptions/:id (admin vê detalhes)

**Critérios de Aceite:**
- Apenas revendedor aprovado pode criar assinatura
- Validação de dados do cartão
- 1 try-catch por método
- Status HTTP corretos (201, 200, 204, 404)

---

### 4. WEBHOOKS CIELO (2 dias)

#### 4.1 Webhook Endpoint

**Arquivos:**
```
src/infrastructure/http/controllers/webhooks/
└── cielo-webhook.controller.ts
```

**Tarefas:**
- [ ] POST /api/webhooks/cielo (público, sem auth)
- [ ] Validar assinatura do webhook (Cielo envia hash)
- [ ] Processar diferentes tipos de notificação:
  - RecurrentPaymentOrderCreated
  - RecurrentPaymentCreated
  - RecurrentPaymentCanceled
  - PaymentAuthorized
  - PaymentCaptur ed
  - PaymentFailed
- [ ] Chamar ProcessPaymentWebhook use case
- [ ] Responder rapidamente (< 3s)
- [ ] Log detalhado de cada webhook
- [ ] Idempotência (não processar 2x o mesmo webhook)

**Exemplo de payload Cielo:**
```json
{
  "RecurrentPaymentId": "...",
  "PaymentId": "...",
  "ChangeType": 3, // 1=Created, 2=Canceled, 3=Captured, 4=Failed
  "Status": 1, // 1=Success, 2=Failure
  "Amount": 990 // em centavos
}
```

**Critérios de Aceite:**
- Webhook valida assinatura Cielo
- Responde 200 OK rapidamente
- Processa de forma assíncrona se necessário
- Idempotência garantida (chave única)
- Errors não quebram endpoint

#### 4.2 Event Handlers

**Arquivos:**
```
src/infrastructure/messaging/handlers/
├── subscription-payment-confirmed.handler.ts
├── subscription-payment-failed.handler.ts
└── subscription-canceled.handler.ts
```

**Tarefas:**
- [ ] Handler SubscriptionPaymentConfirmed:
  - Atualizar status do revendedor para "active"
  - Enviar email de confirmação
  
- [ ] Handler SubscriptionPaymentFailed:
  - Atualizar status do revendedor para "suspended"
  - Enviar email de falha
  - Agendar cancelamento automático (7 dias)
  
- [ ] Handler SubscriptionCanceled:
  - Atualizar status do revendedor para "canceled"
  - Enviar email de cancelamento

**Critérios de Aceite:**
- Handlers registrados corretamente
- Status de revendedor atualizado
- Emails enviados

---

### 5. FRONTEND - REVENDEDOR (2 dias)

#### 5.1 Página de Criação de Assinatura

**Arquivos:**
```
frontend/src/app/reseller/
├── subscription/
│   ├── create/
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── SubscriptionPlan/
│   │       └── CardForm/
│   └── manage/
│       └── page.tsx
```

**Tarefas:**
- [ ] Após aprovação, redirecionar para /reseller/subscription/create
- [ ] Exibir plano: R$ 9,90/mês
- [ ] Formulário de cartão de crédito:
  - Número do cartão (máscara)
  - Nome no cartão
  - Validade (MM/AA)
  - CVV
- [ ] Validação com yup
- [ ] Integração com Cielo (tokenização se necessário)
- [ ] Loading durante processamento
- [ ] Mensagem de sucesso/erro
- [ ] Se sucesso, redirecionar para dashboard

**Critérios de Aceite:**
- Formulário valida todos os campos
- Dados do cartão NÃO são armazenados (apenas token)
- Loading state durante processamento
- Feedback claro de sucesso/erro
- Responsivo em mobile

#### 5.2 Gestão de Assinatura

**Arquivos:**
```
frontend/src/app/reseller/subscription/manage/
└── page.tsx
```

**Tarefas:**
- [ ] Exibir informações da assinatura:
  - Status (badge colorido)
  - Valor: R$ 9,90/mês
  - Próxima cobrança: DD/MM/AAAA
  - Data de início
- [ ] Botão "Atualizar Cartão"
- [ ] Botão "Cancelar Assinatura" (com confirmação)
- [ ] Histórico de pagamentos (tabela)
- [ ] Se suspenso, exibir aviso e botão para regularizar

**Critérios de Aceite:**
- Status visível e claro
- Histórico de pagamentos funcional
- Cancelamento com confirmação
- Aviso de inadimplência em destaque

---

### 6. FRONTEND - ADMIN (1 dia)

#### 6.1 Gestão de Assinaturas (Admin)

**Arquivos:**
```
frontend/src/app/admin/subscriptions/
├── page.tsx
└── [id]/
    └── page.tsx
```

**Tarefas:**
- [ ] Página /admin/subscriptions
- [ ] Tabela com todas as assinaturas:
  - Revendedor
  - Status (badge)
  - Valor
  - Próxima cobrança
  - Ações (Ver detalhes)
- [ ] Filtros por status
- [ ] Página de detalhes:
  - Informações completas
  - Histórico de pagamentos
  - Botão "Cancelar Assinatura" (admin pode forçar)

**Critérios de Aceite:**
- Tabela responsiva
- Filtros funcionam
- Detalhes completos
- Admin pode cancelar manualmente

---

### 7. CRON JOB - CANCELAMENTO AUTOMÁTICO (1 dia)

#### 7.1 Job de Verificação

**Arquivos:**
```
src/infrastructure/jobs/
└── check-suspended-subscriptions.job.ts
```

**Tarefas:**
- [ ] Instalar @nestjs/schedule
- [ ] Criar cron job diário (executa 1x por dia)
- [ ] Buscar assinaturas com status "suspended"
- [ ] Verificar se está suspensa há mais de 7 dias
- [ ] Se sim, cancelar automaticamente
- [ ] Atualizar status do revendedor para "canceled"
- [ ] Enviar email de cancelamento
- [ ] Log de execução

**Critérios de Aceite:**
- Cron executa automaticamente
- Apenas suspensas há +7 dias são canceladas
- Email enviado
- Log de execução salvo

---

## ✅ DEFINITION OF DONE

### Técnico
- [ ] Código segue CLAUDE.md
- [ ] Integração Cielo testada com ambiente sandbox
- [ ] Webhooks validados
- [ ] Cron job testado
- [ ] TypeScript sem `any`
- [ ] Migrations aplicadas

### Funcional
- [ ] Revendedor aprovado é redirecionado para criar assinatura
- [ ] Revendedor consegue criar assinatura com cartão
- [ ] Primeira cobrança processada
- [ ] Webhook de pagamento confirmado funciona
- [ ] Webhook de falha funciona
- [ ] Suspensão por inadimplência funciona
- [ ] Cancelamento automático após 7 dias funciona
- [ ] Revendedor consegue cancelar assinatura
- [ ] Admin vê lista de assinaturas
- [ ] Emails enviados em cada mudança de status

### Segurança
- [ ] Dados do cartão NÃO armazenados
- [ ] Webhook valida assinatura Cielo
- [ ] Apenas revendedor aprovado pode criar assinatura
- [ ] Admin pode gerenciar assinaturas

---

## 🧪 TESTES

### Testes Unitários
- [ ] Subscription entity (confirmPayment, suspend, cancel)
- [ ] SubscriptionStatus value object
- [ ] CreateSubscription use case
- [ ] ProcessPaymentWebhook use case

### Testes de Integração
- [ ] CieloRecurrenceClient (com mock)
- [ ] SubscriptionRepository
- [ ] Webhook endpoint (idempotência)

### Testes Manuais
- [ ] Criar assinatura com cartão de teste
- [ ] Simular pagamento aprovado (webhook)
- [ ] Simular pagamento negado (webhook)
- [ ] Cancelar assinatura
- [ ] Verificar emails enviados

**Cartões de teste Cielo:**
```
Aprovado: 4024007197692931
Negado: 4024007138010896
CVV: 123
Validade: 12/2030
```

---

## 📚 REFERÊNCIAS

**Documentos:**
- CLAUDE.md - Padrões (Controller, Use Case, Repository)
- REQUISITOS_KAZA_TEM_SYSTEM.md - Seção 6.3 (Subscriptions)
- REQUISITOS_NEGOCIO_KAZA_TEM.md - Seção 10 (Assinatura Mensal)

**API Cielo:**
- [Documentação Cielo Recorrência](https://developercielo.github.io/manual/cielo-ecommerce#recorr%C3%AAncia)
- [Webhooks](https://developercielo.github.io/manual/cielo-ecommerce#webhooks)

**Schema:**
```sql
-- Adicionar à tabela resellers
ALTER TABLE resellers ADD COLUMN subscription_status VARCHAR(20);
-- Valores: active, suspended, canceled
```

---

## 🚀 PRÓXIMOS PASSOS

Após completar este sprint, avançar para:

**➡️ [SPRINT 05-06: INTEGRAÇÃO BLING](SPRINT_05-06_INTEGRACAO_BLING.md)**

Objetivos do próximo sprint:
- OAuth 2.0 com Bling
- Sincronização de produtos
- Envio de pedidos
- Cron job automático

---

## 📊 MÉTRICAS DE SUCESSO

- [ ] 100% dos testes passando
- [ ] Integração Cielo funcional em sandbox
- [ ] Webhooks processados corretamente (100%)
- [ ] Taxa de falha de assinaturas < 5%
- [ ] Tempo de resposta webhook < 2s

---

**Status:** 🟡 A INICIAR  
**Depende de:** ✅ SPRINT 01-02 concluído  
**Responsável:** Equipe de Desenvolvimento  
**Data de Início:** ___/___/2025  
**Data de Entrega:** ___/___/2025

---

**⬅️ [VOLTAR: SPRINT 01-02](SPRINT_01-02_PAINEL_ADMIN.md)**  
**➡️ [PRÓXIMO: SPRINT 05-06](SPRINT_05-06_INTEGRACAO_BLING.md)**

---

**FIM DO SPRINT 03-04**
