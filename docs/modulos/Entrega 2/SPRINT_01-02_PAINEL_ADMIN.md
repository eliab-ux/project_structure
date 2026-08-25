# SPRINT 01-02 - PAINEL ADMINISTRATIVO BÁSICO

**Duração:** 2 semanas (10 dias úteis)  
**Prioridade:** 🔴 CRÍTICA  
**Objetivo:** Criar base do painel administrativo com autenticação e gestão de cadastros

---

## 🎯 OBJETIVOS DO SPRINT

### Objetivo Principal
Implementar painel administrativo básico para permitir que admin gerencie cadastros de revendedores (aprovar/rejeitar).

### Entregáveis
1. ✅ Autenticação de administrador
2. ✅ Dashboard admin com métricas básicas
3. ✅ Gestão de cadastros de revendedores
4. ✅ Sistema de aprovação/rejeição
5. ✅ Emails transacionais (aprovação/rejeição)

---

## 📋 BACKLOG DO SPRINT

### 1. AUTENTICAÇÃO ADMIN (2 dias)

#### 1.1 Backend - User Context (Admin)
**Arquivos:**
```
src/contexts/user/domain/
├── entities/user.entity.ts (atualizar com role)
├── value-objects/user-role.vo.ts (criar)
└── exceptions/unauthorized.exception.ts

src/contexts/user/application/
├── use-cases/login-admin/
│   ├── login-admin.command.ts
│   └── login-admin.use-case.ts
└── dto/auth.dto.ts

src/infrastructure/http/controllers/auth/
└── admin-auth.controller.ts
```

**Tarefas:**
- [ ] Adicionar campo `role` na entidade User (customer, reseller, admin)
- [ ] Criar Value Object UserRole
- [ ] Criar use case LoginAdmin
- [ ] Criar controller POST /api/admin/auth/login
- [ ] Implementar JWT com role "admin"
- [ ] Criar guard AdminGuard (valida role)

**Critérios de Aceite:**
- Admin consegue fazer login com email/senha
- JWT retornado contém role "admin"
- Rotas protegidas validam role
- Senha incorreta retorna 401

#### 1.2 Frontend - Login Admin
**Arquivos:**
```
frontend/src/app/admin/
├── login/
│   ├── page.tsx
│   └── styles.ts
└── layout.tsx (layout específico admin)

frontend/src/contexts/
└── AdminAuthContext.tsx

frontend/src/hooks/
└── useAdminAuth.ts
```

**Tarefas:**
- [ ] Criar página /admin/login
- [ ] Formulário com email e senha
- [ ] Validação com yup
- [ ] Context AdminAuthContext
- [ ] Hook useAdminAuth
- [ ] Armazenar token JWT
- [ ] Redirecionar para /admin/dashboard após login

**Critérios de Aceite:**
- Formulário valida campos obrigatórios
- Erro de credenciais exibe mensagem
- Login bem-sucedido redireciona para dashboard
- Token armazenado em localStorage/cookie

---

### 2. DASHBOARD ADMIN (2 dias)

#### 2.1 Backend - Dashboard Metrics
**Arquivos:**
```
src/contexts/analytics/application/
├── use-cases/get-admin-metrics/
│   ├── get-admin-metrics.query.ts
│   └── get-admin-metrics.use-case.ts
└── dto/admin-metrics.dto.ts
```

**Tarefas:**
- [ ] Criar use case GetAdminMetrics
- [ ] Calcular métricas:
  - Total de vendas (dia, semana, mês)
  - Total de pedidos
  - Ticket médio
  - Revendedores ativos
  - Cadastros pendentes
- [ ] Criar controller GET /api/admin/dashboard/metrics
- [ ] Proteger rota com AdminGuard

**Critérios de Aceite:**
- Retorna métricas em tempo real do banco
- Resposta em menos de 2 segundos
- Apenas admin autenticado acessa

#### 2.2 Frontend - Dashboard Layout
**Arquivos:**
```
frontend/src/app/admin/dashboard/
├── page.tsx
├── styles.ts
└── components/
    ├── MetricCard/
    ├── Sidebar/
    └── Header/
```

**Tarefas:**
- [ ] Criar layout admin (sidebar + header)
- [ ] Sidebar com menu de navegação:
  - Dashboard
  - Revendedores
  - Pedidos
  - Produtos
  - Configurações
- [ ] Header com nome do admin e logout
- [ ] 6 cards de métricas principais
- [ ] Skeleton loading enquanto carrega

