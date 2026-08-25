# Spec de Implementação — Pagamento & Licenciamento (EMDR Remoto)

> **Objetivo:** adicionar ao EMDR Remoto um módulo de **assinatura/licenciamento** com
> dois planos (mensal e anual) cujos **valores são configurados no banco**, uma **tela de
> administrador** para gerir tudo, **modo gratuito global**, **período de teste (trial) em
> dias configurável** e **liberação manual por usuário até uma data**. Usuários sem
> licença **conseguem logar**, mas veem um **modal de planos** (paywall) e ficam bloqueados
> para usar a ferramenta.
>
> **Arquitetura-alvo:** NestJS + Fastify + MikroORM (**MySQL**) + hexagonal, conforme o
> `CLAUDE.md` e o `PLANO_REESTRUTURACAO_EMDR_REMOTO.md`. **Context novo: `billing`.**
> (Se for construído antes da reestruturação, as mesmas regras valem, adaptadas ao stack atual.)

---

## 0. Como usar com o Claude Code (VS Code)

Trabalhe **fase a fase** (Seção 9). Prompt-padrão:

```
Leia o CLAUDE.md e esta SPEC. Execute SOMENTE a "Fase B-N".
Regras invioláveis: domínio puro, todo request com class-validator, guard em todo
endpoint protegido, secrets só em .env, license verificada NO SERVIDOR (não só no modal).
Ao final rode typecheck + lint e me mostre o Definition of Done.
```

---

## 1. Regras de negócio (a fonte da verdade)

### 1.1 Quando um usuário TEM acesso à ferramenta

O acesso é resolvido **no servidor** por um único use case (`ResolveLicenseUseCase`).
O usuário tem acesso se **qualquer** condição abaixo for verdadeira, nesta ordem de
precedência (a primeira que casar define o `reason`):

| Ordem | Condição | `reason` | Expira em |
|---|---|---|---|
| 1 | **Modo gratuito global** ligado (`billing_settings.free_mode = true`) | `FREE_MODE` | — (nunca) |
| 2 | **Liberação manual** do admin ativa (`access_grant.free_until >= hoje`) | `ADMIN_GRANT` | `free_until` |
| 3 | **Assinatura paga ativa** (`subscription.status = ACTIVE` e `current_period_end >= agora`) | `SUBSCRIPTION` | `current_period_end` |
| 4 | **Trial vigente** (`subscription.status = TRIALING` e `trial_ends_at >= agora`) | `TRIAL` | `trial_ends_at` |
| — | Nenhuma acima | `NONE` (sem acesso → **paywall**) | — |

> **Enforcement é server-side (Security by Design).** O modal do frontend é só UX. As ações
> reais protegidas (criar sessão EMDR, entrar na sala pelo Gateway WebSocket) verificam a
> licença no backend e retornam **402 Payment Required** se `reason = NONE`. Esconder o
> modal no cliente **não** libera nada — o backend continua bloqueando.

### 1.2 Trial (dias de graça)

- Ao **cadastrar**, cria-se uma `subscription` com `status = TRIALING` e
  **`trial_ends_at = now + billing_settings.trial_days`** (snapshot no momento do cadastro).
- **Decisão travada:** o valor de `trial_days` afeta **apenas novos cadastros**. Alterar o
  setting depois **não** encurta nem estende o trial de quem já se cadastrou (o valor foi
  “fotografado” no `trial_ends_at`). Isso evita mudar retroativamente a vida de usuários.

### 1.3 Liberação manual por usuário (grant)

- Admin seleciona um usuário e informa **`free_until`** (data). Cria/atualiza um
  `access_grant`. Enquanto `free_until >= hoje`, o usuário tem acesso (`ADMIN_GRANT`),
  independentemente de trial/assinatura. Admin pode **revogar** (apaga/expira o grant).

### 1.4 Modo gratuito global

- `free_mode = true` libera **todos** os usuários (útil em beta/lançamento), acima de
  qualquer outra regra. Toggle na tela de admin.

