# DESENVOLVIMENTO PAINEL ADMINISTRATIVO — KAZA TEM
## Páginas completas do Admin: especificações técnicas

> **Status atual:** Dashboard funcional ✅ | Demais páginas: em branco  
> **Objetivo:** Desenvolver todas as 7 páginas restantes do painel admin  
> **Padrões:** Seguir CLAUDE.md (arquitetura hexagonal, DDD, NestJS + Next.js)

---

## SUMÁRIO DAS PÁGINAS A DESENVOLVER

| # | Página | Rota | Status | Prioridade |
|---|--------|------|--------|-----------|
| 1 | Aprovações | `/admin/aprovacoes` | ❌ Vazio | 🔴 Crítica |
| 2 | Revendedores | `/admin/revendedores` | ❌ Vazio | 🔴 Crítica |
| 3 | Saques | `/admin/saques` | ❌ Vazio | 🔴 Crítica |
| 4 | Pedidos | `/admin/pedidos` | ❌ Vazio | 🟡 Alta |
| 5 | Produtos | `/admin/produtos` | ❌ Vazio | 🟡 Alta |
| 6 | Materiais | `/admin/materiais` | ❌ Vazio | 🟢 Média |
| 7 | Configurações | `/admin/configuracoes` | ❌ Vazio | 🟢 Média |

---

# 1. APROVAÇÕES — /admin/aprovacoes

**Função:** Aprovar ou rejeitar cadastros de novos revendedores.

## Backend — APIs necessárias

```typescript
GET  /api/admin/resellers/pending  [AdminGuard]
POST /api/admin/resellers/:id/approve  [AdminGuard]
POST /api/admin/resellers/:id/reject   [AdminGuard]  body: { reason: string }
```

### GET /api/admin/resellers/pending

**Query da aplicação:**
```sql
SELECT r.id, r.full_name, r.cpf, r.phone, u.email, r.created_at,
       r.bank_name, r.bank_agency, r.bank_account, r.bank_account_type,
       r.bank_holder_name, r.bank_holder_cpf
FROM resellers r
INNER JOIN users u ON r.user_id = u.id
WHERE r.status = 'pending'
ORDER BY r.created_at ASC
```

**Resposta JSON:**
```typescript
{
  data: [
    {
      id: string,
      fullName: string,
      cpf: string,
      phone: string,
      email: string,
      registeredAt: string,
      bankInfo: {
        bankName: string,
        agency: string,
        account: string,
        accountType: 'checking' | 'savings',
        holderName: string,
        holderCpf: string
      }
    }
  ],
  total: number
}
```

### POST /api/admin/resellers/:id/approve

**Use Case — ApproveResellerUseCase**
```typescript
// 1. Buscar reseller por id
// 2. Validar: status === 'pending' (senão: throw InvalidResellerStatusException)
// 3. Gerar reseller_code único:
//    - Remover acentos do primeiro nome: "José Paulo" → "JOSE"
//    - Uppercase + underscore + 8 chars random (A-Z0-9)
//    - Ex: JOSE_XY12AB34
//    - Verificar unicidade: SELECT COUNT(*) FROM resellers WHERE reseller_code = X
//    - Se existe, gerar novamente (loop até encontrar único)
// 4. reseller.approve(adminId, resellerCode)
//    → SET status='approved', approved_at=NOW(), approved_by=adminId, reseller_code=X
//    → EMIT ResellerApprovedEvent
// 5. Salvar via unitOfWork.execute
// 6. Event Handler → enviar email 'reseller-approved' com link para criar assinatura
// 7. Retornar { success: true, resellerCode }
```

### POST /api/admin/resellers/:id/reject

**Use Case — RejectResellerUseCase**
```typescript
// 1. Buscar reseller por id
// 2. Validar: status === 'pending'
// 3. Validar: reason não pode ser vazio (min 10 caracteres)
// 4. reseller.reject(adminId, reason)
//    → SET status='rejected', rejected_at=NOW(), rejected_reason=reason
//    → EMIT ResellerRejectedEvent
// 5. Salvar via unitOfWork.execute
// 6. Event Handler → email 'reseller-rejected' com o motivo
// 7. Retornar { success: true }
```

## Frontend — /admin/aprovacoes

### Layout da Página

```typescript
// Título: "Cadastros Pendentes de Aprovação"
// Subtítulo: "Analise os dados bancários e pessoais antes de aprovar"

// Se total === 0:
//   Exibir estado vazio:
//   ícone CheckCircle (MUI) grande
//   "Nenhum cadastro pendente no momento"
//   "Novos cadastros aparecerão aqui automaticamente"

// Se total > 0:
//   Tabela (MUI DataGrid ou Table):
//   Colunas: Nome | CPF | Email | Telefone | Data do Cadastro | Ações
```

### Estrutura da Tabela

**Colunas:**
- **Nome:** fullName
- **CPF:** formatado (000.000.000-00)
- **Email:** email
- **Telefone:** formatado se existir
- **Data:** formatada "DD/MM/YYYY às HH:mm"
- **Ações:** Botão "Analisar"

### Modal de Análise Detalhada

Ao clicar em "Analisar", abrir Dialog (MUI) fullWidth maxWidth="md":

**Seção 1 — Dados Pessoais**
```
Nome Completo: [fullName]
CPF: [cpf formatado]
Email: [email]
Telefone: [phone formatado ou "Não informado"]
Data do Cadastro: [registeredAt formatado]
```

**Seção 2 — Dados Bancários**
```
Banco: [bankName]
Agência: [agency]
Conta: [account]
Tipo de Conta: [accountType === 'checking' ? 'Corrente' : 'Poupança']
Titular: [holderName]
CPF do Titular: [holderCpf formatado]
```

**Botões de Ação (footer do Dialog):**
- **Botão "REJEITAR"** (vermelho, variant="outlined")
  - Abre campo de texto obrigatório para motivo
  - Placeholder: "Digite o motivo da rejeição (mínimo 10 caracteres)"
  - Validação: min 10 chars
  - Confirmação: "Tem certeza? O revendedor será notificado por email."
  - Sucesso: Toast verde "Cadastro rejeitado" + fecha modal + remove da lista
  
