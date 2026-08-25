# PENDÊNCIAS COMPLETAS — KAZA TEM IMPORTS
## Validação do Código vs. Documentação (Entrega 5)

> **Data da análise:** 28/02/2026
> **Método:** Leitura de todos os arquivos em `docs/modulos/` (Entregas 1–4) + auditoria do código em `apps/kaza-tem-system/` + leitura da conversa original (PDF 51 páginas: "Site de produtos com sistema de revendedores _ Claude.pdf")
> **Convenção:** ✅ Implementado | ⚠️ Parcial/Stub | ❌ Não implementado

---

## RESUMO EXECUTIVO

| Área | Status Geral |
|------|-------------|
| Autenticação (Auth) | ✅ Completo |
| Cadastro de Revendedores | ⚠️ Parcial (falta telefone, banco, frontend) |
| Aprovação/Rejeição (Admin) | ⚠️ Parcial (backend OK, frontend básico) |
| Assinatura (Subscription) | ⚠️ Parcial (criação OK, cancelamento ausente) |
| Pedidos (Orders) | ⚠️ Parcial (estrutura OK, rastreamento incompleto) |
| Pagamento Cielo | ⚠️ Parcial (cartão de crédito OK, boleto ausente) |
| Comissões | ⚠️ Parcial (cálculo OK, liberação automática incompleta) |
| Saques (Withdrawals) | ⚠️ Parcial (fluxo básico OK, banco info ausente) |
| Produtos/Catálogo | ⚠️ Parcial (listagem OK, imagens ausentes) |
| Cupons | ❌ Totalmente ausente |
| Materiais de Marketing | ❌ Totalmente ausente (backend) |
| Tracking/Rastreamento | ⚠️ Parcial (visitas OK, tracking pedido incompleto) |
| Integrações (Bling/Melhor Envio/Magis5) | ⚠️ Parcial |
| Frontend Admin | ⚠️ Parcial (várias páginas em placeholder) |
| Frontend Revendedor | ⚠️ Parcial (dashboard básico, páginas ausentes) |
| Frontend Loja | ⚠️ Parcial (checkout sem cupom/CEP lookup) |
| E-mails Transacionais | ⚠️ Parcial (serviço existe, sem templates HTML) |

---

## 1. BANCO DE DADOS

### 1.1 Tabelas Ausentes

| Tabela | Motivo | Prioridade |
|--------|--------|-----------|
| `product_images` | Definida na Entrega 3; entidade/repositório/mapper não existem | 🟡 Alta |
| `coupons` | Definida na Entrega 3; contexto inteiro ausente | 🔴 Crítica |
| `materials` | Definida na Entrega 3; contexto backend ausente | 🟡 Alta |
| `withdrawal_commissions` | Junction table para rastrear quais comissões foram incluídas no saque | 🟡 Alta |

### 1.2 Campos Ausentes nas Tabelas Existentes

| Tabela | Campo | Status |
|--------|-------|--------|
| `resellers` | `phone` — capturado no cadastro mas não no formulário frontend | ⚠️ |
| `resellers` | `bank_name`, `bank_code`, `bank_agency`, `bank_account`, `bank_account_type`, `bank_holder_name`, `bank_holder_cpf` — dados bancários para saque; não capturados na registration | ❌ |
| `resellers` | `total_sold_year` — não é atualizado automaticamente nos eventos | ⚠️ |
| `resellers` | `unique_link` está como `reseller_code` na doc mas como `uniqueLink` no código; verificar consistência na migration | ⚠️ |
| `orders` | `coupon_code` — campo existe na migration mas não há lógica de cupom | ❌ |
| `orders` | `discount_amount` — campo existe mas nunca populado (sem sistema de cupom) | ❌ |

---

## 2. BACKEND — CONTEXTOS FALTANTES

### 2.1 Contexto: Cupons (CRÍTICO)

**Arquivo:** `src/contexts/coupon/` — **NÃO EXISTE**

Pendências:
- [ ] Entidade de domínio `Coupon` (domain/entities/coupon.entity.ts)
- [ ] Value objects: `CouponCode`, `DiscountType`, `CouponId`
- [ ] Use Cases:
  - [ ] `CreateCouponUseCase` — admin cria cupom (percentual ou fixo, com validade e limite de uso)
  - [ ] `ValidateCouponUseCase` — valida se cupom existe, está ativo, dentro da validade e não excedeu uso
  - [ ] `ApplyCouponUseCase` — aplica cupom ao checkout, incrementa `usage_count`
  - [ ] `ListCouponsUseCase` — admin lista todos os cupons
  - [ ] `CreateResellerCouponUseCase` — revendedor cria cupom para seus clientes
- [ ] ORM Entity: `CouponOrmEntity`
- [ ] Mapper, Repository, Module
- [ ] API Endpoints:
  - [ ] `POST /api/admin/coupons` — admin cria cupom
  - [ ] `GET /api/admin/coupons` — admin lista cupons
  - [ ] `DELETE /api/admin/coupons/:id` — admin desativa cupom
  - [ ] `GET /api/coupons/validate?code=X` — qualquer usuário valida código
  - [ ] `POST /api/resellers/coupons` — revendedor cria cupom próprio
  - [ ] `GET /api/resellers/coupons` — revendedor lista seus cupons