### 1.5 Planos

- Dois planos configuráveis: `monthly` e `annual`. Cada um tem **preço (em centavos),
  moeda, intervalo, lista de features, texto de destaque e flag `active`** — tudo no banco.
- A tela de planos exibida no paywall **lê do banco** (nada de preço hardcoded no front).
  Os valores da imagem ($25 / $250, “Save $50 per year”) são apenas a configuração inicial.

---

## 2. Gateways de pagamento — dois trilhos por região

**Decisão travada:** dois trilhos, roteados por **região/moeda**. O domínio não conhece
gateway nenhum — fala só com o `PaymentGatewayPort`; um **router** escolhe o adapter certo.

| Região | Moeda | Método(s) | Gateway (adapter) | Recorrência |
|---|---|---|---|---|
| **BR** | BRL | Cartão | **Cielo** (API 3.0, tokenização/3DS) | Cielo Recorrência (dunning construído por nós) |
| **BR** | BRL | Pix | **Sicoob** (Pix Cobrança `cob`/`cobv`) | Anual = cobrança única; mensal = re-cobrança ou **Pix Automático** (ver ⚠️) |
| **INTL** | USD (+ outras) | Cartão | **Stripe** (Checkout/Subscriptions, assina BAA) | Nativa (dunning pronto) |

```typescript
// contexts/billing/application/ports/output/payment-gateway.port.ts
export const PAYMENT_GATEWAY_ROUTER = Symbol('PAYMENT_GATEWAY_ROUTER');

export type PaymentMethod = 'card' | 'pix';
export type Provider = 'cielo' | 'sicoob_pix' | 'stripe';

export interface PaymentGatewayPort {
  readonly provider: Provider;
  supports(method: PaymentMethod, currency: string): boolean;

  // Resultado é uma UNIÃO discriminada — cada trilho tem seu fluxo:
  createCheckout(input: {
    user: { id: string; email: string; name: string };
    planCode: string; currency: string; method: PaymentMethod;
    cardToken?: string;              // Cielo/Stripe (cartão tokenizado no client — PCI fora do servidor)
    successUrl?: string; cancelUrl?: string;
  }): Promise<CheckoutResult>;

  verifyWebhook(rawBody: Buffer, headers: Record<string, string>): GatewayEvent;
}

export type CheckoutResult =
  | { kind: 'redirect'; url: string }                 // Stripe hosted / Cielo 3DS
  | { kind: 'pix'; qrCode: string; copiaECola: string; expiresAt: string; chargeId: string }
  | { kind: 'confirmed'; subscriptionRef: string };   // cartão aprovado sem redirect
```

O **router** (`PaymentGatewayRouter`) recebe `(method, currency)` e devolve o adapter cujo
`supports()` casa. Os use cases dependem **do router**, nunca de um adapter concreto.

> ⚠️ **Ponto a verificar (pode ter mudado após meu corte de conhecimento — Jan/2026):**
> a disponibilidade do **Pix Automático** (débito recorrente via Pix) na API do Sicoob.
> Se ainda não estiver liberado, o **mensal em Pix** vira re-cobrança a cada ciclo (gera
> nova `cob` + lembrete) ou direciona-se o usuário mensal para **cartão (Cielo)**; o
> **anual em Pix** funciona perfeitamente como cobrança única. **Vale confirmar nas docs
> atuais da Cielo/Sicoob** (com busca web habilitada eu checo).
>
> Comece com **`FakePaymentGateway`** (implementa o port, no-op) para destravar dev/testes;
> os três adapters reais entram na Fase B-4.

---

## 3. Bounded context `billing` — estrutura