- **Botão "APROVAR"** (verde, variant="contained")
  - Confirmação: "Aprovar este cadastro? O revendedor receberá email para criar assinatura."
  - Loading durante processo
  - Sucesso: Toast verde "Cadastro aprovado! Código: [JOSE_XY12AB34]" + fecha modal + remove da lista
  
- **Botão "CANCELAR"** (cinza, variant="text") → fecha modal

### Estados da UI

**Loading inicial:**
```typescript
// Skeleton de 3 linhas de tabela (MUI Skeleton)
// Enquanto GET /api/admin/resellers/pending carrega
```

**Erro de API:**
```typescript
// Alert severity="error"
// "Não foi possível carregar os cadastros pendentes."
// Botão "Tentar Novamente" → refetch
```

**Feedback de ações:**
```typescript
// Aprovar: LinearProgress no Dialog enquanto processa
// Sucesso: Snackbar verde com autoHideDuration 5000ms
// Erro: Snackbar vermelho com mensagem do backend
```

---

# 2. REVENDEDORES — /admin/revendedores

**Função:** Listar todos os revendedores, ver detalhes, filtrar, suspender/reativar.

## Backend — APIs necessárias

```typescript
GET  /api/admin/resellers?page=1&limit=20&status=X&level=X&search=X  [AdminGuard]
GET  /api/admin/resellers/:id  [AdminGuard]
POST /api/admin/resellers/:id/suspend  [AdminGuard]  body: { reason: string }
POST /api/admin/resellers/:id/reactivate  [AdminGuard]
```

### GET /api/admin/resellers (lista paginada)

**Parâmetros de query:**
- `page` (default: 1)
- `limit` (default: 20)
- `status` (opcional): 'pending' | 'approved' | 'active' | 'suspended' | 'canceled'
- `level` (opcional): 'bronze' | 'silver' | 'gold'
- `search` (opcional): busca por nome, CPF ou email (ILIKE)

**Query SQL:**
```sql
SELECT r.id, r.full_name, r.cpf, u.email, r.phone, r.level, r.status,
       r.total_sold_year, r.reseller_code, r.created_at,
       COUNT(o.id) AS total_orders,
       COALESCE(SUM(o.total_amount), 0) AS total_sold_all_time
FROM resellers r
INNER JOIN users u ON r.user_id = u.id
LEFT JOIN orders o ON o.reseller_id = r.id AND o.status = 'paid'
WHERE (:status IS NULL OR r.status = :status)
  AND (:level IS NULL OR r.level = :level)
  AND (:search IS NULL OR r.full_name ILIKE '%' || :search || '%' 
       OR r.cpf ILIKE '%' || :search || '%' OR u.email ILIKE '%' || :search || '%')
GROUP BY r.id, u.email
ORDER BY r.created_at DESC
LIMIT :limit OFFSET (:page - 1) * :limit
```

**Resposta:**
```typescript
{
  data: [
    {
      id: string,
      fullName: string,
      cpf: string,
      email: string,
      phone: string,
      level: 'bronze' | 'silver' | 'gold',
      status: 'pending' | 'approved' | 'active' | 'suspended' | 'canceled',
      resellerCode: string | null,
      totalOrders: number,
      totalSoldYear: number,
      totalSoldAllTime: number,
      registeredAt: string
    }
  ],
  pagination: { total, totalPages, currentPage, perPage }
}
```

### GET /api/admin/resellers/:id (detalhes completos)

**Query SQL:**
```sql
SELECT r.*, u.email, u.created_at AS user_created_at,
       s.status AS subscription_status, s.next_billing_date,
       (SELECT COUNT(*) FROM orders WHERE reseller_id = r.id AND status = 'paid') AS total_orders,
       (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE reseller_id = r.id AND status = 'paid') AS total_revenue,
       (SELECT COALESCE(SUM(amount), 0) FROM commissions WHERE reseller_id = r.id AND status = 'available') AS commissions_available,
       (SELECT COALESCE(SUM(amount), 0) FROM commissions WHERE reseller_id = r.id AND status = 'withdrawn') AS commissions_withdrawn
FROM resellers r
INNER JOIN users u ON r.user_id = u.id
LEFT JOIN subscriptions s ON s.reseller_id = r.id
WHERE r.id = :id
```

**Resposta:**
```typescript
{
  id: string,
  fullName: string,
  cpf: string,
  email: string,
  phone: string,
  level: string,
  status: string,
  resellerCode: string,
  
  bankInfo: {
    bankName, agency, account, accountType, holderName, holderCpf
  },
  
  subscription: {
    status: string,
    nextBillingDate: string
  } | null,
  
  metrics: {
    totalOrders: number,
    totalRevenue: number,
    commissionsAvailable: number,
    commissionsWithdrawn: number,
    totalSoldYear: number
  },
  
  timeline: {
    registeredAt: string,
    approvedAt: string | null,
    approvedBy: string | null,
    rejectedAt: string | null,
    rejectedReason: string | null
  }
}
```

### POST /api/admin/resellers/:id/suspend

**Use Case — SuspendResellerUseCase**
```typescript
// 1. Buscar reseller
// 2. Validar: status === 'active'
// 3. Validar: reason não vazio (min 10 chars)
// 4. reseller.suspend(reason)
//    → SET status='suspended'
//    → EMIT ResellerSuspendedEvent
// 5. Salvar
// 6. Handler → email notificando suspensão
```

### POST /api/admin/resellers/:id/reactivate

**Use Case — ReactivateResellerUseCase**
```typescript
// 1. Buscar reseller
// 2. Validar: status === 'suspended'
// 3. Verificar subscription.status === 'active' (não pode reativar se assinatura suspensa)
// 4. reseller.reactivate()
//    → SET status='active'
//    → EMIT ResellerReactivatedEvent
// 5. Salvar
// 6. Handler → email notificando reativação
```

## Frontend — /admin/revendedores

### Layout da Página

```typescript
// Título: "Gestão de Revendedores"
// Subtítulo: "Gerencie todos os revendedores cadastrados na plataforma"

// Barra de filtros no topo (row):
//   Select Status: [Todos | Pendente | Aprovado | Ativo | Suspenso | Cancelado]
//   Select Nível: [Todos | Bronze | Prata | Ouro]
//   TextField busca: placeholder "Buscar por nome, CPF ou email"
//   IconButton de busca

// Tabela (MUI DataGrid):
//   Colunas: Nome | CPF | Email | Nível | Status | Vendas no Ano | Pedidos | Cadastro | Ações
```