**Regras de negócio (Entrega 3):**
- Cupom pode ser criado pelo admin (desconto global) ou pelo revendedor (para seus clientes)
- Tipo: percentual (`percentage`) ou valor fixo (`fixed`)
- Validação: ativo, dentro da data, dentro do limite de uso
- Ao aplicar: `usage_count++`, `discount_amount` calculado no pedido
- Comissão do revendedor incide sobre `subtotal - discount_amount`

---

### 2.2 Contexto: Materiais de Marketing

**Arquivo:** `src/contexts/materials/` — **NÃO EXISTE**

Pendências:
- [ ] Entidade de domínio `Material`
- [ ] Use Cases:
  - [ ] `CreateMaterialUseCase` — admin faz upload de banner, imagem, texto
  - [ ] `ListMaterialsUseCase` — revendedor lista materiais disponíveis
  - [ ] `DeleteMaterialUseCase` — admin remove material
- [ ] ORM Entity, Mapper, Repository, Module
- [ ] API Endpoints:
  - [ ] `GET /api/materials` — lista materiais (revendedores autenticados)
  - [ ] `POST /api/admin/materials` — admin cria material (upload de arquivo)
  - [ ] `DELETE /api/admin/materials/:id` — admin remove material
- [ ] Integração com armazenamento de arquivos (S3 ou similar) para uploads

---

### 2.3 Contexto: Imagens de Produtos

**Arquivo:** `src/infrastructure/persistence/mikro-orm/entities/product-images-orm.entity.ts` — **NÃO EXISTE**

Pendências:
- [ ] ORM Entity `ProductImageOrmEntity` mapeando a tabela `product_images`
- [ ] Campo `images` na entidade `ProductOrmEntity`
- [ ] Campo `images` na entidade de domínio `Product`
- [ ] Sincronização de imagens no `BlingProductSyncService` / `Magis5Service`
- [ ] Endpoint `GET /api/products/:id` deve retornar array de imagens
- [ ] Frontend: exibir imagens no catálogo e na página de detalhe

---

## 3. BACKEND — USE CASES / ENDPOINTS AUSENTES

### 3.1 Gestão de Revendedores (Admin)

| Funcionalidade | Endpoint | Status |
|---------------|---------|--------|
| Suspender revendedor | `POST /api/admin/resellers/:id/suspend` | ❌ |
| Reativar revendedor | `POST /api/admin/resellers/:id/reactivate` | ❌ |
| Listar revendedores (paginado + filtros) | `GET /api/admin/resellers?status=X&level=X&search=X` | ⚠️ Básico |
| Detalhe do revendedor (com métricas SQL) | `GET /api/admin/resellers/:id` (com sub-queries) | ⚠️ Básico |

**Use cases faltantes:**
- [ ] `SuspendResellerUseCase` — admin suspende revendedor; emite `ResellerSuspendedEvent`; cancela assinatura Cielo
- [ ] `ReactivateResellerUseCase` — admin reativa; emite `ResellerReactivatedEvent`

---

### 3.2 Registro de Revendedor (Frontend → Backend)

**Status:** Formulário de cadastro NÃO existe no frontend. Backend tem `RegisterResellerUseCase` mas:
- [ ] Frontend: Página `/auth/register` ou `/auth/cadastro-revendedor` — **NÃO EXISTE**
- [ ] Formulário deve coletar: nome, CPF, telefone, dados bancários (banco, agência, conta, titular)
- [ ] Backend: `RegisterResellerCommand` não inclui `phone` nem dados bancários
- [ ] `ResellerOrmEntity` não tem campos de dados bancários
- [ ] Migration não tem colunas `bank_*` (verificar se foram criadas)

---

### 3.3 Cancelamento de Assinatura

| Funcionalidade | Endpoint | Status |
|---------------|---------|--------|
| Cancelar assinatura | `DELETE /api/subscriptions/:id` | ❌ |
| Verificar status assinatura | `GET /api/subscriptions/me` | ❌ |

**Pendências:**
- [ ] `CancelSubscriptionUseCase` — chama Cielo para cancelar recorrência, atualiza status no banco
- [ ] Endpoint `DELETE /api/subscriptions/:id`
- [ ] Job já existe (`check-suspended-subscriptions.job.ts`) mas precisa verificar se está conectado corretamente ao scheduler

---

### 3.4 Listagem de Pedidos do Revendedor

| Funcionalidade | Endpoint | Status |
|---------------|---------|--------|
| Listar pedidos do revendedor logado | `GET /api/resellers/orders` | ❌ |
| Detalhe de pedido do revendedor | `GET /api/resellers/orders/:id` | ❌ |

**Pendências:**
- [ ] `ListResellerOrdersUseCase`
- [ ] Endpoint protegido com `ResellerGuard`
- [ ] Retorna pedidos vinculados ao `reseller_id` do revendedor logado

---