```
apps/emdr-remoto-system/backend/src/
├── contexts/billing/
│   ├── domain/
│   │   ├── entities/        plan.entity.ts · subscription.entity.ts · access-grant.entity.ts
│   │   ├── value-objects/   money.vo.ts · billing-interval.vo.ts
│   │   ├── enums/           subscription-status.enum.ts · license-reason.enum.ts
│   │   └── exceptions/      license-required.exception.ts · plan-not-found.exception.ts
│   ├── application/
│   │   ├── ports/output/    plan-repository.port.ts · subscription-repository.port.ts
│   │   │                    access-grant-repository.port.ts · billing-settings-repository.port.ts
│   │   │                    payment-gateway.port.ts
│   │   ├── dto/             license.dto.ts · plan.dto.ts
│   │   └── use-cases/
│   │       ├── resolve-license/          resolve-license.use-case.ts   ★ coração
│   │       ├── start-trial/              start-trial.use-case.ts        (no cadastro)
│   │       ├── create-checkout/          create-checkout.use-case.ts
│   │       ├── handle-gateway-event/     handle-gateway-event.use-case.ts (webhook)
│   │       ├── admin-update-settings/    ...
│   │       ├── admin-upsert-plan/        ...
│   │       └── admin-grant-access/       admin-grant-access.use-case.ts
│   └── billing.module.ts
└── infrastructure/
    ├── http/controllers/billing/   admin + user controllers + webhook + Response DTOs
    ├── external/billing/            adapters de pagamento (implementam PaymentGatewayPort)
    │   ├── payment-gateway.router.ts    ★ escolhe o adapter por (method, currency)
    │   ├── cielo-card.adapter.ts        (BR · cartão · BRL)
    │   ├── sicoob-pix.adapter.ts        (BR · Pix · BRL)
    │   ├── stripe.adapter.ts            (INTL · cartão · USD)
    │   └── fake-payment.adapter.ts      (dev/testes)
    ├── security/guards/            license.guard.ts   ★ NOVO (retorna 402)
    └── persistence/mikro-orm/      *-orm.entity.ts + repositories + mappers + migrations
```

---

## 4. Modelo de dados (MySQL / MikroORM)

| Tabela | Campos principais | Observações |
|---|---|---|
| `plans` | id, code (`monthly`\|`annual`), name, description, interval (`month`\|`year`), interval_count, features (JSON), highlight_text, active (bool), timestamps | **Sem preço aqui** — o preço é por moeda (ver `plan_prices`). |
| `plan_prices` | id, **plan_id** (FK), **currency** (char 3: `BRL`\|`USD`…), **amount_cents** (int), **stripe_price_id** (nullable — só Stripe usa), active (bool) | Preço **por moeda** de cada plano. Cielo/Sicoob enviam o `amount_cents`; Stripe usa o `stripe_price_id`. Ex.: monthly→{BRL: R$…, USD: $25}. |
| `billing_settings` | id, **free_mode** (bool), **trial_days** (int), default_currency, timestamps | **Linha única (singleton).** Use case garante que só existe uma. |
| `subscriptions` | id, **psicologo_id** (FK único), plan_id (FK, nullable no trial), **status**, **provider** (`cielo`\|`sicoob_pix`\|`stripe`, nullable no trial), **currency** (char 3), **trial_ends_at**, **current_period_end**, gateway_customer_id, gateway_subscription_id, canceled_at, timestamps | 1 por usuário (ciclo de vida). `TRIALING` no cadastro (sem provider). `provider`/`currency` gravados ao assinar. |
| `payment_events` | id, provider, external_id, type, raw (JSON), processed_at | (opcional, recomendado) idempotência de webhooks — não reprocessar o mesmo evento. |
| `access_grants` | id, **psicologo_id** (FK), **free_until** (date), granted_by (admin id), reason (text), active (bool), timestamps | Liberação manual do admin. Ativo enquanto `free_until >= hoje` e `active = true`. |