### Estrutura da Tabela

**Colunas:**
- **Nome:** fullName
- **CPF:** formatado (3 primeiros + *** + 2 últimos: 123.***.**-45)
- **Email:** truncado se muito longo
- **Nível:** Chip colorido
  - Bronze → cor amarela
  - Prata → cor cinza
  - Ouro → cor dourada
- **Status:** Chip colorido
  - Pendente → amarelo
  - Aprovado → azul claro
  - Ativo → verde
  - Suspenso → laranja
  - Cancelado → vermelho
- **Vendas no Ano:** R$ formatado
- **Pedidos:** número
- **Cadastro:** data formatada DD/MM/YYYY
- **Ações:** IconButton "Ver Detalhes" (eye icon)

### Paginação

```typescript
// MUI TablePagination
// rowsPerPageOptions: [10, 20, 50]
// Atualizar URL com searchParams ao mudar página
```

### Modal de Detalhes do Revendedor

Ao clicar em "Ver Detalhes", abrir Drawer lateral (direita) fullHeight:

**Cabeçalho:**
```
[fullName]
Nível: [badge level] | Status: [badge status]
Código: [resellerCode] (botão copiar)
```

**Abas (MUI Tabs):**

**Aba 1 — Informações**
```
Dados Pessoais:
  Nome, CPF, Email, Telefone, Data de Cadastro

Dados Bancários:
  Banco, Agência, Conta, Tipo, Titular, CPF do Titular

Assinatura:
  Status: [badge]
  Próxima Cobrança: [data ou "N/A"]
```

**Aba 2 — Métricas**
```
Cards:
  Total de Pedidos: [X]
  Receita Total: R$ [X]
  Comissões Disponíveis: R$ [X]
  Comissões Sacadas: R$ [X]
  Vendas no Ano: R$ [X]
```

**Aba 3 — Histórico**
```
Timeline (MUI Timeline component):
  - Cadastro realizado em [data]
  - Aprovado por [admin] em [data] (se aplicável)
  - Rejeitado: [motivo] em [data] (se aplicável)
  - Assinatura criada em [data]
  - Suspenso: [motivo] em [data] (se aplicável)
```

**Footer do Drawer — Ações:**
- **Se status === 'active':**
  - Botão "SUSPENDER CONTA" (vermelho)
    → Dialog com campo de motivo obrigatório
    → POST /api/admin/resellers/:id/suspend

- **Se status === 'suspended':**
  - Botão "REATIVAR CONTA" (verde)
    → Confirmação simples
    → POST /api/admin/resellers/:id/reactivate

---

# 3. SAQUES — /admin/saques

**Função:** Aprovar, rejeitar ou marcar como pago os saques solicitados pelos revendedores.

## Backend — APIs necessárias

```typescript
GET  /api/admin/withdrawals?status=requested|approved|paid|rejected  [AdminGuard]
POST /api/admin/withdrawals/:id/approve  [AdminGuard]
POST /api/admin/withdrawals/:id/reject   [AdminGuard]  body: { reason: string }
POST /api/admin/withdrawals/:id/mark-paid  [AdminGuard]
```

### GET /api/admin/withdrawals

**Query SQL:**
```sql
SELECT w.id, w.amount, w.status, w.created_at, w.approved_at, w.paid_at,
       w.rejected_at, w.rejected_reason, w.bling_payable_id,
       r.full_name AS reseller_name, r.cpf, r.bank_name, r.bank_agency,
       r.bank_account, r.bank_account_type, r.bank_holder_name
FROM withdrawals w
INNER JOIN resellers r ON w.reseller_id = r.id
WHERE (:status IS NULL OR w.status = :status)
ORDER BY 
  CASE 
    WHEN w.status = 'requested' THEN 1
    WHEN w.status = 'approved' THEN 2
    ELSE 3
  END,
  w.created_at DESC
```

**Resposta:**
```typescript
{
  data: [
    {
      id: string,
      resellerName: string,
      resellerCpf: string,
      amount: number,
      status: 'requested' | 'approved' | 'paid' | 'rejected',
      bankInfo: {
        bankName, agency, account, accountType, holderName
      },
      createdAt: string,
      approvedAt: string | null,
      paidAt: string | null,
      rejectedAt: string | null,
      rejectedReason: string | null,
      blingPayableId: string | null
    }
  ]
}
```

### POST /api/admin/withdrawals/:id/approve

**Use Case — ApproveWithdrawalUseCase**
```typescript
// 1. Buscar withdrawal
// 2. Validar: status === 'requested'
// 3. Buscar dados do revendedor
// 4. Criar conta a pagar no Bling:
//    BlingPayablesClient.create({
//      fornecedor: { nome: resellerName, cpfCnpj: resellerCpf },
//      valor: amount,
//      vencimento: addDays(today, 5),  // 5 dias para pagar
//      historico: `Comissão revendedor - Saque #${withdrawal.id}`,
//      categoria: { id: X }  // categoria "Comissões" no Bling
//    })
// 5. withdrawal.approve(adminId, blingPayableId)
//    → SET status='approved', approved_at=NOW(), bling_payable_id=X
//    → EMIT WithdrawalApprovedEvent
// 6. Salvar
// 7. Handler → email 'withdrawal-approved' para revendedor
//    "Seu saque foi aprovado! Transferência em até 5 dias úteis."
```

### POST /api/admin/withdrawals/:id/reject

**Use Case — RejectWithdrawalUseCase**
```typescript
// 1. Buscar withdrawal
// 2. Validar: status === 'requested'
// 3. Validar: reason não vazio (min 10 chars)
// 4. withdrawal.reject(reason)
//    → SET status='rejected', rejected_at=NOW(), rejected_reason=reason
//    → EMIT WithdrawalRejectedEvent
// 5. Salvar
// 6. Handler → email 'withdrawal-rejected' com motivo
// IMPORTANTE: NÃO alterar status das commissions (permanecem 'available')
```

### POST /api/admin/withdrawals/:id/mark-paid

**Use Case — MarkWithdrawalAsPaidUseCase**
```typescript
// 1. Buscar withdrawal
// 2. Validar: status === 'approved'
// 3. withdrawal.markAsPaid()
//    → SET status='paid', paid_at=NOW()
//    → EMIT WithdrawalPaidEvent
// 4. Buscar commissions vinculadas (tabela withdrawal_commissions)
// 5. Para cada commission: status='withdrawn'
// 6. Salvar tudo em transação
// 7. Handler → email 'withdrawal-paid' para revendedor
//    "Seu saque de R$ X foi transferido!"
```

## Frontend — /admin/saques

### Layout da Página

```typescript
// Título: "Gestão de Saques"
// Subtítulo: "Aprove e gerencie os saques solicitados pelos revendedores"