### 3.5 Processamento de Comissões

| Funcionalidade | Status |
|---------------|--------|
| Calcular comissão ao pagar pedido | ⚠️ Use case existe mas event handler pode não estar conectado |
| Liberar comissões após 30 dias (job agendado) | ⚠️ Use case existe, verificar se há scheduler configurado |
| Reverter comissão em caso de cancelamento de pedido | ❌ |
| Atualizar `total_sold_year` do revendedor ao fechar pedido | ❌ |
| Auto-upgrade de nível (bronze → prata → ouro) com base em vendas | ❌ |

**Regras de nível (Entrega 3):**
```
bronze → prata: R$ 5.000 em vendas no mês
prata  → ouro:  R$ 15.000 em vendas no mês
```

**Pendências:**
- [ ] `CheckLevelUpgradeUseCase` — roda após cada venda confirmada; verifica se revendedor subiu de nível
- [ ] Event handler em `OrderPaidEvent` → acionar `CheckLevelUpgradeUseCase`
- [ ] Event handler em `OrderCanceledEvent` → reverter comissão (status `reversed`)
- [ ] Job agendado para `ReleasePendingCommissionsUseCase` (já existe o use case, falta o scheduler)

---

### 3.6 Dados Bancários para Saque

| Funcionalidade | Status |
|---------------|--------|
| Revendedor salva dados bancários | ❌ |
| Revendedor atualiza dados bancários | ❌ |
| Admin visualiza dados bancários ao aprovar saque | ⚠️ Incompleto |

**Pendências:**
- [ ] `UpdateResellerBankInfoCommand` / `UpdateResellerBankInfoUseCase`
- [ ] Endpoint `PATCH /api/resellers/bank-info`
- [ ] Frontend: Formulário na página de perfil/saques do revendedor

---

### 3.7 Rastreamento de Pedido (Tracking)

| Funcionalidade | Status |
|---------------|--------|
| Adicionar código de rastreio ao pedido | ⚠️ Endpoint existe mas lógica de envio de email não confirmada |
| Buscar rastreamento (Melhor Envio) | ❌ |
| Webhook Bling para atualização de status/tracking | ⚠️ Processador existe mas lógica incompleta |

**Pendências:**
- [ ] `GetOrderTrackingUseCase` — consulta status de rastreio na Melhor Envio
- [ ] Endpoint público `GET /api/orders/:orderNumber/track` (sem autenticação para o cliente final)
- [ ] Sincronização bidirecional: quando Bling atualiza status → atualizar pedido local
- [ ] Email de notificação de envio com código de rastreio

---

### 3.8 Reembolso (Estorno)

| Funcionalidade | Endpoint | Status |
|---------------|---------|--------|
| Estornar pagamento Cielo | `POST /api/admin/orders/:id/refund` | ⚠️ DTO existe, sem use case completo |

**Pendências:**
- [ ] `RefundOrderUseCase` — chama Cielo void, atualiza status do pedido, reverte comissão
- [ ] Frontend: Botão de estorno na página de detalhe do pedido (admin)

---

## 4. E-MAILS TRANSACIONAIS

**Status:** `EmailService` existe e usa Nodemailer, mas **não há nenhum template HTML** e os event handlers que deveriam disparar e-mails estão ausentes ou incompletos.

| Evento | Template | Handler | Status |
|--------|----------|---------|--------|
| Revendedor aprovado | ❌ | ❌ | Crítico |
| Revendedor rejeitado | ❌ | ❌ | Crítico |
| Pedido confirmado (para o cliente) | ❌ | ❌ | Alta |
| Pedido enviado com rastreio | ❌ | ❌ | Alta |
| Comissão disponível para saque | ❌ | ❌ | Média |
| Saque aprovado | ❌ | ❌ | Média |
| Saque rejeitado | ❌ | ❌ | Média |
| Senha redefinida | ⚠️ | ⚠️ Parcial | Média |
| Boas-vindas ao revendedor | ❌ | ❌ | Baixa |

**Pendências:**
- [ ] Criar templates HTML para cada e-mail (em `/src/infrastructure/messaging/email/templates/`)
- [ ] Criar `EmailTemplateService` que renderiza templates com variáveis
- [ ] Conectar event handlers: `@OnEvent('reseller.approved')`, `@OnEvent('order.paid')`, `@OnEvent('commission.available')`, etc.

---

## 5. INTEGRAÇÕES

### 5.1 Bling

| Funcionalidade | Status |
|---------------|--------|
| OAuth 2.0 (autenticação) | ✅ `BlingAuthService` implementado |
| Sincronização de produtos (pull) | ✅ `BlingProductSyncService` implementado |
| Criação de pedido no Bling quando pago | ⚠️ `BlingOrderSyncService` existe, verificar wiring |
| Webhook Bling → atualizar status do pedido | ⚠️ Processador existe, lógica incompleta |
| Criação de conta a pagar (pagamento de saque) | ✅ `BlingClient.createPayable()` implementado |
| **UI de conexão OAuth no Admin** | ❌ Não existe no frontend |
| Configurar token OAuth via frontend admin | ❌ A página `/admin/configuracoes` não tem o fluxo OAuth |