**Enums:**
```typescript
export enum SubscriptionStatus { TRIALING='trialing', ACTIVE='active', PAST_DUE='past_due',
  CANCELED='canceled', EXPIRED='expired' }
export enum LicenseReason { FREE_MODE='free_mode', ADMIN_GRANT='admin_grant',
  SUBSCRIPTION='subscription', TRIAL='trial', NONE='none' }
export enum PaymentProvider { CIELO='cielo', SICOOB_PIX='sicoob_pix', STRIPE='stripe' }
```

**Value Object `Money`:** `{ amountCents: number; currency: string }`, valida `amountCents >= 0`
e moeda ISO-4217. Métodos `format()` para exibição por moeda (R$ / US$). Nunca somar/exibir preço como `number` cru.

> A fonte da verdade do acesso é **o banco local** (rápido, sem chamar o gateway a cada
> request). Os webhooks do gateway mantêm `subscriptions` em sincronia.

---

## 5. Resolução de licença (o use case central)

```typescript
// resolve-license.use-case.ts — retorna LicenseView; NUNCA lança por falta de acesso
async execute({ psicologoId }: { psicologoId: string }): Promise<LicenseView> {
  const settings = await this.settingsRepo.get();
  if (settings.freeMode) return LicenseView.access(LicenseReason.FREE_MODE);

  const grant = await this.grantRepo.findActive(psicologoId); // free_until >= hoje && active
  if (grant) return LicenseView.access(LicenseReason.ADMIN_GRANT, grant.freeUntil);

  const sub = await this.subscriptionRepo.findByPsicologo(psicologoId);
  if (sub?.isActive(this.clock.now()))
    return LicenseView.access(LicenseReason.SUBSCRIPTION, sub.currentPeriodEnd, sub.plan);
  if (sub?.isTrialing(this.clock.now()))
    return LicenseView.access(LicenseReason.TRIAL, sub.trialEndsAt);

  return LicenseView.noAccess(); // reason = NONE → paywall
}
```

```typescript
// LicenseView (DTO devolvido ao cliente — sem dados sensíveis)
{ hasAccess: boolean; reason: LicenseReason; expiresAt: string | null;
  plan?: { code, name, priceCents, currency } }
```

---

## 6. Endpoints (todos com guard; contrato)

> **Papéis do EMDR Remoto (diferentes do KAZATEM):** `admin` · `psicologo` · `paciente`.
> O `AuthTokenPayload.role` reflete esses três. **`AdminGuard` = `JwtAuthGuard` + `role === 'admin'`**
> — psicólogo e paciente **nunca** acessam a área de configuração. O `admin` é uma conta
> própria (criada por seed/`npm run create:admin`, login separado `/api/auth/login-admin`),
> não é um psicólogo promovido.

### Admin (`@UseGuards(AdminGuard)` — só `role === 'admin'`)
| Método | Rota | Uso |
|---|---|---|
| GET / PUT | `/api/admin/billing/settings` | Ler/gravar `free_mode` e `trial_days` |
| GET | `/api/admin/billing/plans` | Listar planos + preços por moeda (inclui inativos) |
| PUT | `/api/admin/billing/plans/:code` | Editar features/highlight/active + **preços por moeda** (`plan_prices`: BRL, USD…) |
| GET | `/api/admin/billing/users?query=` | Listar usuários + status de licença resolvido |
| POST | `/api/admin/billing/users/:id/grant` | `{ freeUntil }` — liberar até a data |
| DELETE | `/api/admin/billing/users/:id/grant` | Revogar liberação manual |

### Usuário autenticado (`@UseGuards(JwtAuthGuard)`)
| Método | Rota | Uso |
|---|---|---|
| GET | `/api/me/license` | `LicenseView` do usuário logado (o front decide o modal) |
| GET | `/api/plans?currency=BRL\|USD` | Planos **ativos** com o preço da moeda pedida (do banco) |
| POST | `/api/billing/checkout` | `{ planCode, currency, method }` → o **router** escolhe o gateway → `CheckoutResult` (`redirect` \| `pix` \| `confirmed`) |
| POST | `/api/billing/portal` | (opcional, só Stripe) portal do cliente p/ gerenciar/cancelar |