// Abas (MUI Tabs):
//   Pendentes (badge com count) | Aprovados | Pagos | Rejeitados

// Cada aba carrega lista correspondente via GET /api/admin/withdrawals?status=X
```

### Aba "Pendentes" (status=requested)

**Tabela:**
- **Colunas:** Revendedor | CPF | Valor | Banco | Agência | Conta | Data Solicitação | Ações

**Ações por linha:**
- **Botão "APROVAR"** (verde, variant="contained", size="small")
  - Confirmação: "Aprovar saque de R$ X para [nome]? Uma conta a pagar será criada no Bling."
  - Loading durante processo (CircularProgress)
  - Sucesso: Toast verde "Saque aprovado! Conta criada no Bling." + move para aba "Aprovados"
  - Erro: Toast vermelho com mensagem do backend

- **Botão "REJEITAR"** (vermelho, variant="outlined", size="small")
  - Dialog com TextField obrigatório: "Motivo da rejeição"
  - Validação: min 10 chars
  - Confirmação interna: "Tem certeza? O revendedor será notificado."
  - Sucesso: Toast "Saque rejeitado" + move para aba "Rejeitados"

**Estado vazio:**
```
ícone CheckCircle verde
"Nenhum saque pendente"
"Solicitações aparecerão aqui automaticamente"
```

### Aba "Aprovados" (status=approved)

**Tabela:**
- **Colunas:** Revendedor | Valor | Banco | Ag. | Conta | Data Aprovação | ID Bling | Ações

**Ações por linha:**
- **Botão "MARCAR COMO PAGO"** (azul, variant="contained", size="small")
  - Confirmação: "Confirmar que o valor foi transferido para [nome]?"
  - Nota: "As comissões deste saque serão marcadas como sacadas."
  - Sucesso: Toast "Saque confirmado como pago!" + move para aba "Pagos"

**Estado vazio:**
```
ícone HourglassEmpty laranja
"Nenhum saque aguardando pagamento"
```

### Aba "Pagos" (status=paid)

**Tabela (readonly):**
- **Colunas:** Revendedor | Valor | Data Pagamento | ID Bling

**Sem ações.** Apenas visualização histórica.

### Aba "Rejeitados" (status=rejected)

**Tabela (readonly):**
- **Colunas:** Revendedor | Valor | Data Rejeição | Motivo

**Ações por linha:**
- **Botão "Ver Motivo"** → Dialog mostrando o motivo completo

---

# 4. PEDIDOS — /admin/pedidos

**Função:** Listar todos os pedidos, filtrar por status, ver detalhes, cancelar se necessário.

## Backend — APIs necessárias

```typescript
GET  /api/admin/orders?page=1&status=X&resellerCode=X&startDate=X&endDate=X&search=X  [AdminGuard]
GET  /api/admin/orders/:id  [AdminGuard]
POST /api/admin/orders/:id/cancel  [AdminGuard]  body: { reason: string }
```

### GET /api/admin/orders (lista paginada)

**Parâmetros de query:**
- `page`, `limit`
- `status`: 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'canceled'
- `resellerCode`: filtrar pedidos de um revendedor específico
- `startDate`, `endDate`: filtro por data
- `search`: número do pedido ou CPF do cliente

**Query SQL:**
```sql
SELECT o.id, o.order_number, o.customer_name, o.customer_cpf,
       o.total_amount, o.status, o.created_at, o.paid_at,
       r.full_name AS reseller_name, r.reseller_code,
       o.bling_order_id,
       (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS items_count
FROM orders o
LEFT JOIN resellers r ON o.reseller_id = r.id
WHERE (:status IS NULL OR o.status = :status)
  AND (:resellerCode IS NULL OR r.reseller_code = :resellerCode)
  AND (:startDate IS NULL OR o.created_at >= :startDate)
  AND (:endDate IS NULL OR o.created_at <= :endDate)
  AND (:search IS NULL OR o.order_number ILIKE '%' || :search || '%' 
       OR o.customer_cpf ILIKE '%' || :search || '%')
ORDER BY o.created_at DESC
LIMIT :limit OFFSET (:page - 1) * :limit
```

**Resposta:**
```typescript
{
  data: [
    {
      id: string,
      orderNumber: string,
      customerName: string,
      customerCpf: string,
      resellerName: string | null,
      resellerCode: string | null,
      totalAmount: number,
      itemsCount: number,
      status: string,
      createdAt: string,
      paidAt: string | null,
      blingOrderId: string | null
    }
  ],
  pagination: { ... }
}
```

### GET /api/admin/orders/:id (detalhes completos)

**Query SQL:**
```sql
SELECT o.*, 
       r.full_name AS reseller_name, r.reseller_code,
       (SELECT json_agg(
         json_build_object(
           'id', oi.id, 'productName', oi.product_name, 'productSku', oi.product_sku,
           'quantity', oi.quantity, 'unitPrice', oi.unit_price, 'totalPrice', oi.total_price
         )
       ) FROM order_items oi WHERE oi.order_id = o.id) AS items,
       c.amount AS commission_amount, c.status AS commission_status
FROM orders o
LEFT JOIN resellers r ON o.reseller_id = r.id
LEFT JOIN commissions c ON c.order_id = o.id
WHERE o.id = :id
```

**Resposta:**
```typescript
{
  id: string,
  orderNumber: string,
  
  customer: {
    name, cpf, email, phone
  },
  
  address: {
    zipCode, street, number, complement, neighborhood, city, state
  },
  
  items: [
    { id, productName, productSku, quantity, unitPrice, totalPrice }
  ],
  
  payment: {
    method: string,
    installments: number,
    cieloPaymentId: string
  },
  
  shipping: {
    carrier, service, trackingCode, estimatedDays, cost
  },
  
  amounts: {
    subtotal, discountAmount, shippingCost, totalAmount
  },
  
  reseller: {
    name, code
  } | null,
  
  commission: {
    amount, status
  } | null,
  
  status: string,
  blingOrderId: string | null,
  couponCode: string | null,
  createdAt, paidAt, shippedAt, deliveredAt, canceledAt
}
```

### POST /api/admin/orders/:id/cancel

**Use Case — CancelOrderUseCase**
```typescript
// 1. Buscar order
// 2. Validar: status IN ('paid', 'processing')  // não pode cancelar shipped/delivered
// 3. Validar: reason não vazio
// 4. order.cancel(reason)
//    → SET status='canceled', canceled_at=NOW()
//    → EMIT OrderCanceledEvent
// 5. Se commission existe:
//    → commission.reverse()
//    → SET commission.status='reversed'
//    → EMIT CommissionReversedEvent
// 6. Salvar tudo em transação
// 7. Handlers:
//    → email para cliente: "Pedido cancelado: [motivo]"
//    → email para revendedor (se houver): "Comissão revertida"
//    → tentar cancelar no Bling (assíncrono, não bloquear)
```

## Frontend — /admin/pedidos

### Layout da Página

```typescript
// Título: "Gestão de Pedidos"
// Subtítulo: "Visualize e gerencie todos os pedidos da plataforma"

// Barra de filtros:
//   Select Status: [Todos | Aguardando Pgto | Pago | Em Processamento | Enviado | Entregue | Cancelado]
//   DateRangePicker: data de início → data fim
//   TextField busca: "Buscar por número do pedido ou CPF"
//   Botão "Filtrar"
//   Botão "Limpar Filtros"

// Tabela (MUI DataGrid):
//   Colunas: # Pedido | Cliente | Revendedor | Valor | Itens | Status | Data | Ações
```

### Estrutura da Tabela

**Colunas:**
- **# Pedido:** orderNumber (clicável, abre detalhes)
- **Cliente:** customerName
- **Revendedor:** resellerName ou "—" (se venda direta)
- **Valor:** R$ formatado
- **Itens:** itemsCount
- **Status:** Chip colorido
  - pending_payment → amarelo "Aguardando Pagamento"
  - paid → azul "Pago"
  - processing → laranja "Processando"
  - shipped → roxo "Enviado"
  - delivered → verde "Entregue"
  - canceled → vermelho "Cancelado"
- **Data:** DD/MM/YYYY HH:mm
- **Ações:** IconButton "Ver Detalhes"

### Drawer de Detalhes do Pedido

Abrir Drawer lateral (direita) ao clicar em linha ou "Ver Detalhes":

**Cabeçalho:**
```
Pedido #[orderNumber]
Status: [badge colorido]
[Se blingOrderId] Bling ID: [blingOrderId] (link externo)
```

**Seções:**

**1. Cliente**
```
Nome: [customerName]
CPF: [cpf]
Email: [email]
Telefone: [phone]
```

**2. Endereço de Entrega**
```
[street], [number] [complement]
[neighborhood] - [city]/[state]
CEP: [zipCode]
```

**3. Itens do Pedido**
```
Tabela:
  SKU | Produto | Quantidade | Preço Unit. | Total
[para cada item]
```

**4. Pagamento**
```
Método: [method]
Parcelamento: [installments]x
Cielo Payment ID: [cieloPaymentId]
```

**5. Frete**
```
Transportadora: [carrier]
Serviço: [service]
Prazo: [estimatedDays] dias
Código de Rastreio: [trackingCode] (se existir, link Correios/transportadora)
Custo: R$ [shippingCost]
```

**6. Valores**
```
Subtotal: R$ [subtotal]
Desconto: R$ [discountAmount]  [se couponCode] Cupom: [couponCode]
Frete: R$ [shippingCost]
──────────────
TOTAL: R$ [totalAmount]
```

**7. Revendedor e Comissão** (se houver)
```
Revendedor: [resellerName]
Código: [resellerCode]
Comissão: R$ [commissionAmount]
Status da Comissão: [badge commission.status]
```

**8. Timeline**
```
MUI Timeline:
  - Pedido criado: [createdAt]
  - Pagamento confirmado: [paidAt] (se status >= paid)
  - Enviado: [shippedAt] (se status >= shipped)
  - Entregue: [deliveredAt] (se status = delivered)
  - Cancelado: [canceledAt] + motivo (se status = canceled)
```

**Footer — Ações:**
- **Se status IN ('paid', 'processing'):**
  - Botão "CANCELAR PEDIDO" (vermelho)
    → Dialog com campo "Motivo do cancelamento" obrigatório
    → Aviso: "A comissão será revertida se existir"
    → POST /api/admin/orders/:id/cancel

---

# 5. PRODUTOS — /admin/produtos

**Função:** Listar produtos sincronizados do Bling, ativar/desativar, editar informações, forçar sincronização.

## Backend — APIs necessárias

```typescript
GET  /api/admin/products?page=1&inStock=true&isActive=true&category=X&search=X  [AdminGuard]
GET  /api/admin/products/:id  [AdminGuard]
PUT  /api/admin/products/:id  [AdminGuard]  body: { name, description, isActive }
POST /api/admin/products/sync  [AdminGuard]
GET  /api/admin/products/sync/status  [AdminGuard]
```

### GET /api/admin/products (lista paginada)

**Parâmetros:**
- `page`, `limit`
- `inStock`: boolean (filtrar apenas com stock > 0)
- `isActive`: boolean
- `category`: string
- `search`: busca por nome ou SKU

**Query SQL:**
```sql
SELECT p.id, p.sku, p.name, p.price, p.cost_price, p.stock, p.category_name,
       p.is_active, p.last_synced_at,
       (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) AS image_url
FROM products p
WHERE (:inStock IS NULL OR (:inStock = true AND p.stock > 0))
  AND (:isActive IS NULL OR p.is_active = :isActive)
  AND (:category IS NULL OR p.category_name = :category)
  AND (:search IS NULL OR p.name ILIKE '%' || :search || '%' OR p.sku ILIKE '%' || :search || '%')
ORDER BY p.name ASC
LIMIT :limit OFFSET (:page - 1) * :limit
```

**Resposta:**
```typescript
{
  data: [
    {
      id: string,
      sku: string,
      name: string,
      imageUrl: string | null,
      price: number,
      costPrice: number,
      stock: number,
      categoryName: string,
      isActive: boolean,
      lastSyncedAt: string
    }
  ],
  pagination: { ... }
}
```

### POST /api/admin/products/sync

**Use Case — SyncProductsFromBlingUseCase** (já implementado na Fase 3)
```typescript
// Dispara sincronização manual
// Retorna job ID ou executa síncrono (dependendo da implementação)
// Resposta: { success: true, jobId: string, message: "Sincronização iniciada" }
```

### GET /api/admin/products/sync/status

**Query da última sincronização:**
```sql
-- Criar tabela sync_logs se não existe
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,  -- 'products' | 'images'
  status VARCHAR(20) NOT NULL,  -- 'running' | 'completed' | 'failed'
  created_count INT DEFAULT 0,
  updated_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP
);