**Pendências:**
- [ ] Endpoint `GET /api/admin/bling/auth-url` — retorna URL de autorização Bling para o admin
- [ ] Endpoint `GET /api/admin/bling/callback` — recebe code, troca por tokens, salva
- [ ] Endpoint `GET /api/admin/bling/status` — retorna se está autenticado e token válido
- [ ] Frontend: Página `/admin/configuracoes` com botão "Conectar ao Bling" e status da conexão

---

### 5.2 Cielo

| Funcionalidade | Status |
|---------------|--------|
| Pagamento cartão de crédito | ✅ Implementado |
| Captura de pagamento | ✅ Implementado |
| Cancelamento/Estorno | ✅ CieloClient tem método, falta use case completo |
| Recorrência (assinatura mensal) | ✅ `CieloRecurrenceService` implementado |
| Webhook de pagamento | ✅ Controller existe |
| **Boleto bancário** | ❌ Não implementado |
| **PIX** | ❌ Não implementado |
| Webhook de recorrência (suspensão/reativação) | ⚠️ Handler incompleto |

---

### 5.3 Melhor Envio

| Funcionalidade | Status |
|---------------|--------|
| Calcular frete (múltiplas opções) | ✅ `MelhorEnvioService` implementado |
| Gerar etiqueta de envio | ❌ Não implementado |
| Consultar rastreamento | ❌ Não implementado |
| **Integrar cálculo de frete no checkout** | ⚠️ Backend existe, frontend não usa |

**Pendências:**
- [ ] Frontend checkout (endereço): após preencher CEP, calcular frete e exibir opções
- [ ] `GenerateShippingLabelUseCase` — gera etiqueta quando pedido vai ser enviado
- [ ] `TrackShipmentUseCase` — consulta status de entrega

---

### 5.4 Magis5

| Funcionalidade | Status |
|---------------|--------|
| Sincronizar imagens de produtos | ⚠️ `Magis5Service` existe mas não está conectado ao fluxo de sync de produtos |

**Pendências:**
- [ ] Conectar `Magis5Service.syncImages()` ao `BlingProductSyncService` após sincronizar produtos
- [ ] Salvar URLs de imagem na tabela `product_images`
- [ ] Exibir imagens nos endpoints de produto

---

## 6. FRONTEND ADMIN — PÁGINAS INCOMPLETAS

### 6.1 `/admin/aprovacoes` — Cadastros Pendentes

**Status:** A página `/admin/revendedores/pendentes` existe mas é básica. A especificação da Entrega 4 exige uma página separada `/admin/aprovacoes` com:

- [ ] Tabela de pendentes com colunas: Nome | CPF | Email | Telefone | Data | Ações
- [ ] Modal "Analisar" com Dialog fullWidth exibindo:
  - Dados pessoais completos (nome, CPF, email, telefone)
  - Dados bancários completos (banco, agência, conta, titular, CPF titular)
  - Botões: APROVAR (verde), REJEITAR (vermelho, abre campo de motivo), CANCELAR
- [ ] Loading skeleton (MUI Skeleton) durante carregamento
- [ ] Snackbar de feedback após aprovar/rejeitar
- [ ] Estado vazio com ícone quando não há pendentes

---

### 6.2 `/admin/revendedores` — Lista de Revendedores

**Status:** Página `/admin/revendedores/[id]` existe (detalhe), mas a lista paginada é básica.

- [ ] Filtros: por status, por nível, busca textual (nome/CPF/email)
- [ ] Paginação com `total`, `totalPages`, `currentPage`
- [ ] Colunas: Nome | CPF | Email | Nível (Chip colorido) | Status (Chip) | Total Vendido | Data Cadastro | Ações
- [ ] Botões de ação: Ver Detalhes | Suspender | Reativar (conforme status)
- [ ] Página de detalhe deve incluir: dados bancários, status da assinatura, total de pedidos, comissões disponíveis

---

### 6.3 `/admin/saques` — Gestão de Saques

**Status:** Página existe mas verificar completude:

- [ ] Deve exibir: Nome do revendedor | Valor | Data do pedido | Status (Chip) | Dados bancários | Ações
- [ ] Aprovar saque: confirmação + enviar para Bling (`createPayable`)
- [ ] Rejeitar saque: campo de motivo obrigatório
- [ ] Marcar como pago: confirma transferência feita
- [ ] Filtros por status: `requested`, `approved`, `paid`, `rejected`

---

### 6.4 `/admin/pedidos` — Gestão de Pedidos

**Status:** Página existe mas verificar completude:

- [ ] Filtros: status, data, revendedor, busca por número/CPF
- [ ] Tabela paginada com: Nº do Pedido | Cliente | Revendedor | Total | Status | Data
- [ ] Detalhe do pedido: itens, endereço, pagamento (ID Cielo), rastreio
- [ ] Ações: atualizar status, adicionar código de rastreio, estornar pagamento

---

### 6.5 `/admin/produtos` — Catálogo de Produtos

