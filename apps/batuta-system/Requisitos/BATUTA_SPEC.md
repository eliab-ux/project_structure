# BATUTA — Especificação Técnica

**Versão 2** — escopo v1 reduzido a envio 1:1 para contatos. Grupos de WhatsApp fora do escopo.

> **Este documento é instrução direta de implementação para o Claude Code.**
> Leia integralmente antes de escrever qualquer linha de código.
> Leia também o `CLAUDE.md` da raiz do monorepo — ele **prevalece** em qualquer conflito
> com este arquivo em matéria de arquitetura, segurança e convenções.

---

## 0. Identidade do sistema

**Batuta** é um SaaS multi-tenant de distribuição de conteúdo para WhatsApp, operando
sobre **múltiplos números remetentes** ("chips"), com envio **1:1 para contatos
individuais**.

Cada contato é permanentemente vinculado a um chip remetente e recebe **sempre** daquele
número. O sistema também recebe e organiza as **respostas** desses contatos numa fila
única de atendimento.

Público-alvo: gabinetes parlamentares (comunicação institucional e eleitoral) e agências
de marketing. Cada cliente é uma **conta isolada** que **opera sozinha** (self-service).

| Item | Valor |
|---|---|
| Localização no monorepo | `apps/batuta-system/{backend,frontend}` |
| Project no Dokploy | `batuta` (novo) |
| Domínio final | `batuta.com.br` |
| Domínio de validação | `batuta.techbs.com.br` |
| Backend | NestJS 10 + Fastify + MikroORM 6 |
| Banco | **PostgreSQL self-hosted no servidor mdantas**, database `batuta` |
| Filas | BullMQ + Redis |
| Storage | MinIO (self-hosted) |
| E-mail | nodemailer → Mailcow (`mail.mdantas.com.br:465`, SSL direto) |
| WhatsApp | Evolution API |
| Frontend | Next.js 14 (App Router) + Material-UI |
| Prefixo de env | `BATUTA_` |

### Nomenclatura — regra rígida

A metáfora musical fica **exclusivamente** no produto: nome comercial, domínio, textos de
UI. **Nunca** nos identificadores de código.

- ✅ `Channel`, `Contact`, `Content`, `Variant`, `Distribution`, `Dispatch`, `Conversation`
- ❌ `Naipe`, `Regencia`, `Partitura`, `Maestro`, `Batuta` como entidade/tabela/classe

Código e identificadores em **inglês**; comentários, docs e UI em **pt-BR**.

### Por que Postgres self-hosted (decisão tomada)

O Batuta é multi-tenant com escrita intensa em `dispatches`, `messages` e
`channel_daily_counters`, e roda workers BullMQ concorrentes — cada worker abre conexão.
Supabase foi descartado por duas dores já documentadas no Ecoa: `EACCES` na conexão
direta (obrigou Session Pooler) e `EMAXCONNSESSION` por pool do ORM acima do limite do
pooler. Com workers concorrentes isso piora.

Postgres no mdantas, `pool: { min: 0, max: 5 }` na API e pool próprio limitado nos
workers. Some API + workers ao dimensionar `max_connections`.

---

## 1. Regras invioláveis

Não são negociáveis e não dependem de o requisito mencioná-las. Violação = revisão reprovada.

1. **Isolamento de tenant.** Toda query de dado de negócio é escopada por `account_id`,
   vindo **sempre do JWT** — nunca de body, query ou header.
2. **Remetente fixo por contato.** Um contato, uma vez alocado a um canal, recebe
   **sempre** daquele canal. Única exceção: **migração explícita, aprovada por humano e
   auditada** (§6.4). Nenhum código reatribui remetente automaticamente.
3. **Classificação obrigatória.** Todo conteúdo nasce com `classification`
   (`INSTITUTIONAL` | `ELECTORAL`). Sem default, sem nulo.
4. **Nenhum envio sem aprovação.** Distribuição só executa sobre conteúdo `APPROVED`.
   Edição de conteúdo aprovado invalida a aprovação (§8.5).
5. **Cota é teto rígido.** Nenhum caminho de código envia acima da cota do canal nem do
   teto da conta. Plano que não cabe é reportado, nunca truncado em silêncio.
6. **Trilha append-only.** `audit_logs` não tem `UPDATE` nem `DELETE`.
7. **Canais de sistema separados dos canais de tenant.** Notificação de aprovação,
   alerta e e-mail transacional **nunca** trafegam por chip de cliente.
8. **Idempotência no despacho.** Reprocessar job não gera envio duplicado.
9. **Merge field sempre com fallback.** Nenhum envio sai com placeholder vazio (§7.4).
10. **Resposta a inbound nunca é automática.** IA rascunha, humano envia (§10).
11. Todas as regras de Security by Design do `CLAUDE.md`.

---

## 2. Fora de escopo — não implementar

Excluídos deliberadamente. Não implemente, não sugira, não deixe `TODO` apontando.

**Fora da v1, mas aditivo no futuro:**
- **Grupos de WhatsApp.** Nenhuma tabela, nenhum roteamento, nenhuma criação de grupo.
  Se voltar ao escopo, entra como capacidade nova: `dispatches` recebe coluna nullable de
  destino de grupo (em Postgres 11+, adicionar coluna nullable sem default é operação de
  metadado, barata mesmo em tabela grande). **Não construa polimorfismo especulativo agora.**
- **Instagram Graph API.** Ingestão é upload manual (§7.2).
- **`city` e demais merge fields além de `first_name`.**

**Excluídos por princípio — não implementar nunca:**
- **Scraping do Instagram** ou de qualquer rede.
- **Spoofing de device fingerprint** ou falsificação de metadado de dispositivo.
- **Rotação de proxy por chip** ou ofuscação de origem.
- **Geração automática de variantes** com o propósito de driblar detecção de duplicidade.
  Variante existe para adequação de público e é redigida ou revisada por humano (§7.3).
- **Importação sem registro de procedência e base de consentimento** (§6.1).
- **Resposta automática a inbound** sem humano no circuito (exceto opt-out, §6.5).

---

## 3. Arquitetura

Hexagonal (Ports & Adapters). Dependências apontam para dentro:
`Infrastructure → Application → Domain`.

### Bounded contexts (`src/contexts/`)