SELECT * FROM sync_logs
WHERE type = 'products'
ORDER BY started_at DESC
LIMIT 1
```

**Resposta:**
```typescript
{
  lastSync: {
    status: 'completed' | 'failed' | 'running',
    startedAt: string,
    finishedAt: string | null,
    created: number,
    updated: number,
    errors: number,
    errorMessage: string | null
  } | null
}
```

### PUT /api/admin/products/:id

**Use Case — UpdateProductUseCase**
```typescript
// Permite editar apenas:
//   - name (sobrescreve do Bling)
//   - description (complementar à descrição do Bling)
//   - isActive (ativa/desativa venda no site)
// Campos do Bling (price, stock, sku) são readonly (só atualizam via sync)
```

## Frontend — /admin/produtos

### Layout da Página

```typescript
// Título: "Gestão de Produtos"
// Subtítulo: "Produtos sincronizados automaticamente do Bling"

// Barra superior:
//   Botão "SINCRONIZAR COM BLING" (amarelo, ícone Sync)
//   Chip com status da última sync:
//     "Última sincronização: [data]" (verde se completed, vermelho se failed, laranja se running)

// Barra de filtros:
//   Select: [Todos | Apenas ativos | Apenas inativos]
//   Select: [Todos | Somente em estoque | Somente esgotados]
//   TextField busca: "Buscar por nome ou SKU"