**Status:** Página existe mas verificar completude:

- [ ] Listagem de produtos com imagem (miniatura), nome, SKU, preço, estoque
- [ ] Botão "Sincronizar com Bling" → `POST /api/admin/products/sync`
- [ ] Ativar/desativar produto
- [ ] Sem imagens: placeholder com ícone de produto

---

### 6.6 `/admin/materiais` — Materiais de Marketing

**Status:** Página existe mas é placeholder.

- [ ] Listar materiais cadastrados (banners, textos, links)
- [ ] Formulário de upload de novo material (título, tipo, arquivo/URL)
- [ ] Botão excluir material
- [ ] **Depende do backend (Seção 2.2 acima)**

---

### 6.7 `/admin/configuracoes` — Configurações do Sistema

**Status:** Página existe mas é placeholder.

- [ ] Seção: Integração com Bling — status da conexão + botão "Conectar" / "Desconectar"
- [ ] Seção: Regras de Comissão — tabela editável com as faixas (R$0-1000 → 10%, etc.)
- [ ] Seção: Configurações de E-mail — testar conexão SMTP
- [ ] Seção: Dados da empresa (razão social, CNPJ, endereço)

---

### 6.8 Gráficos (Dashboards)

**Status:** Ambos admin e reseller têm áreas com texto "Gráficos serão implementados".

- [ ] Admin dashboard: gráfico de linha — vendas por dia (últimos 30 dias)
- [ ] Admin dashboard: gráfico de barras — top 5 revendedores por vendas
- [ ] Admin dashboard: gráfico de pizza — distribuição por status de pedido
- [ ] Reseller dashboard: gráfico de linha — comissões por semana
- [ ] Reseller dashboard: tabela — últimas 10 vendas
- [ ] Biblioteca sugerida: Recharts (já é padrão para Next.js/MUI)

---

## 7. FRONTEND REVENDEDOR — PÁGINAS INCOMPLETAS

### 7.1 Cadastro de Revendedor — `/auth/register` ou `/auth/cadastro`

**Status:** ❌ Não existe.

Esta é a página mais crítica do fluxo do revendedor.

- [ ] Criar página de cadastro com formulário:
  - Email, senha, nome completo
  - CPF (com máscara e validação matemática no frontend)
  - Telefone (com máscara)
  - Dados bancários: banco (select), agência, conta, tipo de conta, nome do titular, CPF do titular
- [ ] Chamar `POST /api/auth/register-reseller`
- [ ] Redirecionar para página de aguardo de aprovação após cadastro

---

### 7.2 `/reseller/sales` — Histórico de Vendas

**Status:** ❌ Não existe (link existe no dashboard).

- [ ] Tabela paginada de pedidos vinculados ao revendedor logado
- [ ] Colunas: Nº Pedido | Cliente | Produtos | Total | Comissão | Status | Data
- [ ] Filtros: por status, por período
- [ ] Detalhe do pedido ao clicar

---

### 7.3 `/reseller/materials` — Materiais de Marketing

**Status:** ❌ Não existe (link existe no dashboard).

- [ ] Listar materiais disponibilizados pelo admin
- [ ] Download de banners, textos prontos, links
- [ ] **Depende do backend (Seção 2.2 acima)**

---

### 7.4 `/reseller/profile` — Perfil e Dados Bancários

**Status:** ❌ Não existe.

- [ ] Exibir dados do revendedor (nome, CPF, email, nível, código de revenda)
- [ ] Formulário para editar dados bancários (banco, agência, conta, titular)
- [ ] Formulário para editar telefone e informações de contato

---

### 7.5 `/reseller/coupons` — Meus Cupons

**Status:** ❌ Não existe.

- [ ] Listar cupons criados pelo revendedor
- [ ] Criar novo cupom (percentual ou fixo, data de validade, limite de uso)
- [ ] Copiar código do cupom
- [ ] **Depende do backend (Seção 2.1 acima)**

---

## 8. FRONTEND LOJA — FUNCIONALIDADES INCOMPLETAS

### 8.1 Checkout — Aplicação de Cupom

**Status:** ❌ Campo de cupom não existe em nenhuma etapa do checkout.

- [ ] Adicionar campo "Código de cupom" na etapa de revisão ou no carrinho
- [ ] Chamar `GET /api/coupons/validate?code=X` ao digitar
- [ ] Exibir desconto aplicado no resumo do pedido
- [ ] Enviar `couponCode` no payload de criação do pedido

---

### 8.2 Checkout — Lookup de CEP

**Status:** ❌ Formulário de endereço não faz lookup automático de CEP.

- [ ] Integrar ViaCEP API: `https://viacep.com.br/ws/{cep}/json/`
- [ ] Ao digitar CEP (8 dígitos), auto-preencher: logradouro, bairro, cidade, estado
- [ ] Tratar CEP inválido com erro amigável

---

### 8.3 Checkout — Cálculo de Frete

**Status:** ❌ Frontend de checkout não exibe opções de frete.