| Context | Responsabilidade |
|---|---|
| `auth` | Login, refresh, reset de senha, JWT |
| `account` | Tenant, plano, cotas, status, suspensão |
| `user` | Usuários da conta, roles |
| `channel` | Chips: provisionamento, pareamento, estados, throttle adaptativo, saúde |
| `audience` | Contatos, importação, alocação, migração de remetente, opt-out |
| `content` | Conteúdo, variantes, mídias, merge fields, classificação |
| `approval` | Configuração, solicitações, decisão via magic link |
| `distribution` | Planejamento: resolução de público, agendamento, prévia |
| `dispatch` | Execução: workers, adapter Evolution, retry, circuit breaker |
| `inbox` | Conversas, fila de pendências, atendimento, respostas rápidas |
| `audit` | Trilha imutável, exportação |
| `platform` | Admin da plataforma: tetos globais, sinais de abuso, suspensão |

### Infraestrutura (`src/infrastructure/`)

```
infrastructure/
├── http/               # controllers, DTOs, filters
├── security/           # jwt-token.service, guards, TenantContext
├── persistence/mikro-orm/   # entities (-orm.entity.ts), repositories, mappers, migrations
├── messaging/
│   ├── queues/         # BullMQ: filas e producers
│   └── workers/        # consumers
├── whatsapp/           # adapter Evolution API (outbound + webhooks inbound/ack)
├── storage/            # adapter MinIO
├── mail/               # adapter nodemailer/Mailcow
└── observability/      # error-reporter port + NoopErrorReporter
```

---

## 4. Modelo de dados

Toda tabela de negócio tem `account_id NOT NULL`. Exceções: `accounts`, `platform_admins`.

### Tenant e acesso

**`accounts`** — `id`, `name`, `document`, `plan`, `status` (`TRIAL|ACTIVE|SUSPENDED`),
`daily_send_ceiling`, `timezone`, `evolution_server_url` (nullable),
`evolution_api_key` (nullable), `created_at`

> `evolution_server_url` / `evolution_api_key` nulos → usa o servidor Evolution da
> plataforma (`EVOLUTION_API_URL`). Preenchidos → aquele tenant roda em servidor
> dedicado. Ver §14, decisão 7.

**`users`** — `id`, `account_id`, `name`, `email`, `password_hash`, `role`
(`ACCOUNT_ADMIN|OPERATOR`), `status`, `created_at` → único (`account_id`, `email`)

**`platform_admins`** — tabela **separada**, sem `account_id`, fluxo de auth próprio.
Separada de propósito: elimina a classe de bug em que `account_id` nulo vaza dado entre tenants.

### Canais

**`channels`** — `id`, `account_id`, `label`, `phone_e164`, `evolution_instance_name`,
`status`, `warmup_started_at`, `current_quota`, `quota_floor`, `quota_ceiling`,
`consecutive_failures`, `last_send_at`, `last_quota_review_at`, `retired_at`,
`retired_by`, `created_at`

`status` ∈ `PROVISIONING | AWAITING_QR | CONNECTED | DISCONNECTED | DEGRADED | BANNED | RETIRED`

> **Semântica dos estados — crítico.** `DISCONNECTED` é **transitório** (celular
> desligado, QR expirado, queda de rede) e **nunca** habilita migração de contatos.
> `BANNED` e `RETIRED` são **terminais** e só se atingem por **declaração humana
> explícita**. Nenhuma rotina automática promove canal a estado terminal.

**`channel_daily_counters`** — `id`, `account_id`, `channel_id`, `date`,
`campaign_sends`, `reply_sends` → único (`channel_id`, `date`).
Fonte de verdade da cota. Redis é cache, não verdade.

**`channel_quality_snapshots`** — `id`, `account_id`, `channel_id`, `date`,
`sent_count`, `failed_count`, `delivered_count`, `inbound_count`, `opt_out_count`,
`disconnect_events`, `computed_quota`, `decision` (`RAISE|HOLD|LOWER|PAUSE`), `reason`

### Contatos

**`contacts`** — `id`, `account_id`, `phone_e164`, `name`, `first_name`, `tags` (jsonb),
`current_channel_id`, `active`, `opted_out_at`, `contact_import_id`, `created_at`
→ único (`account_id`, `phone_e164`)

> `first_name` é **derivado** de `name` na importação (primeira palavra, capitalizada) e
> persistido. Não recalcule em tempo de envio.

**`contact_sender_history`** — `id`, `account_id`, `contact_id`, `channel_id`,
`assigned_at`, `released_at`, `reason` (`INITIAL_ALLOCATION|MIGRATION`), `migration_id`
→ Nunca sobrescreva `current_channel_id` sem gravar aqui. Precisa responder "qual número
falou com esta pessoa em março?" para auditoria e suporte.

**`contact_imports`** — `id`, `account_id`, `file_name`, `storage_key`, `uploaded_by`,
`total_rows`, `imported_count`, `duplicated_count`, `invalid_count`,
`missing_first_name_count`, `consent_basis`, `origin_note`, `created_at`

**`sender_migrations`** — `id`, `account_id`, `from_channel_id`, `strategy`
(`ALL_TO_ONE|REDISTRIBUTE`), `to_channel_id` (nullable), `contacts_affected`,
`requested_by`, `approved_by`, `status`, `executed_at`

### Conteúdo

**`contents`** — `id`, `account_id`, `title`, `classification`
(`INSTITUTIONAL|ELECTORAL`), `origin` (`MANUAL|PDF`), `body_base`, `source_url`,
`status` (`DRAFT|PENDING_APPROVAL|APPROVED|REJECTED|ARCHIVED`), `content_hash`,
`created_by`, `approved_at`, `created_at`

> `source_url` guarda o link do post do Instagram como **procedência**. É metadado.
> Nenhum código busca conteúdo a partir dele.

**`content_variants`** — `id`, `account_id`, `content_id`, `label`, `body`, `position`,
`created_by`, `reviewed_by`

**`media_assets`** — `id`, `account_id`, `content_id`, `variant_id` (nullable), `kind`
(`IMAGE|VIDEO|DOCUMENT`), `storage_key`, `mime_type`, `size_bytes`, `original_name`

### Aprovação

**`approval_settings`** — `id`, `account_id`, `required_for_institutional` (1|2),
`required_for_electoral` (1|2), `notify_channel` (`EMAIL|WHATSAPP|BOTH`)

**`approvers`** — `id`, `account_id`, `name`, `email`, `phone_e164`, `active`

**`approval_requests`** — `id`, `account_id`, `content_id`, `content_hash`,
`approver_id`, `token_hash`, `expires_at`, `status`
(`PENDING|APPROVED|REJECTED|EXPIRED|INVALIDATED`), `decided_at`, `decided_ip`,
`decided_user_agent`, `comment`

> Armazene **hash** do token. Token em claro só existe no link enviado.

### Distribuição e despacho

**`distributions`** — `id`, `account_id`, `content_id`, `window_start`, `window_end`,
`status` (`DRAFT|PLANNED|RUNNING|PAUSED|COMPLETED|CANCELLED`), `target_filter` (jsonb),
`config` (jsonb), `created_by`, `created_at`