**Critérios de Aceite:**
- Layout responsivo (desktop/tablet/mobile)
- Sidebar colapsa em mobile
- Cards exibem dados reais da API
- Loading state funciona
- Seguir design system (REQUISITOS seção 2)

---

### 3. GESTÃO DE CADASTROS (4 dias)

#### 3.1 Backend - Atualizar Reseller Context

**Arquivos:**
```
src/contexts/reseller/domain/
├── entities/reseller.entity.ts (atualizar)
├── value-objects/reseller-status.vo.ts
└── events/
    ├── reseller-approved.event.ts
    └── reseller-rejected.event.ts

src/contexts/reseller/application/
├── use-cases/approve-reseller/
│   ├── approve-reseller.command.ts
│   └── approve-reseller.use-case.ts
├── use-cases/reject-reseller/
│   ├── reject-reseller.command.ts
│   └── reject-reseller.use-case.ts
└── use-cases/list-pending-resellers/
    ├── list-pending-resellers.query.ts
    └── list-pending-resellers.use-case.ts
```

**Tarefas:**
- [ ] Adicionar campos em Reseller:
  - approved_at: Date | null
  - approved_by: UserId | null
  - rejected_at: Date | null
  - rejected_reason: string | null
- [ ] Criar método aprovar() na entidade
- [ ] Criar método rejeitar(motivo) na entidade
- [ ] Emitir eventos ResellerApproved, ResellerRejected
- [ ] Criar use case ApproveReseller
- [ ] Criar use case RejectReseller
- [ ] Criar use case ListPendingResellers
- [ ] Criar controllers:
  - GET /api/admin/resellers/pending
  - POST /api/admin/resellers/:id/approve
  - POST /api/admin/resellers/:id/reject

**Critérios de Aceite:**
- Status muda de "pending" para "approved" ou "rejected"
- Campos de auditoria preenchidos (quem, quando)
- Domain events emitidos corretamente
- Apenas admin pode aprovar/rejeitar
- Validação: revendedor já aprovado não pode ser aprovado novamente

#### 3.2 Backend - Email Service

**Arquivos:**
```
src/infrastructure/messaging/
├── email/
│   ├── email.service.ts
│   ├── templates/
│   │   ├── reseller-approved.template.ts
│   │   └── reseller-rejected.template.ts
│   └── email.module.ts
└── handlers/
    ├── reseller-approved.handler.ts
    └── reseller-rejected.handler.ts
```

**Tarefas:**
- [ ] Instalar nodemailer ou serviço de email
- [ ] Criar EmailService
- [ ] Criar template HTML para aprovação
- [ ] Criar template HTML para rejeição
- [ ] Criar handler para ResellerApprovedEvent
- [ ] Criar handler para ResellerRejectedEvent
- [ ] Configurar SMTP no .env
- [ ] Testar envio de email

**Critérios de Aceite:**
- Email enviado após aprovação
- Email enviado após rejeição
- Templates bonitos e profissionais
- Emails chegam na caixa de entrada (não spam)

#### 3.3 Frontend - Lista de Cadastros Pendentes

**Arquivos:**
```
frontend/src/app/admin/resellers/
├── pending/
│   ├── page.tsx
│   └── components/
│       ├── PendingTable/
│       └── ApprovalModal/
└── [id]/
    └── page.tsx (detalhes)
```

**Tarefas:**
- [ ] Criar página /admin/resellers/pending
- [ ] Tabela com cadastros pendentes:
  - Nome
  - CPF
  - Email
  - Data do cadastro
  - Botão "Analisar"
- [ ] Modal de aprovação/rejeição:
  - Exibir dados completos
  - Dados bancários
  - Botão "Aprovar"
  - Botão "Rejeitar" (com campo motivo obrigatório)
- [ ] Página de detalhes do revendedor
- [ ] Feedback visual após ação (toast)
- [ ] Remover da lista após aprovar/rejeitar

**Critérios de Aceite:**
- Tabela atualiza em tempo real
- Modal valida campo motivo se rejeitar
- Confirmação antes de ações críticas
- Toast de sucesso/erro
- Responsivo em mobile

---

### 4. LISTAGEM DE REVENDEDORES (2 dias)

#### 4.1 Backend - List Resellers

**Arquivos:**
```
src/contexts/reseller/application/
├── use-cases/list-resellers/
│   ├── list-resellers.query.ts
│   └── list-resellers.use-case.ts
└── dto/reseller-list.dto.ts
```

**Tarefas:**
- [ ] Criar use case ListResellers
- [ ] Suportar filtros:
  - Status (active, suspended, canceled)
  - Nível (bronze, silver, gold)
  - Busca por nome/email/CPF