- [ ] Na etapa de endereço, após validar CEP, chamar `POST /api/shipping/calculate`
- [ ] Exibir opções de envio com preço e prazo (PAC, SEDEX, etc.)
- [ ] Guardar opção selecionada para usar no pedido final

---

### 8.4 Imagens de Produtos

**Status:** ❌ Listagem e detalhe de produtos não exibem imagens.

- [ ] `ProductCard` na listagem: exibir imagem primária (`is_primary = true`) ou placeholder
- [ ] Página de detalhe `/products/[id]`: galeria de imagens
- [ ] **Depende da tabela `product_images` e sync do Magis5 (Seções 2.3 e 5.4)**

---

### 8.5 Rastreamento de Pedido (Cliente Final)

**Status:** ❌ Não existe.

- [ ] Página pública `/track?order=XXXXXX` ou `/pedidos/[orderNumber]`
- [ ] Cliente insere número do pedido + CPF para ver status
- [ ] Exibe: status atual, código de rastreio, link para rastreio na transportadora

---

## 9. FLUXO COMPLETO DO REVENDEDOR — GAP ANALYSIS

O fluxo esperado pelo sistema é:

```
1. Revendedor se cadastra → /auth/register ❌ (não existe)
2. Admin aprova → email enviado ❌ (sem template)
3. Revendedor cria assinatura → /reseller/subscription/create ✅
4. Revendedor recebe link exclusivo → dashboard mostra link ✅
5. Cliente acessa /r/[link] → cookie setado ✅
6. Cliente navega no catálogo → /products ✅
7. Cliente aplica cupom → ❌ (sem cupom no checkout)
8. Cliente calcula frete → ❌ (sem opções de frete no checkout)
9. Cliente paga → /checkout/payment ✅ (cartão de crédito)
10. Pedido criado no Bling → ⚠️ (parcial)
11. Comissão calculada → ⚠️ (use case existe, wiring incerto)
12. Revendedor vê vendas → /reseller/sales ❌ (não existe)
13. Admin aprova saque → /admin/saques ⚠️ (parcial)
14. Pagamento via Bling → ⚠️ (parcial)
15. Revendedor recebe comissão ❌ (fluxo completo incerto)
```

---

## 10. PRIORIDADES RECOMENDADAS

### 🔴 Crítico — Bloqueia operação básica

1. **Página de cadastro do revendedor** (`/auth/register`) — o sistema não funciona sem ela
2. **Captura de dados bancários** — necessário para aprovar saques
3. **Contexto de cupons** — requisito do negócio definido na Entrega 3
4. **Tabela `product_images`** + sincronização — sem imagens o catálogo é inutilizável
5. **Templates de e-mail** — especialmente aprovação e rejeição de revendedor
6. **Suspend/reactivate reseller** — admin precisa gerenciar revendedores

### 🟡 Alta — Impacta experiência significativamente

7. **Cálculo de frete no checkout** — sem frete o checkout está incompleto
8. **Cupom no checkout** — depende do ponto 3
9. **Listagem de pedidos do revendedor** (`/reseller/sales`)
10. **Dashboard charts** com dados reais
11. **Liberar comissões automaticamente** — job agendado
12. **Rastreamento de pedidos** — cliente não sabe onde está o produto

### 🟢 Média — Melhora experiência mas não bloqueia

13. **Contexto de materiais de marketing**
14. **Cancelamento de assinatura** pelo revendedor
15. **UI OAuth Bling** no admin (configurações)
16. **Gráficos** nos dashboards
17. **Perfil do revendedor** — editar dados
18. **Rastreamento de entrega** — integração Melhor Envio
19. **PIX/Boleto** — métodos alternativos de pagamento

---

## 11. ERROS/INCONSISTÊNCIAS ENCONTRADOS NO CÓDIGO

| Arquivo | Problema | Ação Recomendada |
|---------|---------|-----------------|
| `reseller.mapper.ts` | `canSetCustomPrice` usa valor fixo `false` (campo removido do BD) | Remover o campo do domínio também ou criar migration para adicionar ao BD |
| `reseller-reporting.repository.ts` | `canSetCustomPrice` retorna `false` hardcoded | Idem acima |
| `admin-metrics.repository.ts` | Importa `EntityManager` de `@mikro-orm/postgresql` (corrigido) | ✅ OK |
| `reseller-orm.entity.ts` | `canSetCustomPrice` comentada | Decidir: implementar ou remover do domínio |
| `reseller/dashboard` page | `API_BASE` no `useEffect` dependency array causa re-renders infinitos | Usar `useMemo` ou `useRef` para `API_BASE` |
| `reseller/dashboard` page | Dados iniciais hardcoded (`INITIAL_DATA`) com nome "Paulo Oliveira" | Mostrar loading state em vez de dados falsos |
| Faltam `commission-rule-orm.entity.ts` checks | `configure-commission-rules.use-case.ts` existe mas verificar se rules se persistem corretamente | Testar CRUD de regras |

---

## 12. CHECKLIST DE ITENS DA ENTREGA 4 (PAINEL ADMIN)

A Entrega 4 especificou 7 páginas do painel admin. Status atual:

| Página | Rota | Status |
|--------|------|--------|
| Aprovações (modal com dados bancários) | `/admin/aprovacoes` | ❌ Não existe como especificado |
| Revendedores (lista filtrada + paginada) | `/admin/revendedores` | ⚠️ Básico |
| Saques (approve/reject/paid flow) | `/admin/saques` | ⚠️ Parcial |
| Pedidos (com detalhe e ações) | `/admin/pedidos` | ⚠️ Básico |
| Produtos (com sync Bling) | `/admin/produtos` | ⚠️ Básico |
| Materiais | `/admin/materiais` | ❌ Placeholder vazio |
| Configurações (Bling OAuth + comissões) | `/admin/configuracoes` | ❌ Placeholder vazio |

---

---

## 13. ITENS ADICIONAIS — CONVERSA ORIGINAL (PDF)

> Esta seção cobre pontos discutidos na conversa original do Claude (compartilhada como PDF de 51 páginas) que não estavam totalmente cobertos nas seções anteriores.

---

### 13.1 Design System / Identidade Visual — Validação Necessária

A conversa original definiu um **Design System completo** inspirado no Mercado Livre e Amazon. É necessário validar se o frontend atual segue esse padrão.

**Paleta de cores definida:**
```css
--primary-yellow:   #FFE600   /* Amarelo Kaza Tem (header, botão primário) */
--primary-blue:     #3483FA   /* Azul CTAs (inspirado ML) */
--primary-orange:   #FF6900   /* Laranja ofertas/destaque */
--secondary-green:  #00A650   /* Verde frete grátis / sucesso */
--secondary-red:    #F23D4F   /* Vermelho erro / esgotado */
--text-primary:     #333333
--text-secondary:   #666666
--bg-light:         #F5F5F5
```

**Componentes visuais especificados mas não validados:**

| Componente | Especificação | Status |
|-----------|---------------|--------|
| MUI Theme customizado | Paleta completa acima configurada em `theme.ts` | ⚠️ Verificar |
| Header amarelo sticky | `position: sticky`, background `#FFE600`, sombra ao scroll | ⚠️ Verificar |
| ProductCard | hover `translateY(-4px) + box-shadow`, badge desconto vermelho, badge frete grátis verde | ⚠️ Verificar |
| Shimmer skeleton loading | Animação shimmer em todos os carregamentos | ⚠️ Verificar |
| Tipografia Roboto | Google Fonts `Roboto` em todo o app | ⚠️ Verificar |
| Botão primário amarelo | `#FFE600` com texto escuro, border-radius 4px | ⚠️ Verificar |
| Barra de busca | Destaque amarelo, autocomplete, ícone lupa | ⚠️ Verificar |

**Pendências de implementação do Design System:**
- [ ] Auditar `providers.tsx` ou `theme.ts` e verificar se o tema MUI está configurado com a paleta correta
- [ ] Validar se o Header tem background `#FFE600` e é sticky
- [ ] Validar se `ProductCard` tem hover effects (translateY + shadow)
- [ ] Adicionar shimmer skeleton loading em todas as telas com carregamento
- [ ] Verificar se a fonte Roboto está importada corretamente no `layout.tsx`

---

### 13.2 QR Code para Link de Afiliado

A conversa original especificou um componente `AffiliateLink` com **QR Code** para o revendedor compartilhar o link via WhatsApp, Instagram, etc.

**Pendências:**
- [ ] Componente `AffiliateLink` no dashboard do revendedor exibindo:
  - Link formatado: `kazatem.shop/r/[CODIGO]`
  - Botão "Copiar link" (clipboard API)
  - **QR Code gerado dinamicamente** (biblioteca: `qrcode.react` ou `react-qr-code`)
  - Botão "Baixar QR Code" (download como PNG)
- [ ] Instalar biblioteca de QR Code: `npm install react-qr-code`

---

### 13.3 Preciﬁcação Personalizada — Regras Completas (RN-070 a RN-075)

A conversa original definiu regras detalhadas que estão incompletas no código (campo `canSetCustomPrice` foi removido do BD).

**Regras de negócio:**
- **RN-070**: Revendedor pode, opcionalmente, definir preços diferentes para seus clientes (admin precisa habilitar essa permissão por revendedor)
- **RN-071**: Preço customizado SEMPRE maior que o preço base cadastrado no Bling
- **RN-072**: Sistema deve bloquear qualquer tentativa de preço menor que o base
- **RN-073**: O preço customizado é o preço que aparece para clientes que acessam via link do revendedor
- **RN-074**: A comissão é calculada sobre o **preço base** (nunca sobre o preço customizado — revendedor não se beneficia do próprio markup)
- **RN-075**: Admin pode revogar a permissão a qualquer momento

**Pendências:**
- [ ] Decisão arquitetural: implementar ou descartar essa feature? (campo `can_set_custom_price` foi removido do BD)
- [ ] Se implementar: adicionar migration para recriar o campo, criar use case `SetCustomPriceUseCase`
- [ ] Se implementar: frontend do revendedor — tela de preciﬁcação personalizada por produto
- [ ] Se descartar: remover completamente o campo `canSetCustomPrice` da entidade de domínio `Reseller`