**`dispatches`** — `id`, `account_id`, `distribution_id`, `contact_id`, `channel_id`,
`variant_id`, `rendered_body`, `scheduled_at`, `status`
(`PENDING|SENDING|SENT|FAILED|CANCELLED|BLOCKED`), `blocked_reason`, `attempts`,
`evolution_message_id`, `delivery_status`, `error_detail`, `sent_at`

`blocked_reason` ∈ `SENDER_UNAVAILABLE | CONTACT_OPTED_OUT | CONTACT_INACTIVE |
QUOTA_EXCEEDED | ACCOUNT_SUSPENDED | CONTENT_NOT_APPROVED`

> `rendered_body` guarda o texto **final**, com merge fields já resolvidos. É o que foi
> efetivamente enviado — base da auditoria e do relatório exportável.

Índices: (`account_id`,`status`,`scheduled_at`), (`channel_id`,`scheduled_at`),
(`distribution_id`,`status`), (`contact_id`,`sent_at`).

> **Crescimento.** `dispatches` e `messages` crescem rápido. Não particione agora, mas
> escolha as chaves sabendo que particionar por mês em `scheduled_at` / `received_at`
> pode ser necessário — particionar depois exige a coluna de partição na PK, e trocar PK
> em tabela grande é migração dolorosa.

### Caixa de entrada

**`conversations`** — `id`, `account_id`, `contact_id`, `channel_id`, `status`
(`PENDING_REPLY|IN_PROGRESS|RESOLVED|ARCHIVED`), `priority` (`NORMAL|HIGH`),
`intent_class`, `last_inbound_at`, `last_outbound_at`, `locked_by`, `locked_at`,
`unread_count`, `created_at` → único (`account_id`, `contact_id`)

`intent_class` ∈ `OPT_OUT | ACKNOWLEDGMENT | WRONG_NUMBER | QUESTION | COMPLAINT | OTHER`

**`messages`** — `id`, `account_id`, `conversation_id`, `contact_id`, `channel_id`,
`direction` (`INBOUND|OUTBOUND`), `kind`
(`TEXT|IMAGE|AUDIO|VIDEO|DOCUMENT|STICKER|OTHER`), `body`, `media_storage_key`,
`evolution_message_id`, `delivery_status`, `dispatch_id` (nullable), `sent_by`
(nullable), `occurred_at`, `created_at`

**`quick_replies`** — `id`, `account_id`, `title`, `body`, `tags` (jsonb), `created_by`

**`audit_logs`** — `id`, `account_id`, `actor_type`, `actor_id`, `action`,
`entity_type`, `entity_id`, `payload` (jsonb, sanitizado), `ip`, `created_at`.
**Append-only.**

---

## 5. Fases 0 a 2 — fundação, tenant, canais

**Regra de processo:** cada fase termina com relatório do que foi feito e **aguarda
aprovação explícita** antes da próxima. Não emende fases. Não implemente fase futura
"de antemão".

---

### FASE 0 — Fundação