- [ ] Paginação (limit, offset)
- [ ] Ordenação
- [ ] Controller GET /api/admin/resellers

**Critérios de Aceite:**
- Filtros funcionam corretamente
- Paginação funciona
- Resposta otimizada (< 1s para 1000 registros)

#### 4.2 Frontend - Lista de Revendedores

**Arquivos:**
```
frontend/src/app/admin/resellers/
└── page.tsx
```

**Tarefas:**
- [ ] Criar página /admin/resellers
- [ ] Tabela com todos os revendedores:
  - Nome
  - Nível (badge colorido)
  - Total Vendido
  - Status
  - Ações (Ver detalhes)
- [ ] Filtros por status e nível
- [ ] Busca por nome/email/CPF
- [ ] Paginação
- [ ] Link para detalhes

**Critérios de Aceite:**
- Tabela responsiva
- Filtros funcionam
- Busca em tempo real (debounced)
- Badges de nível coloridos (bronze/prata/ouro)

---

## ✅ DEFINITION OF DONE

### Técnico
- [ ] Código segue padrões do CLAUDE.md
- [ ] Domain entities sem decorators de framework
- [ ] Repositories implementam ports
- [ ] Mappers Domain ↔ ORM
- [ ] Controllers com 1 try-catch
- [ ] Status HTTP corretos
- [ ] Validação de DTOs
- [ ] TypeScript sem `any`

### Frontend
- [ ] Componentes com funções declaradas
- [ ] Sem `export default`
- [ ] Styled components (não inline)
- [ ] HTML semântico
- [ ] Responsivo (mobile/tablet/desktop)
- [ ] Loading states
- [ ] Error handling

### Funcional
- [ ] Admin consegue fazer login
- [ ] Dashboard exibe métricas reais
- [ ] Admin consegue ver cadastros pendentes
- [ ] Admin consegue aprovar cadastro
- [ ] Admin consegue rejeitar cadastro (com motivo)
- [ ] Email enviado após aprovação
- [ ] Email enviado após rejeição
- [ ] Admin consegue ver lista de revendedores

### Documentação
- [ ] Endpoints documentados
- [ ] README atualizado
- [ ] Variáveis de ambiente documentadas

---

## 🧪 TESTES

### Testes Unitários
- [ ] User entity (método addRole)
- [ ] Reseller entity (aprovar, rejeitar)
- [ ] ApproveReseller use case
- [ ] RejectReseller use case

### Testes de Integração
- [ ] Login admin (POST /api/admin/auth/login)
- [ ] Listar cadastros pendentes
- [ ] Aprovar cadastro
- [ ] Rejeitar cadastro

### Testes Manuais
- [ ] Fluxo completo de aprovação
- [ ] Fluxo completo de rejeição
- [ ] Email chegando na caixa
- [ ] Dashboard carregando métricas

---

## 📚 REFERÊNCIAS

**Documentos:**
- CLAUDE.md - Padrões de código (LEITURA OBRIGATÓRIA)
- REQUISITOS_KAZA_TEM_SYSTEM.md - Seção 6.2 (Resellers)
- REQUISITOS_NEGOCIO_KAZA_TEM.md - Seção 5.1 (Regras de Cadastro)
- GUIA_IMPLEMENTACAO_KAZA_TEM.md - Setup inicial

**Schemas:**
```sql
-- Adicionar campos na tabela users
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'customer';

-- Adicionar campos na tabela resellers
ALTER TABLE resellers ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE resellers ADD COLUMN approved_by UUID;
ALTER TABLE resellers ADD COLUMN rejected_at TIMESTAMP;
ALTER TABLE resellers ADD COLUMN rejected_reason TEXT;
```

---

## 🚀 PRÓXIMOS PASSOS

Após completar este sprint, avançar para:

**➡️ [SPRINT 03-04: SISTEMA DE ASSINATURA](SPRINT_03-04_ASSINATURA.md)**

Objetivos do próximo sprint:
- Integração com Cielo Recorrência
- Fluxo completo de criação de assinatura
- Webhooks de pagamento
- Gestão de inadimplência

---

## 📊 MÉTRICAS DE SUCESSO

- [ ] 100% dos testes passando
- [ ] 0 erros de TypeScript
- [ ] 0 warnings de ESLint
- [ ] Tempo de resposta das APIs < 2s
- [ ] Cobertura de testes > 70%

---

**Status:** 🟡 A INICIAR  
**Responsável:** Equipe de Desenvolvimento  
**Data de Início:** ___/___/2025  
**Data de Entrega:** ___/___/2025

---

**FIM DO SPRINT 01-02**