// Tabela (MUI DataGrid):
//   Colunas: Imagem | SKU | Nome | Preço | Custo | Estoque | Categoria | Ativo | Última Sync | Ações
```

### Estrutura da Tabela

**Colunas:**
- **Imagem:** thumbnail 60x60px (ou placeholder se null)
- **SKU:** sku
- **Nome:** name (truncado se longo, tooltip com nome completo)
- **Preço:** R$ formatado
- **Custo:** R$ formatado (cost_price)
- **Estoque:** stock
  - Verde se > 10
  - Laranja se 1-10
  - Vermelho se 0
- **Categoria:** categoryName (Chip pequeno)
- **Ativo:** Switch (MUI Switch)
  - onChange → PUT /api/admin/products/:id { isActive: !current }
  - Feedback imediato (otimista) + toast em erro
- **Última Sync:** data formatada relativa ("há 2 horas")
- **Ações:** IconButton "Editar" (pencil icon)

### Dialog de Edição do Produto

Ao clicar em "Editar", abrir Dialog:

**Campos editáveis:**
```
Nome: TextField (value: name)
  Hint: "Este nome sobrescreve o nome do Bling no site"

Descrição: TextField multiline (rows 4)
  Hint: "Adicione informações complementares"

Ativo: Switch
  "Produto visível no site"
```

**Campos readonly (exibir mas desabilitados):**
```
SKU: [sku]
Preço: R$ [price] (sincronizado do Bling)
Estoque: [stock] (sincronizado do Bling)
```

**Botões:**
- Cancelar
- Salvar → PUT /api/admin/products/:id

### Botão "Sincronizar com Bling"

```typescript
// Ao clicar:
// 1. Desabilitar botão
// 2. Exibir LinearProgress abaixo da barra superior
// 3. POST /api/admin/products/sync
// 4. Polling GET /api/admin/products/sync/status a cada 2 segundos
// 5. Quando status !== 'running':
//    - Parar polling
//    - Exibir toast:
//      success: "Sincronização concluída! Criados: X | Atualizados: Y"
//      error: "Falha na sincronização: [errorMessage]"
//    - Recarregar lista de produtos
```

---

# 6. MATERIAIS — /admin/materiais

**Função:** Fazer upload de materiais de marketing para os revendedores (imagens, banners, catálogos, vídeos).

## Backend — APIs necessárias

```typescript
GET    /api/admin/materials  [AdminGuard]
POST   /api/admin/materials  [AdminGuard]  multipart/form-data
PUT    /api/admin/materials/:id  [AdminGuard]  body: { title, description, isActive }
DELETE /api/admin/materials/:id  [AdminGuard]
```

### POST /api/admin/materials (upload)

**Use Case — UploadMaterialUseCase**
```typescript
// 1. Validar arquivo:
//    - Tipos aceitos: image/*, application/pdf, video/*
//    - Tamanho máximo: 50MB (imagens/PDF), 200MB (vídeos)
// 2. Upload para Supabase Storage (bucket: 'materials'):
//    - Gerar nome único: `${timestamp}-${originalName}`
//    - folder: materials/[type]/
// 3. Se imagem: gerar thumbnail com sharp (400x300px)
//    - Upload thumbnail: materials/thumbnails/
// 4. Criar registro no banco:
//    INSERT INTO materials (title, description, type, file_url, thumbnail_url, is_active)
// 5. Retornar material criado
```

**Types de material:**
- `'image'` → imagens gerais (JPEG, PNG, WebP)
- `'banner'` → banners promocionais
- `'catalog'` → catálogos PDF
- `'video'` → vídeos (MP4, WebM)
- `'copy'` → textos prontos (salvar como TXT)

### DELETE /api/admin/materials/:id

**Use Case — DeleteMaterialUseCase**
```typescript
// 1. Buscar material
// 2. Deletar arquivo do Supabase Storage
// 3. Deletar thumbnail (se existir)
// 4. DELETE FROM materials WHERE id = X
// 5. Retornar { success: true }
```

## Frontend — /admin/materiais

### Layout da Página

```typescript
// Título: "Materiais de Marketing"
// Subtítulo: "Gerencie os materiais disponíveis para os revendedores"