1. Criar `apps/batuta-system/{backend,frontend}` seguindo o padrão de `apps/kaza-tem-system`.
2. NestJS 10 + Fastify, `setGlobalPrefix('api')`, `ValidationPipe` global
   (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`).
3. `config/env.validation.ts` — valida env no startup, falha rápido.
4. MikroORM (driver PostgreSQL), `pool: { min: 0, max: 5 }`, migrations habilitadas.
   **Nenhum `create_all`/`schema:update` em produção.**
5. `GlobalExceptionFilter` (`DomainException` → 400, `HttpException` → status, resto → 500).
6. `ERROR_REPORTER` port + `NoopErrorReporter` globais.
7. `/api/health` público, com comentário documentando a ausência de guard.
8. Redis + BullMQ conectados; uma fila de smoke test.
9. MinIO adapter (`putObject`, `getSignedUrl`); bucket por conta `batuta-{account_id}`,
   criado sob demanda.
10. Dockerfiles monorepo-aware, base **`node:22-alpine`**, contexto de build = raiz.
11. `.env.example` completo; `lint`, `typecheck`, `test` passando.

**Entrega:** app sobe, `/api/health` responde, migration inicial aplicada.

---

### FASE 1 — Multi-tenancy, autenticação e controles de plataforma

Espinha dorsal. Erro aqui contamina todo o resto.

1. `accounts`, `users`, `platform_admins` + migrations.
2. **Auth de tenant:** `/api/auth/login` (email + senha), `/refresh`, `/me`,
   `/request-password-reset`, `/reset-password`. `bcryptjs` + `jsonwebtoken`.
   ```ts
   interface AuthTokenPayload {
     sub: string;        // user id
     accountId: string;  // tenant
     role: 'ACCOUNT_ADMIN' | 'OPERATOR';
   }
   ```
3. **Auth de plataforma:** `/api/platform/auth/login`, payload separado
   (`sub`, `scope: 'PLATFORM'`), guard `PlatformAdminGuard`.
4. **`TenantContext` + isolamento mecânico.** Filtro global do MikroORM por `account_id`,
   alimentado por request a partir do JWT.
   - Repositórios **não** recebem `accountId` como parâmetro que alguém pode esquecer.
     O escopo é aplicado na camada de persistência.
   - **Nenhum** DTO de request aceita `accountId`.

   > **Os dois furos conhecidos deste desenho — trate como requisito, não como cuidado.**
   >
   > **1. Raw SQL não passa pelo filtro.** O filtro global aplica em query de entidade e
   > **não** em `em.getKnex().raw(...)` — que o `CLAUDE.md` autoriza para métricas. Toda
   > query raw precisa de `account_id` no `WHERE`, com placeholder `?`. Crie um helper
   > único para raw escopado e proíba `getKnex()` direto fora dele, para que exista um só
   > lugar a auditar.
   >
   > **2. Contexto por request.** O `RequestContext` do MikroORM precisa de fork por
   > request (middleware `MikroOrmModule` com `registerRequestContext`). Sem fork,
   > requests concorrentes compartilham o EntityManager e o `account_id` de um vaza no
   > outro — bug que não aparece em teste sequencial e aparece em produção sob carga.
   > Escreva teste concorrente: duas requests de contas diferentes em paralelo, cada uma
   > só vê o seu dado.
5. Guards: `JwtAuthGuard`, `AccountAdminGuard`, `PlatformAdminGuard`.
6. **Cotas e abuso — requisito desta fase, não melhoria futura:**
   - `accounts.daily_send_ceiling` **prevalece** sobre a soma das cotas de canal.
     Valide na aplicação.
   - Sinais agregados por conta: taxa de opt-out, taxa de falha, taxa de entrega,
     salto súbito de volume. Persistir e expor ao contexto `platform`.
   - `status = SUSPENDED` → workers recusam envio, distribuições `RUNNING` vão a
     `PAUSED`, login continua permitido (o usuário precisa ver o motivo).
7. `audit_logs` + serviço de auditoria. Registrar: login, alteração de canal,
   importação, migração de remetente, aprovação, criação e execução de distribuição,
   suspensão, envio de resposta manual.

**Testes obrigatórios:**
- Rota protegida sem token → 401; token inválido → 401.
- `OPERATOR` em rota `ACCOUNT_ADMIN` → 403.
- **Cross-tenant:** usuário da conta A pedindo entidade da conta B → 404.
  Escreva este teste para **cada** repositório criado nas fases seguintes.
- Conta `SUSPENDED` → worker recusa.

---

### FASE 2 — Canais e throttle adaptativo

1. CRUD de `channels`, escopado por conta.
2. **Adapter Evolution atrás de `WhatsAppGatewayPort`:** `createInstance`, `getQrCode`,
   `getConnectionState`, `logout`, `deleteInstance`, `sendText`, `sendMedia`,
   `sendDocument`. Credenciais em `.env`. Nenhuma URL/key hardcoded.
   - **Resolução de servidor por conta:** o adapter lê `accounts.evolution_server_url` /
     `evolution_api_key`; nulos → cai no `EVOLUTION_API_URL` da plataforma. Nunca leia a
     env diretamente no ponto de envio — sempre pelo resolvedor.
   - **Nome de instância namespaced:** `acct-{account_id}-ch-{channel_id}`. Nome sem
     namespace permite colisão entre tenants no servidor compartilhado.
3. Pareamento: `PROVISIONING` → `AWAITING_QR` (expõe QR) → `CONNECTED`.
4. **Webhooks da Evolution** (uma rota, validada por token compartilhado no header):
   - mudança de estado de conexão → atualiza `channels.status`
   - confirmação de entrega/leitura → atualiza `dispatches.delivery_status` e `messages`
   - mensagem recebida → alimenta a Fase 8
   - **O webhook jamais promove canal a `BANNED` ou `RETIRED`.**
5. Estados terminais: `POST /channels/:id/retire`, `AccountAdminGuard`, motivo textual
   obrigatório, confirmação. Grava `retired_by`, `retired_at`, auditoria.

#### 2.1 Throttle adaptativo — substitui cota fixa

**Contexto que justifica o desenho:** não existe limite oficial de envio para uso não
oficial da Evolution API. Os limites publicados pela Meta (faixas de 1K/10K/100K
conversas por 24h) valem para a Cloud API e **não se aplicam aqui**. Números que
circulam em comunidades de marketing são folclore. Portanto o sistema **mede em vez de
supor**: começa conservador, sobe enquanto os sinais estão limpos, recua sozinho quando
degradam.

**Sinais efetivamente observáveis** (não invente outros — o WhatsApp não informa bloqueio):

| Sinal | Como obter | Leitura |
|---|---|---|
| `failure_rate` | erro retornado no envio | falha de API/instância |
| `delivery_rate` | ack de entrega por webhook | **principal proxy de bloqueio/ban** — contato que bloqueou nunca entrega |
| `inbound_rate` | mensagens recebidas ÷ enviadas | proporção fala/escuta; chip que só fala é o perfil que cai |
| `opt_out_rate` | opt-outs ÷ enviadas | rejeição explícita |
| `disconnect_events` | webhook de conexão | instabilidade da instância |

**Revisão diária por canal** (job agendado). Grava `channel_quality_snapshots` com a
decisão e o motivo — a decisão precisa ser auditável, não opaca:

```
janela = últimos N dias com envio

se disconnect_events alto OU failure_rate > limiar_grave
                                      → PAUSE  (status = DEGRADED, alerta)
senão se delivery_rate < limiar_baixo OU opt_out_rate > limiar
                                      → LOWER  (current_quota × fator_recuo, piso = quota_floor)
senão se todos os sinais limpos por N dias consecutivos
                                      → RAISE  (current_quota × fator_avanço, teto = quota_ceiling)
senão                                 → HOLD
```

Regras do throttle:
- `current_quota` é **persistido e ajustado pelo job** — nunca editável direto pela UI.
  O operador ajusta `quota_floor` e `quota_ceiling`, não o valor corrente.
- Canal novo entra em `warmup_started_at` com `current_quota = quota_floor`.
- Subida é **gradual**; recuo é **agressivo**. Assimetria proposital.
- Cota cobre **campanha + respostas somadas** para efeito de risco, mas resposta tem
  faixa própria e prioritária no agendamento (§9.2).
- Limiares e fatores são configuração (§12, decisão pendente) — **não hardcode**.

> **Alocação ≠ cota.** Alocar contato a canal é `UPDATE` e pode ser imediato. Cota limita
> **envio por dia**. Um canal novo pode ter 500 contatos alocados hoje e despachar 20/dia
> enquanto aquece. A consequência é que a distribuição leva mais dias naquele canal — e
> isso tem que aparecer na prévia (§9.3), não ser descoberto depois.

6. **Painel de saúde por canal:** envios/dia (métrica real de risco), `current_quota` e
   histórico de decisões do throttle, `delivery_rate`, `inbound_rate`, `opt_out_rate`,
   falhas consecutivas, uptime de conexão.

---

## 6. FASE 3 — Contatos, alocação e migração

### 6.1 Importação

1. Upload CSV/XLSX → MinIO → `contact_imports`.
2. Mapeamento de colunas: **telefone obrigatório**, nome e tags opcionais.
3. **Normalização E.164** obrigatória. Telefone que não normaliza → `invalid`, com
   relatório por linha. Nunca importe telefone cru.
4. **Deduplicação por (`account_id`, `phone_e164`).** Contato existente **mantém o canal
   que já tinha**. Duplicata nunca realoca.
5. `first_name` derivado de `name` (primeira palavra, capitalizada) e persistido.
   Contar e reportar `missing_first_name_count` — o operador precisa saber quantos
   contatos vão cair no fallback **antes** de disparar (§7.4).
6. **Campos obrigatórios de procedência:** `consent_basis` e `origin_note`. Importação
   sem eles é rejeitada. É campo de banco, não burocracia — é o que permite responder de
   onde veio a lista.
7. Importação grande roda em job BullMQ com progresso, nunca no request.

### 6.2 Alocação — regra única

```
canal_destino = canais da conta
                  onde status = CONNECTED e não BANNED/RETIRED
                ordenados por (contatos_alocados ASC, created_at ASC, id ASC)
                → primeiro
```

Gulosa por menor carga, desempate determinístico. **Nada além disso.**

Esta regra única resolve os dois casos:
- Operação normal: distribui parelho entre os canais.
- Canal novo com 0 contatos entre canais com 100: por ter menos carga, recebe **todos**
  os contatos novos até empatar, e então volta ao rateio normal. Não precisa de "modo
  catch-up", cálculo de paridade nem flag.

Grave `contact_sender_history` com `reason = INITIAL_ALLOCATION`.
Sem canal elegível → importação **falha com mensagem clara**. Nunca aloque a canal
desconectado.

### 6.3 Roteamento no envio

O remetente é `contacts.current_channel_id`. **Não há escolha em tempo de despacho.**
Canal não `CONNECTED` → dispatch nasce `BLOCKED` com `SENDER_UNAVAILABLE` e aparece na
prévia. **Não caia para outro canal.**

### 6.4 Migração de remetente

Único caminho pelo qual um contato troca de canal.

1. **Elegibilidade:** canal de origem em `BANNED` ou `RETIRED`. Canal `DISCONNECTED`
   **não** habilita — bloqueie na aplicação com mensagem explicando que desconexão é
   transitória. Migrar 100 contatos porque alguém deixou o celular sem bateria é
   irreversível na prática.
2. **Estratégias:**
   - `ALL_TO_ONE` — todos para um canal escolhido. Simples, mas desequilibra: mostre na
     prévia a carga resultante do destino.
   - `REDISTRIBUTE` — distribui entre os restantes pela regra gulosa da §6.2.
     **Padrão sugerido na UI**, preserva o balanceamento.
3. **Prévia obrigatória:** quantos contatos mudam de remetente, carga por canal
   antes/depois.
4. Exige `AccountAdminGuard` + `approved_by`. Grava `sender_migrations`,
   `contact_sender_history` (`reason = MIGRATION`) e auditoria.
5. **Dispatches pendentes do canal morto:** resolver explicitamente — reatribuir ao novo
   remetente ou `CANCELLED` com motivo. **Nunca deixe dispatch órfão apontando para canal
   terminal.**
6. **Conversas abertas** do canal morto migram junto, preservando o histórico de
   `messages` (que mantém o `channel_id` original de cada mensagem).

### 6.5 Opt-out

- Marca `opted_out_at`, exclusão permanente do roteamento, irreversível pela UI.
- **Detecção automática:** webhook de mensagem recebida; corpo casando
  `PARAR|SAIR|CANCELAR|DESCADASTRAR|REMOVER` (case e acento-insensível) → opt-out
  automático + auditoria + confirmação ao contato + conversa resolvida com
  `intent_class = OPT_OUT`.
- Esta é a **única** resposta automática permitida no sistema.

---

## 7. FASE 4 — Conteúdo

1. `contents`, `content_variants`, `media_assets`.
2. **`classification` obrigatória na criação.** Sem default.
3. Origens: `MANUAL` (mídia + legenda digitada) e `PDF` (documento + texto de
   acompanhamento). `source_url` opcional, apenas procedência.
4. Upload de mídia: **base64 em JSON** (Fastify — nunca `multer`/multipart, ver
   `CLAUDE.md`). Validar mime type e tamanho por tipo. Persistir no MinIO no ato.
5. **Variantes.** N variantes do mesmo conteúdo, para adequação de público. Toda variante
   é redigida ou revisada por humano — grave `created_by` e `reviewed_by`. Não existe
   geração automática.
6. `content_hash` = hash do corpo + variantes + referências de mídia. Base da invalidação
   de aprovação (§8.5).

### 7.4 Merge fields

Escopo v1: **`{{primeiro_nome}}` apenas.** Não implemente outros campos.

**Fallback é obrigatório na sintaxe:** `{{primeiro_nome|amigo}}`. Um merge field sem
fallback é erro de validação, não aviso.

Motivo: campo vazio produz "Olá , tudo bem?" — pior que não personalizar, porque parece
robô defeituoso e aumenta bloqueio. O fallback não é conveniência, é proteção de chip.

Requisitos:
- Validação na criação do conteúdo: todo merge field reconhecido e com fallback.
- Merge field desconhecido → erro, nunca passa cru para o envio.
- **Prévia renderiza amostra real** com 3 contatos do público-alvo, incluindo pelo menos
  um sem `first_name` para mostrar o fallback em ação.
- A prévia da distribuição reporta **quantos contatos cairão no fallback** (§9.3).
- A renderização final vai para `dispatches.rendered_body` no momento do planejamento.

---

## 8. FASE 5 — Aprovação

1. `approval_settings` por conta: 1 ou 2 aprovadores, configurável **separadamente**
   para `INSTITUTIONAL` e `ELECTORAL`.
2. `approvers` — nome, e-mail e/ou telefone. Aprovador **não precisa ter conta de usuário**.
3. **Notificação** por e-mail (Mailcow) e/ou WhatsApp, conforme `notify_channel`.
   - **Obrigatório:** sai por **canal de sistema** — SMTP próprio e instância Evolution
     dedicada da plataforma. **Nunca** por chip de tenant. Chip de campanha cai; canal de
     aprovação não pode cair com ele.
4. **O ato de aprovar acontece em página web com magic link assinado.** A mensagem só
   carrega o link.
   - Token de uso único, alta entropia, TTL configurável (default 72h).
   - Armazenado como **hash**; token em claro só no link.
   - Página exibe o conteúdo exato submetido (texto, variantes, mídias, amostra
     renderizada) e o `content_hash`.
   - Ao decidir: `decided_at`, `decided_ip`, `decided_user_agent`, `comment`.
   - Rota pública sem JWT — **com comentário documentando o motivo**, rate limit por IP
     e por token.

   > Motivo do desenho: aprovação registrada como texto de WhatsApp é a prova mais fraca
   > possível. O objetivo da trilha em conteúdo eleitoral é ser **defensável**. Magic link
   > dá IP, horário e o hash exato da versão aprovada, e o aprovador continua só tocando
   > num link no celular, sem criar conta.

5. **Invariantes:**
   - **Aprovador ≠ autor.** Bloqueie na aplicação.
   - **Edição de conteúdo `APPROVED` ou `PENDING_APPROVAL` invalida as aprovações:**
     `content_hash` muda → requests viram `INVALIDATED`, conteúdo volta a `DRAFT`.
   - `APPROVED` só quando o número necessário de aprovações for atingido.
   - Uma rejeição → `REJECTED`, com comentário visível ao autor.
   - Distribuição não pode ser planejada nem executada sobre conteúdo não `APPROVED`.

---

## 9. FASE 6 — Distribuição: planejamento

Serviço de domínio puro, testável sem infraestrutura.

### 9.1 Entrada e resolução

`content_id` (obrigatoriamente `APPROVED`), `target_filter` (contatos por tag/segmento),
`window_start`, `window_end`, `config`.

Expande o filtro em lista de contatos, excluindo `active = false` e
`opted_out_at IS NOT NULL`.

**Remetente:** `contacts.current_channel_id`. Sem escolha, sem fallback para outro canal.
Canal indisponível → `BLOCKED` / `SENDER_UNAVAILABLE`.

**Variante:** distribui as variantes entre os contatos. Se o operador definiu mapeamento
explícito (variante ↔ tag), o manual **prevalece** sobre o rateio automático.

**Renderização:** resolve merge fields e grava em `dispatches.rendered_body`.

### 9.2 Agendamento

Para cada canal, espalhe os envios atribuídos dentro da janela respeitando:

- intervalo mínimo entre envios do mesmo canal, com **jitter** aleatório
- máximo por hora e `current_quota` do dia (§2.1)
- `accounts.daily_send_ceiling` — **prevalece** sobre a soma dos canais
- **quiet hours** no timezone da conta
- nunca ultrapassar `window_end`

**Faixa de resposta:** o agendamento de campanha **não** consome a reserva destinada a
respostas da caixa de entrada. Resposta é prioritária, sem jitter e sem agendamento
(§10.4). Reserve um percentual de `current_quota` para ela.

**Se o plano não couber:** reporte o excedente na prévia com as opções (estender janela,
adicionar canal, reduzir público). **Nunca** trunque em silêncio, **nunca** estoure cota.

Persista `dispatches` como `PENDING` com `scheduled_at`. **O plano é dado, não memória.**
Só depois enfileire jobs BullMQ com delay.

### 9.3 Prévia — obrigatória antes de confirmar

- total de contatos
- distribuição por canal, com cota consumida resultante
- **estimativa de conclusão em dias** quando limitado por cota/rampa
- lista de `BLOCKED` **com motivo por item**
- variantes e onde cada uma cai
- **quantos contatos cairão no fallback de merge field**
- amostra renderizada real (3 exemplos)

---

## 10. FASE 7 — Despacho · FASE 8 — Caixa de entrada

### FASE 7 — Despacho

1. Worker BullMQ consome por `dispatch.id`. **Job id = dispatch id** (idempotência).
2. **Revalidação em tempo de execução** — nada é assumido do planejamento: conta não
   suspensa; conteúdo ainda `APPROVED`; canal `CONNECTED`; cota disponível; contato ativo
   e sem opt-out. Falha → não envia, marca estado com motivo.
3. Transição `PENDING → SENDING → SENT|FAILED` com
   `SELECT ... FOR UPDATE SKIP LOCKED` — impede dois workers pegarem o mesmo dispatch
   sem serializar a fila.
4. Envio via `WhatsAppGatewayPort`. Grava `evolution_message_id` e `sent_at`.
5. **Incremento de cota atômico:**
   ```sql
   INSERT INTO channel_daily_counters (account_id, channel_id, date, campaign_sends)
   VALUES (?, ?, ?, 1)
   ON CONFLICT (channel_id, date)
   DO UPDATE SET campaign_sends = channel_daily_counters.campaign_sends + 1
   RETURNING campaign_sends
   ```
   Uma ida ao banco, e o retorno serve para checar o teto na mesma operação.
   **Nunca** ler-somar-gravar.
6. **Retry com backoff exponencial**, distinguindo:
   - transitório (rede, 5xx, instância reconectando) → retry
   - permanente (JID inválido, número inexistente) → `FAILED` imediato, sem retry, e
     marca o contato para revisão
7. **Circuit breaker por canal:** N falhas consecutivas → `DEGRADED`, pausa a fila
   daquele canal, alerta. **Não** promove a `BANNED` — estado terminal é humano.
8. Controles de distribuição: `PAUSE`, `RESUME`, `CANCEL` (cancela pendentes, preserva
   enviados).

### FASE 8 — Caixa de entrada e fila de pendências

O inbound de **todos** os chips chega pelo webhook da Evolution e converge para uma fila
única. O admin não abre 10 celulares.

#### 10.1 Formato: fila de trabalho, não WhatsApp Web

O operador abre, vê "próximo pendente", responde, o item sai da lista. Formato de ticket.
Mais rápido para volume, porque não obriga ninguém a navegar procurando o que falta.

**Regra que faz ou quebra a fila: um item por conversa, nunca por mensagem.** Cinco
mensagens seguidas do mesmo contato são **um** pendente com as cinco dentro. Sem isso a
fila infla e o operador responde a mesma pessoa cinco vezes.

Cada item mostra o **histórico completo** da conversa — não dá para responder "sim, pode
ser" sem ver o que veio antes — mais qual chip recebeu e qual distribuição originou.

#### 10.2 Ingestão e classificação

1. Webhook de mensagem recebida → resolve o contato pelo telefone + canal → cria ou
   reabre `conversations`, insere em `messages`.
2. Mídia recebida: baixar e persistir no MinIO **no ato**. URLs da Evolution não são
   estáveis.
3. **Áudio é obrigatório na v1.** No Brasil boa parte do inbound vem por voz. A fila
   precisa reproduzir áudio inline. Transcrição fica fora do escopo v1.
4. **Classificação de intenção** por regra (não IA) na v1:
   - `OPT_OUT` → automação da §6.5, resolve sozinho
   - `ACKNOWLEDGMENT` → "ok", "obrigado", emoji isolado → classifica e arquiva **sem
     responder**
   - `WRONG_NUMBER` → marca o contato para revisão, tira do roteamento
   - `COMPLAINT` → padrões de hostilidade/reclamação → `priority = HIGH`, fila separada
   - `QUESTION` / `OTHER` → fila normal de atendimento

   Na prática a maioria do inbound de difusão cai nos três primeiros baldes. O que sobra
   para humano é uma fração — mas fração de número grande continua sendo número.

#### 10.3 Atendimento

1. **Travamento ao abrir:** `locked_by` + `locked_at`, liberação automática por TTL.
   Dois operadores respondendo o mesmo contato é pior que demora.
2. **Idade visível** em cada item, ordenação por prioridade e depois por idade. Item
   parado três dias é pior que não ter a caixa.
3. **Respostas rápidas** (`quick_replies`) — biblioteca de textos prontos que o operador
   insere e ajusta. Requisito, não conforto: é o que viabiliza volume.
4. Resolver, arquivar, reatribuir a outro operador.
5. Toda resposta enviada grava `messages` com `sent_by` e entra na auditoria.

#### 10.4 Envio da resposta

- Sai **sempre** pelo `channel_id` da conversa — o chip que o contato conhece. O operador
  não escolhe nem precisa saber qual é.
- **Faixa própria de cota** (`reply_sends`), prioritária, **sem jitter e sem
  agendamento**. Segurar resposta por horas para respeitar intervalo de disparo destrói o
  propósito.
- Contabiliza em `channel_daily_counters.reply_sends` e conta para o risco do canal, mas
  não compete com a fila de campanha.

> **Por que a caixa de entrada protege o chip.** Ignorar resposta é caro em risco, não só
> em imagem: `inbound_rate` (proporção fala/escuta) é um dos sinais do throttle
> adaptativo, e chip que só fala e nunca ouve é o perfil que cai. A caixa não é centro de
> custo — é proteção de ativo.

#### 10.5 Rascunho assistido por IA — limite firme

Se implementado (fora da v1, registrar como evolução): **IA rascunha, humano envia.**
Nunca resposta automática direta. Em conteúdo de mandato, um modelo inventando posição da
parlamentar ou prometendo algo em nome dela é dano que não se desfaz. Rascunho com
aprovação de um toque dá quase todo o ganho de velocidade sem esse risco.

---

## 11. FASE 9 — Auditoria · FASE 10 — Frontend · FASE 11 — Deploy

### FASE 9 — Auditoria, relatórios e saúde

1. Consulta de auditoria com filtro por ação, ator, entidade, período.
2. **Exportação CSV e PDF** de uma distribuição: `rendered_body` exato de cada envio,
   classificação, quem aprovou e quando, destinos, canais, horários, status por destino.
   É o artefato que responde a questionamento externo — requisito de produto, não
   relatório acessório.
3. Painel de saúde: envios/dia por canal, decisões do throttle com motivo,
   `delivery_rate`, `inbound_rate`, taxa de opt-out, falhas, idade média da fila de
   pendências, volume de inbound por dia.
4. Retenção: auditoria não expira por padrão (§12).

### FASE 10 — Frontend (Next.js 14 + MUI)

Siga as *Frontend Development Guidelines* do `CLAUDE.md`: componentes `export function`,
services em `src/services/{resource}Service.ts`, axios com interceptor JWT, HTML
semântico, MUI sem cor hardcoded, `react-hook-form` + `yup`, `notistack`.

Telas, na ordem:

1. Login / reset de senha
2. Dashboard — saúde dos canais, distribuições em andamento, fila de pendências, alertas
3. Canais — estado, QR de pareamento, cota corrente e histórico do throttle, aposentar
4. Contatos — lista, importação com mapeamento e relatório, carga por canal
5. Migração de remetente — seleção, estratégia, prévia, confirmação
6. Conteúdo — editor com merge fields, classificação, variantes, mídias, amostra
   renderizada, envio para aprovação
7. Aprovação — configuração, aprovadores, acompanhamento
8. Página pública de aprovação (magic link) — mobile-first, sem login
9. Distribuição — construtor de público, janela, prévia, confirmação, acompanhamento
10. **Caixa de entrada** — fila de pendências, item aberto com histórico, respostas
    rápidas, player de áudio, prioridade e idade
11. Auditoria e relatórios
12. Área de plataforma — contas, tetos, sinais de abuso, suspensão

### FASE 11 — Deploy (Dokploy / mdantas)

Siga o playbook do `CLAUDE.md` → *Deploy no Servidor mdantas*. Pontos que já custaram
tempo antes:

- **Docker Context Path = `/`** (raiz do monorepo)
- base **`node:22-alpine`**
- Backend: domínio com **Path `/api`**, **Strip Path OFF**
- Frontend: API base **relativa `/api`** (domínio único)
- DNS Cloudflare: A → `72.61.43.90`, **DNS only (nuvem cinza)**
- `REDIS_HOST` = **Internal Host** gerado pelo Dokploy, não o nome amigável
- Segredos só na aba **Environment**; `Save + Redeploy`
- Provedor **Git + Deploy Key** (não OAuth do GitLab)

Postgres self-hosted no mdantas: dimensione `max_connections` somando API + workers.

---

## 12. Variáveis de ambiente

```env
BATUTA_APP_NAME=Batuta
NODE_ENV=development
PORT=3010

DATABASE_URL=postgresql://user:pass@host:5432/batuta

REDIS_HOST=
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

APPROVAL_TOKEN_TTL_HOURS=72

EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_WEBHOOK_TOKEN=
EVOLUTION_SYSTEM_INSTANCE=

MINIO_ENDPOINT=
MINIO_PORT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_USE_SSL=true

SMTP_HOST=mail.mdantas.com.br
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

CORS_ORIGIN=http://localhost:3003
FRONTEND_URL=http://localhost:3003

ERROR_REPORTER_URL=
ERROR_REPORTER_API_KEY=
```

Toda env nova → atualizar `.env.example` **e** `env.validation.ts`.

---

## 13. Estratégia de testes

Além da cobertura padrão do `CLAUDE.md`, estes casos são **obrigatórios** e devem existir
como testes nomeados:

**Isolamento de tenant**
- conta A não lê/escreve/apaga entidade da conta B (um teste por repositório)
- DTO com `accountId` no body é rejeitado ou ignorado

**Alocação e remetente**
- canal novo com 0 contatos recebe todos os novos até empatar
- desempate determinístico com cargas iguais
- reimportação do mesmo telefone preserva o canal original
- despacho usa `current_channel_id`, jamais outro canal
- canal `DISCONNECTED` não habilita migração; `BANNED` habilita
- migração grava histórico, resolve dispatches pendentes e move conversas

**Merge fields**
- merge field sem fallback é erro de validação
- merge field desconhecido é erro, não passa cru
- contato sem `first_name` renderiza o fallback
- `rendered_body` persiste o texto final

**Cota, throttle e agendamento**
- plano nunca excede `current_quota` nem `daily_send_ceiling`
- quiet hours respeitado
- incremento de cota é atômico sob concorrência
- throttle: sinais limpos → `RAISE`; `delivery_rate` baixo → `LOWER`; falha grave → `PAUSE`
- recuo respeita `quota_floor`; avanço respeita `quota_ceiling`
- faixa de resposta não é consumida pelo agendamento de campanha
- plano que não cabe reporta excedente em vez de truncar

**Aprovação**
- autor não aprova o próprio conteúdo
- edição pós-aprovação invalida e volta a `DRAFT`
- token de uso único não funciona duas vezes; expirado → `EXPIRED`
- distribuição sobre conteúdo não `APPROVED` é rejeitada

**Despacho**
- reprocessar o mesmo job não gera envio duplicado
- dois workers não pegam o mesmo dispatch (`SKIP LOCKED`)
- falha permanente não faz retry
- N falhas consecutivas → `DEGRADED` e fila pausada
- conta `SUSPENDED` → worker recusa

**Caixa de entrada**
- cinco mensagens do mesmo contato geram **um** pendente
- opt-out por palavra-chave resolve sozinho, sem entrar na fila humana
- travamento impede dois operadores no mesmo item; TTL libera
- resposta sai pelo canal da conversa, nunca por outro
- resposta não consome cota de campanha

---

## 14. Decisões pendentes

Não invente valor. Quando a fase chegar, **pare e pergunte**. Se um default for
imprescindível para prosseguir, use o sugerido, marque com `// DECISÃO PENDENTE` e
reporte na entrega da fase.

| # | Decisão | Fase | Sugestão provisória |
|---|---|---|---|
| 1 | `quota_floor` / `quota_ceiling` default por canal | 2 | piso 20/dia · teto 150/dia |
| 2 | Limiares do throttle (`delivery_rate`, `opt_out_rate`, falha grave) | 2 | — |
| 3 | Fatores de avanço e recuo + janela de avaliação | 2 | +20% / −50%, janela 3 dias |
| 4 | Percentual de cota reservado para respostas | 6 | 20% |
| 5 | Intervalo mínimo entre envios do mesmo canal + jitter | 6 | 45–120s aleatório |
| 6 | Quiet hours default | 6 | 08:00–21:00, timezone da conta |
| 7 | ~~Evolution: servidor compartilhado ou por tenant~~ | 2 | **RESOLVIDO — ver nota abaixo** |
| 8 | Planos comerciais e tetos por plano | 1 | — |
| 9 | Retenção de `audit_logs` e de `messages` | 9 | auditoria sem expiração |
| 10 | Limiares dos sinais de abuso por conta | 1 | — |
| 11 | Aprovador pode ser também usuário da conta | 5 | sim, mas nunca autor |
| 12 | TTL do travamento de conversa | 8 | 15 min |
| 13 | Grupos de WhatsApp voltam ao escopo? | — | **fora da v1; aditivo se voltar** |

> **Decisão 7 — RESOLVIDA: servidor compartilhado agora, isolável por configuração.**
>
> Em Evolution, cada chip já é uma *instância*; a questão era o **servidor**. Decisão:
> um servidor da plataforma atende todos os tenants na v1, mas o adapter resolve o
> destino por conta (`accounts.evolution_server_url`), então mover um tenant pesado ou
> arriscado para servidor dedicado é **atualizar uma linha**, sem refatoração.
>
> Razão do desenho: o Baileys mantém a sessão em memória por conexão. Um servidor com
> muitas sessões que reinicia mal pode exigir **repareamento por QR, chip por chip, com o
> celular físico** — evento de suporte catastrófico. Servidor dedicado por tenant desde já
> contém esse raio de explosão, mas custa operação demais para validar produto. O
> resolvedor por conta compra as duas coisas.
>
> **Gatilhos para migrar um tenant a servidor dedicado** (monitorar, não automatizar):
> contagem de chips do tenant desproporcional ao resto; sinais de abuso recorrentes;
> exigência contratual de isolamento.

---

## 15. Riscos assumidos e registrados

Premissas do produto, não bugs a corrigir depois.

1. **A Evolution API não é oficial.** Operar assim viola os Termos do WhatsApp e **os
   números serão banidos** — a variável é o custo de reposição, não se vai acontecer. O
   sistema é desenhado para tornar isso administrável (estados terminais, migração
   assistida, throttle adaptativo), não para evitar.
2. **Sem grupos, o 1:1 é o único modo — e é o de maior risco de ban.** Em grupo o membro
   entrou por vontade própria; numa lista importada, não. Contato frio derruba chip mais
   rápido. O throttle adaptativo é a principal mitigação e não é opcional.
3. **Teto de alcance é cota.** 10 chips a 150/dia sustentado são ~1.500 envios/dia. Uma
   base de 10.000 contatos leva ~7 dias para ser coberta. Planeje campanha em dias, não
   em horas.
4. **Não existe limite oficial documentado** para uso não oficial. Os números deste
   documento são teto de engenharia conservador, não limite do WhatsApp. Meça na primeira
   campanha e calibre.
5. **Inbound gera trabalho humano.** Uma fração pequena de resposta sobre base grande já
   são centenas de conversas. Item leva perto de um minuto entre ler contexto e escrever;
   uma pessoa sustenta algo como 300–400/dia, menos com muito áudio. É decisão de equipe,
   não de arquitetura. Meça na primeira campanha em vez de confiar nesta estimativa.
6. **Conteúdo eleitoral tem regra própria no Brasil.** Este documento não é parecer
   jurídico. A classificação obrigatória, a dupla aprovação e a trilha exportável existem
   para que a operação seja **defensável e auditável** — não para atestar conformidade.
   O enquadramento é de advogado eleitoral.
7. **Self-service aumenta o risco de plataforma.** Tenant abusivo usa a infraestrutura
   como gateway de spam. Por isso teto por conta, sinais de abuso e suspensão são
   requisito da Fase 1.

---

## 16. Checklist de fim de fase

- [ ] `lint`, `typecheck` e testes passando **rodados no app**, nomeando o workspace:
      `npm run lint -w apps/batuta-system/backend` ·
      `npm run typecheck -w apps/batuta-system/backend` ·
      `npm run test -w apps/batuta-system/backend` (idem `.../frontend`).
      A raiz **não** compila os apps: `tsconfig.base.json` só carrega opções herdadas e os
      agregadores da raiz delegam (`npm run typecheck --workspaces --if-present`). "Typecheck
      passando" sem nomear o workspace é afirmação ambígua — não vale como item cumprido.
- [ ] Migration criada e aplicada; nenhum DDL manual
- [ ] Todo endpoint novo com guard adequado, ou comentário justificando ausência
- [ ] Todo campo de DTO com `class-validator`
- [ ] `ResponseDto` em todas as respostas; nenhum domain entity ou ORM entity via HTTP
- [ ] Nenhum secret hardcoded; envs novas em `.env.example` + `env.validation.ts`
- [ ] Teste de isolamento cross-tenant para cada repositório novo
- [ ] Ações relevantes gravando `audit_logs`
- [ ] Nenhum log com telefone completo, token, senha ou corpo de mensagem
- [ ] Decisões pendentes tocadas na fase foram reportadas, não inventadas
- [ ] Relatório do que foi feito + o que ficou de fora, aguardando aprovação