### Webhooks (públicos — um por gateway, exceção documentada)
| Método | Rota | Verificação |
|---|---|---|
| POST | `/api/webhooks/stripe` | Assinatura `STRIPE_WEBHOOK_SECRET` + body **raw** |
| POST | `/api/webhooks/cielo` | Notificação Cielo → **consultar o pagamento na API** por id (não confiar no corpo) |
| POST | `/api/webhooks/sicoob` | Webhook Pix com **mTLS/validação de certificado** do Sicoob |

Todos chamam o **mesmo** `HandleGatewayEventUseCase` (via `verifyWebhook` do adapter do
provider), com **idempotência** (`payment_events`) para não reprocessar o mesmo evento.

---

## 7. Enforcement — bloqueio server-side (Defense in Depth)

`LicenseGuard`: aplica `ResolveLicenseUseCase`; se `hasAccess === false`, lança
`LicenseRequiredException` → o `GlobalExceptionFilter` mapeia para **HTTP 402**.

**Onde aplicar (as ações que “usam a ferramenta”):**
- Controller de **criar sessão EMDR** (`session` context) → `@UseGuards(JwtAuthGuard, LicenseGuard)`.
- **Gateway WebSocket** ao entrar na sala (`join-session`): checar licença do psicólogo
  antes de `client.join(...)`; sem acesso → `WsException('payment_required')`.
- Rotas de leitura de perfil/planos/license **não** exigem `LicenseGuard` (senão o usuário
  bloqueado não conseguiria nem ver os planos para pagar).

> **Regra:** só o **psicólogo** precisa de licença. O **paciente** entra por convite
> (hash) numa sessão que o psicólogo licenciado criou — não exige licença própria.

---

## 8. Frontend (Next.js 14 + MUI)

### 8.1 Área de administração — `app/admin/**` (acesso **só** `role === 'admin'`)

Todas as telas de configuração ficam sob `app/admin/**`, **na mesma aplicação Next.js**,
mas isoladas por papel:
- **Backend (barreira real):** todo `/api/admin/**` sob `AdminGuard` (`role === 'admin'`).
  Psicólogo ou paciente que chamar → **403**, independentemente do frontend.
- **Frontend (UX):** um `AdminLayout` em `app/admin/layout.tsx` que lê `role` do usuário
  autenticado; se **não** for `admin`, redireciona (ou 404) — a área nem aparece para
  psicólogo/paciente. Guard de rota é só experiência; a segurança está no backend.

> **Promover a app dedicada depois (sem retrabalho de backend):** se um dia quiser isolar
> por completo (bundle/subdomínio `admin.emdrremoto.com.br`, restrição por rede), basta
> extrair `app/admin/**` para um segundo app Next.js consumindo os **mesmos** endpoints
> `/api/admin/**`. A API não muda. Comece pela rota; promova só se houver gatilho.

**Telas:**
1. **Configurações de cobrança** — toggle `free_mode`; input `trial_days`; salvar (notistack).
2. **Planos** — por plano: features (lista editável), texto de destaque, `active`, e
   **preços por moeda** (BRL e USD, com máscara de moeda). Preview do card.
3. **Usuários & liberações** — busca de usuário; status de licença (badge:
   Trial/Ativo/Liberado/Sem acesso + data de expiração); **“Liberar até…”** (date picker →
   `free_until`) e **“Revogar”**.

### 8.2 Modal de paywall (o anexo) — com seletor de região/moeda
- Disparo: após o login, o app chama `GET /api/me/license`. Se `hasAccess === false`, abre o
  modal. O interceptor do axios também captura **402** de qualquer chamada e reabre o modal.
- **Seletor de região/moeda** (topo do modal): **Brasil (BRL)** ou **Internacional (USD)**.
  Default por locale/IP, ajustável pelo usuário. A escolha define moeda **e** métodos:
  - **BRL** → cartão (**Cielo**) + **Pix** (**Sicoob**).
  - **USD** → cartão (**Stripe**).