// Botão no topo direito:
//   "NOVO MATERIAL" (amarelo, ícone AddCircle)

// Filtros:
//   Chips: Todos | Imagens | Banners | Catálogos | Vídeos | Textos

// Grid de cards (MUI Grid, cols: 3 em desktop, 1 em mobile):
//   Cada card mostra:
//     Thumbnail (ou ícone do tipo se vídeo/PDF)
//     Título
//     Tipo (chip)
//     Descrição (truncada)
//     Switch "Ativo"
//     Botões: Editar | Remover
```

### Card de Material

```typescript
// Card (MUI Card) com elevation 2:
//   CardMedia: thumbnail_url ou ícone
//   CardContent:
//     Typography variant="h6": title
//     Chip size="small": type
//     Typography variant="body2" color="text.secondary": description (max 100 chars)
//   CardActions:
//     Switch checked={isActive} onChange={toggle} → PUT /api/admin/materials/:id
//     IconButton "Editar"
//     IconButton "Remover" (confirmação antes de deletar)
```

### Dialog "Novo Material"

Ao clicar em "NOVO MATERIAL", abrir Dialog fullWidth maxWidth="sm":

**Campos:**
```
Título: TextField required
  placeholder: "Ex: Banner Promoção Verão 2025"

Tipo: Select required
  options: Imagem | Banner | Catálogo | Vídeo | Texto

Descrição: TextField multiline rows 3
  placeholder: "Descreva o material para os revendedores"

Arquivo: Componente de upload (FileInput)
  Drag & drop ou clique para selecionar
  Validar tipo e tamanho antes de enviar
  Preview do arquivo após seleção

Ativo: Switch (default: true)
```

**Botões:**
- Cancelar
- Enviar → POST /api/admin/materials (FormData)

**Feedback:**
```typescript
// Durante upload: LinearProgress
// Sucesso: Toast "Material enviado com sucesso!" + fecha dialog + recarrega lista
// Erro: Toast vermelho com mensagem
```

### Dialog "Editar Material"

Mesmos campos, exceto "Arquivo" (não pode trocar o arquivo, só deletar e criar novo).

### Confirmação de Remoção

```typescript
// Dialog de confirmação:
//   "Remover material '[title]'?"
//   "Esta ação não pode ser desfeita. O arquivo será removido do storage."
//   Botões: Cancelar | Remover (vermelho)
```

---

# 7. CONFIGURAÇÕES — /admin/configuracoes

**Função:** Configurar regras de comissão, integrações, dados da empresa.

## Backend — APIs necessárias

```typescript
GET /api/admin/config  [AdminGuard]
PUT /api/admin/config  [AdminGuard]  body: { key: string, value: string }
GET /api/admin/integrations/bling/status  [AdminGuard]
GET /api/admin/integrations/cielo/status  [AdminGuard]
```

### GET /api/admin/config

```sql
SELECT key, value FROM system_config
```

**Resposta:**
```typescript
{
  commissionTier1: { minAmount: 0, maxAmount: 1000, percentage: 10 },
  commissionTier2: { minAmount: 1001, maxAmount: 2000, percentage: 15 },
  commissionTier3: { minAmount: 2001, maxAmount: 5000, percentage: 20 },
  commissionTier4: { minAmount: 5001, maxAmount: null, percentage: 30 },
  commissionGraceDays: 30,
  withdrawalMinimumAmount: 50.00,
  subscriptionPrice: 9.90,
  subscriptionGraceDays: 7
}
```

### PUT /api/admin/config

**Use Case — UpdateSystemConfigUseCase**
```typescript
// 1. Validar key existe na tabela
// 2. Validar value (dependendo da key):
//    - commission_tier_X: deve ser JSON válido com structure { minAmount, maxAmount, percentage }
//    - numeric configs: verificar se é número positivo
// 3. UPDATE system_config SET value = :value, updated_at = NOW() WHERE key = :key
// 4. Invalidar cache (se houver)
// 5. Retornar { success: true }
```

## Frontend — /admin/configuracoes

### Layout da Página

```typescript
// Título: "Configurações do Sistema"
// Subtítulo: "Gerencie regras de comissão, integrações e preferências"

// Accordion (MUI Accordion) com as seções:
//   1. Regras de Comissão
//   2. Políticas de Saque
//   3. Assinatura
//   4. Integrações
```

### Seção 1 — Regras de Comissão

```typescript
// AccordionSummary: "Regras de Comissão"
// AccordionDetails:

// Tabela editável:
//   Colunas: Faixa de Vendas | Percentual de Comissão

// 4 linhas (uma por tier):
//   TextField: "R$ X a R$ Y" | TextField: "Z%"

// Exemplo:
//   Faixa 1: R$ 0 a R$ 1.000 → 10%
//   Faixa 2: R$ 1.001 a R$ 2.000 → 15%
//   Faixa 3: R$ 2.001 a R$ 5.000 → 20%
//   Faixa 4: Acima de R$ 5.001 → 30%

// Campo adicional:
//   "Dias de carência para liberar comissão": TextField number (default 30)

// Botão "SALVAR COMISSÕES" (amarelo)
//   → Para cada tier: PUT /api/admin/config { key, value }
//   → Toast "Configurações salvas com sucesso!"
```

### Seção 2 — Políticas de Saque

```typescript
// AccordionSummary: "Políticas de Saque"
// AccordionDetails:

// Campo:
//   "Valor mínimo para saque": TextField number (prefix "R$", default 50.00)

// Botão "SALVAR"
//   → PUT /api/admin/config { key: 'withdrawal_minimum_amount', value: X }
```

### Seção 3 — Assinatura

```typescript
// AccordionSummary: "Assinatura dos Revendedores"
// AccordionDetails:

// Campos:
//   "Valor da assinatura mensal": TextField readonly (R$ 9,90)
//     Hint: "Alteração requer migração manual no Cielo"

//   "Dias de carência para inadimplentes": TextField number (default 7)
//     Hint: "Após X dias sem pagamento, a conta é cancelada automaticamente"