---

### 13.4 Divergência nos Limiares de Nível — PRECISA DECISÃO

Há **inconsistência** entre os documentos sobre os critérios de progressão de nível:

| Fonte | Bronze → Prata | Prata → Ouro |
|-------|---------------|-------------|
| Conversa original (PDF) | R$ 50.000 (acumulado total) | R$ 150.000 (acumulado total) |
| Entrega 3 (PLANO_DESENVOLVIMENTO_FASES.md) | R$ 5.000/mês | R$ 15.000/mês |

**Ação necessária:**
- [ ] Confirmar com o usuário qual é a regra correta: **por mês** ou **acumulado total**?
- [ ] Atualizar o código em `reseller.entity.ts` com os limites corretos quando definido
- [ ] Implementar `CheckLevelUpgradeUseCase` com a regra confirmada

---

### 13.5 Notificações em Tempo Real (Supabase Realtime)

A conversa original mencionou o uso do **Supabase Realtime** (WebSocket) para notificações ao vivo.

**Casos de uso:**
- Revendedor recebe notificação quando admin aprova/rejeita saque — sem precisar recarregar a página
- Revendedor recebe notificação quando comissão fica disponível
- Admin recebe alerta quando novo revendedor se cadastra

**Pendências:**
- [ ] Avaliar se implementar com Supabase Realtime ou polling simples
- [ ] Se Realtime: integrar `@supabase/supabase-js` no frontend com `supabase.channel()`
- [ ] Componente `NotificationBell` no header do revendedor e do admin
- [ ] Tabela `notifications` no banco (ou usar canal Realtime sem persistência)

---

### 13.6 Supabase Storage para Uploads

A conversa definiu que arquivos (materiais de marketing e imagens de produtos) devem ir para **Supabase Storage**, não para disco local.

**Pendências:**
- [ ] Configurar Supabase Storage bucket: `materials` (público) e `product-images` (público)
- [ ] Criar `StorageService` no backend usando `@supabase/supabase-js`
- [ ] Upload de materiais: `POST /api/admin/materials` deve fazer upload para Supabase Storage
- [ ] Imagens de produtos: sincronizar URLs do Magis5/Bling para Supabase Storage (ou servir direto das URLs externas)
- [ ] Configurar RLS (Row Level Security) no Supabase para os buckets

---

### 13.7 Telas Confirmadas como Não Funcionais (prints do usuário)

O usuário enviou prints que confirmaram as seguintes situações:

| Tela | Problema Confirmado | Status |
|------|-------------------|--------|
| `/reseller/sales` | Retorna 404 — página não existe | ❌ |
| `/reseller/materials` | Retorna 404 — página não existe | ❌ |
| Dashboard revendedor | Números hardcoded: "Paulo Oliveira", "R$ 12.450,00" | ⚠️ Parcial |
| Dashboard revendedor | Erro visível: "Não foi possível carregar o dashboard" | ⚠️ Erro |

**Sobre o link do revendedor:** O usuário questionou se seria "um clone do site". A resposta correta (e já implementada) é:
> **NÃO é um clone.** É um sistema de tracking por cookie: o cliente acessa `/r/PAULO_ABC123`, o sistema salva um cookie httpOnly de 30 dias com o código do revendedor e redireciona para a home normal. Quando o cliente compra, o backend lê o cookie e vincula o pedido ao revendedor automaticamente.
> **Status:** A rota `/r/[link]/page.tsx` existe. Validar se o cookie está sendo setado corretamente e se o checkout lê o cookie ao criar o pedido.

**Pendências:**
- [ ] Validar end-to-end o fluxo do cookie: `/r/[link]` → seta cookie → checkout lê cookie → pedido vinculado ao revendedor
- [ ] Corrigir dados hardcoded no dashboard (remover "Paulo Oliveira" do `INITIAL_DATA`)
- [ ] Mostrar loading state em vez de dados falsos enquanto a API não responde
- [ ] Criar `/reseller/sales` (ver Seção 7.2)
- [ ] Criar `/reseller/materials` (ver Seção 7.3)

---

### 13.8 Botão "Comprar via WhatsApp" (Fallback)

A conversa original discutiu o botão de compra via WhatsApp como alternativa ao checkout completo. Decidiu-se pelo checkout completo, mas pode ser útil como **fallback** em produtos sem estoque ou como canal adicional.

**Pendência (baixa prioridade):**
- [ ] Avaliar se adicionar botão "Tirar dúvidas no WhatsApp" na página de detalhe do produto
- [ ] Link formatado: `https://wa.me/55[NUMERO]?text=Olá, tenho interesse no produto [NOME]`
- [ ] Número do WhatsApp configurável nas variáveis de ambiente (`WHATSAPP_NUMBER`)

---

*Documento gerado em 28/02/2026 — Auditoria completa do código vs. documentação de requisitos*
*Atualizado em 28/02/2026 — Adicionada Seção 13 com itens da conversa original (PDF 51 páginas)*