- Conteúdo: dois cards (**Mensal / Anual**) de `GET /api/plans?currency=…` — título, checklist
  de features (check rosa), **preço na moeda escolhida**, texto de destaque, botão **Subscribe**.
- `Subscribe` → `POST /api/billing/checkout { planCode, currency, method }`. Trata o `CheckoutResult`:
  - `redirect` (Stripe/Cielo 3DS) → redireciona para a `url`.
  - `pix` (Sicoob) → renderiza **QR Code + copia-e-cola** e faz polling em `/api/me/license`
    até virar ativa (ou aguarda o webhook confirmar).
  - `confirmed` → fecha o modal e libera.
- Layout conforme a imagem (cards brancos, fundo claro, check rosa, CTA azul) — **MUI**, sem
  cores hardcoded (`theme.palette`).
- O modal **não é dispensável** para usar a ferramenta (pode fechar, mas as ações seguem
  bloqueadas via 402). Banner não-bloqueante “Sua avaliação termina em N dias” quando
  `reason = TRIAL`; paywall cheio quando `NONE`.

---

## 9. Plano de implementação (passo a passo, com DoD)

### Fase B-0 — Fundação do context `billing`
- Criar estrutura de pastas; enums; VO `Money`; `billing_settings` singleton (migration +
  seed: `free_mode=false`, `trial_days=7`); seed dos planos `monthly`/`annual` com os
  valores da imagem.
- **DoD:** migrations rodam; seed cria settings + 2 planos; typecheck limpo.

### Fase B-1 — Resolução de licença + trial no cadastro
- `ResolveLicenseUseCase`; `StartTrialUseCase` chamado no fluxo de cadastro do psicólogo
  (cria `subscription` TRIALING com `trial_ends_at` snapshot).
- `GET /api/me/license`.
- **DoD:** usuário recém-criado retorna `TRIAL` com `expiresAt` correto; após a data, `NONE`.
  Testes unitários cobrindo as 5 precedências da Seção 1.1.

### Fase B-2 — Admin: settings, planos e grants
- Endpoints e use cases de admin (Seção 6). Validação `class-validator` em tudo
  (`trial_days >= 0`, `free_until` data futura, `amount_cents >= 0` por moeda, moeda ISO).
- **DoD:** admin altera `trial_days`/`free_mode`; edita preço de plano; libera e revoga
  usuário; tudo refletido em `GET /api/me/license` daquele usuário.

### Fase B-3 — Enforcement (LicenseGuard + 402)
- `LicenseGuard` + `LicenseRequiredException` → 402 no `GlobalExceptionFilter`.
- Aplicar em criar-sessão e no `join-session` do Gateway.
- **DoD:** usuário `NONE` recebe 402 ao criar sessão e é recusado no socket; usuário com
  acesso passa. `free_mode=true` libera todo mundo.

### Fase B-4 — Gateways de pagamento (port + router + adapters)
- `PaymentGatewayPort` + `PaymentGatewayRouter` + `FakePaymentGateway` (dev).
- `create-checkout` roteando por `(method, currency)`; `HandleGatewayEventUseCase` (idempotente
  via `payment_events`) atualiza `subscriptions` (provider/currency/status/period_end).
- **B-4a — Stripe (INTL/USD):** adapter + webhook `/api/webhooks/stripe` (assinatura + raw body).
- **B-4b — Cielo (BR/cartão):** adapter (tokenização/3DS + recorrência) + webhook `/api/webhooks/cielo`
  (consulta o pagamento por id). Lógica de dunning (retentativa/cartão vencido).
- **B-4c — Sicoob (BR/Pix):** adapter (`cob`/`cobv` → QR + copia-e-cola) + webhook `/api/webhooks/sicoob`
  (mTLS). Anual = cobrança única; mensal = Pix Automático **ou** re-cobrança (ver ⚠️ Seção 2).