// Botão "SALVAR"
//   → PUT /api/admin/config { key: 'subscription_grace_days', value: X }
```

### Seção 4 — Integrações

```typescript
// AccordionSummary: "Integrações com Sistemas Externos"
// AccordionDetails:

// Cards (Grid 2 colunas):

// Card 1 — Bling
//   Ícone + "Bling ERP"
//   Status: Chip verde "Conectado" ou vermelho "Desconectado"
//   Última sincronização: [data]
//   Botão "Reconectar" → GET /api/admin/bling/auth
//   Botão "Sincronizar Agora" → POST /api/admin/products/sync

// Card 2 — Cielo
//   Ícone + "Cielo Pagamentos"
//   Status: Chip verde "Ativo" ou vermelho "Erro"
//   Último pagamento processado: [data]
//   Botão "Testar Conexão" → GET /api/admin/integrations/cielo/status

// Card 3 — Melhor Envio
//   Ícone + "Melhor Envio"
//   Status: Chip (verde/vermelho)
//   Botão "Testar Conexão"

// Card 4 — Magis5
//   Ícone + "Magis5 Imagens"
//   Status: Chip (verde/vermelho)
//   Última sincronização de imagens: [data]
```

---

# CHECKLIST DE CONCLUSÃO — PAINEL ADMIN

```
APROVAÇÕES
[ ] GET /api/admin/resellers/pending funciona
[ ] POST /api/admin/resellers/:id/approve funciona
[ ] POST /api/admin/resellers/:id/reject funciona
[ ] Tabela lista cadastros pendentes
[ ] Modal de análise abre com dados completos
[ ] Aprovar gera código único e envia email
[ ] Rejeitar exige motivo e envia email
[ ] Estado vazio exibido corretamente

REVENDEDORES
[ ] GET /api/admin/resellers com filtros funciona
[ ] GET /api/admin/resellers/:id funciona
[ ] Tabela lista todos os revendedores
[ ] Filtros por status, nível e busca funcionam
[ ] Drawer de detalhes abre e mostra 3 abas
[ ] Suspender revendedor funciona
[ ] Reativar revendedor funciona
[ ] Paginação funciona

SAQUES
[ ] GET /api/admin/withdrawals funciona
[ ] POST /api/admin/withdrawals/:id/approve funciona (cria no Bling)
[ ] POST /api/admin/withdrawals/:id/reject funciona
[ ] POST /api/admin/withdrawals/:id/mark-paid funciona (muda commissions)
[ ] 4 abas funcionam (Pendentes, Aprovados, Pagos, Rejeitados)
[ ] Aprovar cria conta a pagar no Bling
[ ] Marcar pago altera status das comissões
[ ] Estados vazios exibidos em cada aba

PEDIDOS
[ ] GET /api/admin/orders com filtros funciona
[ ] GET /api/admin/orders/:id funciona
[ ] POST /api/admin/orders/:id/cancel funciona
[ ] Tabela lista pedidos com filtros
[ ] Drawer de detalhes mostra todas as seções
[ ] Cancelar pedido reverte comissão
[ ] Filtro por data funciona
[ ] Busca por número/CPF funciona

PRODUTOS
[ ] GET /api/admin/products funciona
[ ] PUT /api/admin/products/:id funciona
[ ] POST /api/admin/products/sync funciona
[ ] GET /api/admin/products/sync/status funciona
[ ] Tabela lista produtos com imagens
[ ] Switch ativo/inativo funciona inline
[ ] Dialog de edição funciona
[ ] Sincronizar com Bling funciona e mostra progresso
[ ] Status da última sync exibido

MATERIAIS
[ ] GET /api/admin/materials funciona
[ ] POST /api/admin/materials funciona (upload Supabase)
[ ] PUT /api/admin/materials/:id funciona
[ ] DELETE /api/admin/materials/:id funciona
[ ] Grid de cards exibe materiais
[ ] Upload de arquivo funciona (drag & drop)
[ ] Preview de arquivo funciona
[ ] Thumbnails gerados para imagens
[ ] Remoção com confirmação funciona

CONFIGURAÇÕES
[ ] GET /api/admin/config funciona
[ ] PUT /api/admin/config funciona
[ ] 4 seções em Accordion
[ ] Editar regras de comissão funciona
[ ] Editar valor mínimo de saque funciona
[ ] Editar dias de carência funciona
[ ] Cards de integração mostram status real
[ ] Botões de reconectar/testar funcionam
```

---

# VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```env
# Supabase (para materiais)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhb...
SUPABASE_STORAGE_BUCKET=materials

# Bling (OAuth configurado na Fase 3)
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=http://localhost:3001/api/admin/bling/callback

# Demais variáveis já configuradas nas fases anteriores
```

---

# ORDEM DE DESENVOLVIMENTO RECOMENDADA

```
1. APROVAÇÕES (crítico — bloqueia tudo)
   Backend: ApproveResellerUseCase + RejectResellerUseCase + emails
   Frontend: tabela + modal + ações
   
2. SAQUES (crítico — receita dos revendedores)
   Backend: ApproveWithdrawalUseCase (integração Bling) + MarkAsPaidUseCase
   Frontend: 4 abas + tabelas + ações
   
3. REVENDEDORES (gestão completa)
   Backend: lista paginada + detalhes + suspend/reactivate
   Frontend: tabela + filtros + drawer 3 abas
   
4. PEDIDOS (gestão de vendas)
   Backend: lista paginada + detalhes + cancelar
   Frontend: tabela + filtros + drawer + cancelamento
   
5. PRODUTOS (gestão de catálogo)
   Backend: lista + editar + sync Bling
   Frontend: tabela + dialog edição + botão sync
   
6. MATERIAIS (suporte aos revendedores)
   Backend: upload Supabase + CRUD
   Frontend: grid cards + upload drag&drop
   
7. CONFIGURAÇÕES (ajustes finos)
   Backend: get/put config + status integrações
   Frontend: 4 seções accordion
```

---

**Este documento deve ser usado pelo Codex para desenvolver as 7 páginas restantes do painel admin.**  
**Dashboard já está funcional. Foco nas páginas listadas acima.**  
**Seguir padrões do CLAUDE.md e arquitetura hexagonal.**