- **DoD:** para cada trilho, checkout de teste → webhook → `subscription` vira `ACTIVE`;
  `GET /api/me/license` retorna `SUBSCRIPTION`; assinatura/checksum inválido no webhook = 400;
  evento repetido não é reprocessado.

### Fase B-5 — Frontend: admin (role) + paywall (multi-região)
- Área `app/admin/**` com `AdminLayout` restrito a `role === 'admin'`; 3 telas (8.1).
- Modal de paywall (8.2) com seletor BRL/USD, cards de `/api/plans?currency=…`, tratamento de
  `redirect`/`pix`/`confirmed`; interceptor 402; banner de trial.
- **DoD:** psicólogo/paciente não veem nem acessam `/admin` (e recebem 403 na API); admin
  configura tudo pela UI; login sem licença abre o modal; fluxo BRL (cartão+Pix) e USD
  (cartão) levam à ativação; após pagar, o modal some no próximo login.

---

## 10. Segurança (Security by Design — checklist do módulo)

- [ ] Área de admin restrita a **`role === 'admin'`** (`AdminGuard`); psicólogo/paciente = 403.
- [ ] **Licença verificada no servidor** (LicenseGuard/402 + checagem no Gateway) — o modal
      é só UX, nunca a única barreira.
- [ ] **Cada webhook valida a origem** do seu provider (Stripe: assinatura+raw; Cielo: consulta
      o pagamento por id; Sicoob: mTLS) e é **idempotente** (`payment_events`).
- [ ] Preço/settings/grants **só** mutáveis por admin; **preço nunca vem do cliente** — o back
      resolve `amount_cents`/`stripe_price_id` a partir de `(planCode, currency)`.
- [ ] **Dados de cartão nunca tocam o servidor** — tokenização no client (Cielo/Stripe); o
      backend recebe só o token. Mantém você fora do escopo pesado de PCI.
- [ ] `amount_cents` como **inteiro** por moeda (VO `Money`) — nunca float; moeda validada (ISO-4217).
- [ ] Chaves dos gateways **só em `.env`** (+ `.env.example`); nunca no frontend (exceto a
      publishable key da Stripe com prefixo `NEXT_PUBLIC_`).
- [ ] Response DTOs sem campos sensíveis (nenhum `gateway_customer_id`/secret vaza ao cliente).
- [ ] `trial_days` afeta só novos cadastros (snapshot em `trial_ends_at`).
- [ ] Logs sem dados de pagamento; erros internos não vazam (GlobalExceptionFilter).

---

## 11. Variáveis de ambiente (novas)

```env
# Comum
BILLING_SUCCESS_URL=https://emdrremoto.com.br/billing/success
BILLING_CANCEL_URL=https://emdrremoto.com.br/billing/cancel
BILLING_DEFAULT_CURRENCY=BRL

# Stripe (INTL / USD)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Cielo (BR / cartão) — API 3.0
CIELO_MERCHANT_ID=
CIELO_MERCHANT_KEY=
CIELO_ENV=sandbox            # sandbox | production

# Sicoob (BR / Pix) — Pix Cobrança
SICOOB_CLIENT_ID=
SICOOB_PIX_KEY=              # chave Pix recebedora (conta PJ)
SICOOB_CERT_PATH=           # certificado mTLS (montar via secret/volume no Dokploy)
SICOOB_CERT_PASSWORD=
SICOOB_ENV=sandbox

# Frontend
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_CIELO_TOKENIZE_KEY=     # chave pública p/ tokenizar cartão no client (sem PCI no servidor)
```

> Adicionar ao `.env.example`. No Dokploy (project `emdrremoto`), configurar na aba
> Environment e **Redeploy**. Cadastrar as URLs de webhook no painel de cada provider
> apontando para `/api/webhooks/{stripe,cielo,sicoob}` no domínio público. O certificado
> mTLS do Sicoob entra como **secret/volume** (nunca commitado).
