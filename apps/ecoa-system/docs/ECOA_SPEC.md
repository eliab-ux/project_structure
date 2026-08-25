# ECOA — Especificação para o Claude Code

> **Sistema:** Ecoa — **SaaS multi-inquilino (multi-tenant)** para acompanhar quando outras
> contas do Instagram republicam o conteúdo de cada usuário (**Opção A**: cada usuário conecta
> a própria conta). Vários usuários usam o mesmo sistema, com dados **totalmente segregados** por conta.
> **Nome de trabalho** — pode renomear livremente (afeta só a pasta `apps/ecoa-system/`
> e o `APP_NAME`).
>
> **Login:** identidade **própria** (e-mail + senha, JWT próprio — padrão `CLAUDE.md`). O
> Instagram é uma **conexão vinculada** dentro da conta, nunca o meio de login. "Quem você é no
> Ecoa" é independente de "qual Instagram você monitora": revogar o Instagram derruba a captura
> de dados, mas nunca tranca o usuário para fora do próprio histórico.
>
> Este documento é a **fonte de verdade** desta feature. O `CLAUDE.md` do GitSpread
> prevalece em qualquer conflito transversal (Security by Design, auth JWT própria,
> hexagonal, frontend Next.js). Aqui defino **o que** construir e **como** dentro daquelas regras.

---

## ⚠️ LEIA ANTES DE CODIFICAR — Pré-requisitos e verificação obrigatória

**1. Detalhes da Graph API podem estar desatualizados neste documento.** A Meta muda
escopos, campos de webhook e regras de App Review com frequência. **Antes de escrever
qualquer chamada à API do Instagram, confirme na documentação oficial vigente da Meta:**

- Nomes exatos dos **escopos de permissão** (prováveis, a confirmar):
  `instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
  `pages_read_engagement`, `business_management`, e o campo de webhook `mentions`.
- Se o fluxo **"compartilhar no story pelo aviãozinho com o @ preservado"** dispara o
  **webhook de `mentions`** (é o sinal em que a Opção A se apoia), e com qual latência.
- Se a nova função de **"repost" nativo do feed** expõe *quem* repostou via API.
- Requisitos de **App Review** para que `mentions`/insights funcionem fora das contas de teste.

Se algum desses pontos não bater com a doc atual, **pare e sinalize** — não invente nome de
endpoint. Se o Eliab autorizar busca na web, confirme antes de fixar.

> ## 🔴 CONFERIDO EM 10/08/2026 — E NÃO BATEU
> A verificação acima foi feita e **derrubou a premissa central da Opção A**:
>
> **A Meta não suporta menções em Stories na Instagram Graph API.** A doc oficial diz, com
> essas palavras: *"Mentions on Stories are not supported."* O campo de webhook `mentions`
> notifica quando alguém te @menciona em **comentário ou legenda** de uma mídia que não é sua;
> o edge `/tags` devolve mídias em que a conta foi **marcada**. Nenhum dos dois cobre o
> "aviãozinho com o @ preservado".
>
> Consequências diretas nesta spec:
> - O que o Ecoa **consegue** detectar: repost de **feed** com o `@` na legenda, e marcações.
> - O que **não** consegue com o desenho atual: reshare de **story**.
> - `DetectionType.STORY_MENTION` está mal nomeado — o campo `mentions` não é story mention.
> - Story mention existe, mas por **outro produto**: a Instagram **Messaging** API
>   (webhook `story_mention`, permissão `instagram_manage_messages`), com trilha de App Review
>   própria e mais rígida.
>
> Fonte: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/mentions/
>
> **Decisão de 10/08/2026 — o produto foi redefinido para o que a API entrega.**
> O Detections passa a cobrir três sinais, e só: menção na **legenda** de um post alheio,
> menção em **comentário**, e **marcação**. `DetectionType` agora é
> `caption_mention | comment_mention | tag`, o escopo do OAuth ganhou
> `instagram_manage_comments`, e a UI declara nos dois idiomas que story reshare é invisível.
>
> **Nada abaixo nesta spec foi reescrito.** Trate as seções sobre detecção de story como
> *histórico*, não como especificação válida. A fonte da verdade do que é detectável hoje é
> `DetectionType` no domínio + `docs/APP_REVIEW.md`.

> ## ⚠️ Campanhas foram REMOVIDAS do produto (10/08/2026)
> A tela e o contexto `campaign` saíram do sistema (backend, frontend, schema e rotas), a
> pedido do Eliab: não eram usadas e só ampliavam a superfície do app no App Review.
> As menções a campanha adiante nesta spec são **históricas** — não implemente.
> SQL de remoção: `deploy/sql/02_drop_campaign.sql`.

**2. Pré-requisitos de conta (o usuário precisa ter):**
- Conta Instagram **Business** ou **Creator** (conta pessoal **não** acessa insights/webhooks).
- A conta vinculada a uma **Página do Facebook**.
- Um **app na Meta for Developers** com as permissões acima (e App Review aprovado para uso real).
- Um **endpoint HTTPS público** para receber os webhooks.

---

## 1. Escopo (o que o sistema faz — e o que NÃO faz)

### Faz
- **Cada usuário** cria sua conta no Ecoa (login local) e conecta **a própria conta** do Instagram
  (OAuth), com o token renovado automaticamente.
- Cada usuário cadastra a **própria lista de perfis** para acompanhar (`@anamaria`, `@josepereira`…).
- **Detecta republicações do conteúdo do usuário** quando o `@` dele é preservado — via webhook de
  menções/reshare de story (tempo quase real) + verificação periódica de segurança.
- **Destaca** as detecções que vieram de perfis da lista daquele usuário.
- Guarda **métricas do próprio post de cada usuário ao longo do tempo**: alcance, impressões,
  curtidas, comentários, salvamentos e o **contador de compartilhamentos** que o Instagram fornece.
- Mostra tudo num **dashboard por usuário**, com dados totalmente segregados por conta.

### NÃO faz (limitações reais da plataforma — deixe explícito na UI)
- **Não vê o alcance da republicação de outra pessoa.** Alcance é privado da conta dela; a
  API oficial só entrega insights da conta que autorizou o app (que é a minha). Isso é da Opção B.
- **Não detecta compartilhamento "escondido":** reshare sem o meu `@`, print re-upado sem
  citação, ou envio por DM — não geram sinal e são invisíveis.
- **Não rastreia a cascata** (quem republicou depois de quem) — depende de consentimento (Opção B).
- **Não faz scraping** — proibido (viola os ToS, frágil, some a cada mudança de layout).

---

## 2. Stack

Segue o padrão GitSpread. **NestJS** (não Python): é CRUD de negócio + integração REST +
agendamento + dashboard — nenhum ETL numérico pesado que justifique Python.

| Camada | Tecnologia |
|---|---|
| Backend | NestJS 10 + Fastify + MikroORM 6 |
| Banco | **PostgreSQL via Supabase** (driver `@mikro-orm/postgresql`) |
| Fila/agendamento | **Redis + BullMQ** (`@nestjs/bullmq`) — jobs "de tempos em tempos" |
| Auth (app) | JWT próprio (padrão `CLAUDE.md`) — login do dono do dashboard |
| HTTP externo | `axios` para a Graph API |
| Frontend | Next.js 14 (App Router) + Material-UI (padrão `CLAUDE.md`) |
| Cripto de token | `crypto` nativo (AES-256-GCM) com chave em `.env` |

---

## 3. Banco de Dados — PostgreSQL via Supabase

- Conexão via `DATABASE_URL` (connection string do Postgres do Supabase, formato
  `postgresql://postgres:[SENHA]@db.<ref>.supabase.co:5432/postgres`), driver `@mikro-orm/postgresql`.
- **Atenção ao pooler:** se usar o pooler do Supabase em modo *transaction* (porta **6543**),
  **desabilite prepared statements** no driver para evitar erro de cache de statement. Conexão
  direta na porta **5432** não tem esse problema. Configurar `pool` com pre-ping/recycle adequados.
- A **connection string** (para o MikroORM) e as **chaves da API do Supabase** (`sb_secret_...`,
  `sb_publishable_...`) são coisas **diferentes**: o backend acessa as tabelas pelo Postgres
  (connection string), não pelas chaves de API. A `sb_secret` só entra se o Ecoa usar a API/Storage
  do Supabase (ex.: guardar thumbnail de mídia num bucket).
- Migrations versionadas (MikroORM) **ou** SQL idempotente em `deploy/sql/NN_descricao.sql`.
  Nunca alterar schema em produção sem artefato versionado. Nunca `schema:fresh` fora de dev.
- **Tokens do Instagram criptografados em repouso** (AES-256-GCM) — nunca em texto puro.

---

## 4. Arquitetura — Hexagonal (Ports & Adapters)

Regra de dependência: **Infrastructure → Application → Domain**. Domínio puro (sem NestJS/MikroORM).

### Bounded contexts (`src/contexts/`)

| Contexto | Responsabilidade |
|---|---|
| `auth` | Login próprio (e-mail + senha, `bcryptjs`), emissão/refresh de JWT, reset de senha. |
| `user` | Cadastro/perfil do usuário do Ecoa; é o **tenant** (dono de todos os dados). |
| `connection` | Conexão OAuth do IG **do tenant**; ciclo de vida e renovação do token. |
| `watchlist` | Lista de `@handles` do tenant; resolução handle → `ig_user_id`. |
| `content` | Mídias publicadas do tenant, sincronizadas do IG (alvo potencial de repost). |
| `detection` | Registro de repostagem/menção detectada do tenant (o coração do "repostagem"). |
| `insight` | Snapshots de métricas das mídias do tenant ao longo do tempo. |

Ingestão de webhook e clientes da Graph API ficam em `infrastructure/`, não são contexto.

---

## 4.1 Modelo Multi-Tenant (SaaS) — isolamento obrigatório

Vários usuários compartilham a mesma aplicação e o mesmo banco, mas **nunca** enxergam os dados
uns dos outros. O `user` é o **tenant**. Regras inegociáveis (é o mesmo princípio "revendedor só
vê os próprios dados" do `CLAUDE.md`, aplicado a tudo):

- **Toda tabela de negócio tem `owner_id`** (fk → `user`). Sem exceção.
- **Toda query filtra pelo `sub` do JWT autenticado** — nunca por um id vindo do body/query do
  cliente. O `owner_id` do request é **sempre** o do token, ignorando qualquer valor enviado.
- Os repositórios recebem o `ownerId` como parâmetro obrigatório nos métodos de leitura/escrita;
  um use case **jamais** consulta sem escopo de tenant. Considerar um helper/base que injeta o filtro.
- **Índice composto `(owner_id, ...)`** nas tabelas mais consultadas (`detection`, `own_media`,
  `media_insight_snapshot`) para performance com muitos tenants.
- **Isolamento no webhook (ponto crítico):** a Meta envia eventos de **todos** os tenants para um
  **único** endpoint. O processador resolve o tenant assim: `payload.ig_user_id` →
  `instagram_connection.ig_user_id` → `owner_id`. Só então cria a `detection` para o dono certo.
  Evento cujo `ig_user_id` não casa com nenhuma conexão é **descartado** (logado, não processado).
- **Um mesmo Instagram não pode ser conectado por dois tenants.** `instagram_connection.ig_user_id`
  é **unique global**; a segunda tentativa é rejeitada com mensagem clara.
- (Opcional, defesa extra) Se as tabelas ficarem acessíveis via API do Supabase, habilitar **RLS**
  por `owner_id`. Como o acesso é via MikroORM/connection string com service role, o RLS não é a
  barreira principal — **a barreira é o filtro por tenant no use case** —, mas RLS é uma segunda camada.

---

## 5. Modelo de Dados (tabelas PostgreSQL / Supabase)

> ORM entities com sufixo `-orm.entity.ts`; domain entity separada + mapper (padrão `CLAUDE.md`).
> **Toda tabela de negócio abaixo tem `owner_id` (fk → `user`)** — o isolamento de tenant.

**`user`** (o tenant — identidade própria)
- `id` (uuid, pk) · `email` (unique) · `password_hash` · `name` ·
  `role` (`user` | `admin`) · `active` (bool) · `created_at`
- Nunca expor `password_hash` em Response DTO.

**`instagram_connection`**
- `id` (uuid, pk) · `owner_id` (fk → user) · `ig_user_id` (**unique global**) · `username` ·
  `access_token_encrypted` · `token_expires_at` ·
  `status` (`connected` | `expired` | `revoked`) · `connected_at`

**`watched_account`**
- `id` (uuid, pk) · `owner_id` (fk → user) · `handle` (ex.: `anamaria`, sem `@`) ·
  `ig_user_id` (nullable, resolvido depois) · `active` (bool) · `added_at`
- Unicidade por tenant: `(owner_id, handle)` unique.

**`own_media`**
- `id` (uuid, pk) · `owner_id` (fk → user) · `ig_media_id` · `permalink` · `media_type` ·
  `caption` (text) · `thumbnail_url` · `published_at` ·
  `campaign_id` (fk → campaign, nullable — rótulo de campanha atribuído pelo tenant)
- Unicidade por tenant: `(owner_id, ig_media_id)` unique. Índice `(owner_id, published_at)`.

**`campaign`** (agrupamento para a visão de gestão de campanha)
- `id` (uuid, pk) · `owner_id` (fk → user) · `name` · `color` (nullable, cor de destaque na UI) ·
  `starts_at` (nullable) · `ends_at` (nullable) · `created_at`
- Um post pode pertencer a uma campanha; a campanha agrega alcance/compartilhamentos/
  republicações dos seus posts no período.

**`detection`**
- `id` (uuid, pk) · `owner_id` (fk → user) · `own_media_id` (fk → own_media, nullable) ·
  `watched_account_id` (fk → watched_account, nullable — preenchido se bater com a lista) ·
  `source_username` · `detection_type` (`story_mention` | `tag` | `mention`) ·
  `detected_at` · `permalink` (nullable) · `seen` (bool, default false)
- Índice `(owner_id, detected_at)`.

**`media_insight_snapshot`**
- `id` (uuid, pk) · `owner_id` (fk → user) · `own_media_id` (fk) · `captured_at` ·
  `reach` · `impressions` · `likes` · `comments` · `saved` · `shares_count`
- Uma linha por captura → série temporal por post. Índice `(owner_id, own_media_id, captured_at)`.

**`webhook_event`** (dedup/auditoria — infra, resolve o tenant no processamento)
- `id` (uuid, pk) · `external_id` (unique — evita reprocessar redelivery da Meta) ·
  `resolved_owner_id` (fk → user, nullable — preenchido ao resolver o tenant; null = descartado) ·
  `payload_hash` · `received_at` · `processed` (bool)

---

## 6. Jobs agendados (BullMQ) — o "de tempos em tempos"

| Job | Frequência (sugerida) | O que faz |
|---|---|---|
| `refresh-token` | 1x/dia | **Para cada conexão de cada tenant**, renova o long-lived token antes de expirar; marca `expired` se falhar. |
| `sync-own-media` | a cada 1–2h | **Por tenant conectado**, puxa mídias recentes → upsert em `own_media` (com `owner_id`). |
| `capture-insights` | a cada 3–6h | **Por tenant**, para cada `own_media` recente, grava um `media_insight_snapshot`. |
| `resolve-watchlist` | a cada 6h | **Por tenant**, resolve `handle` → `ig_user_id` das contas ainda não resolvidas. |
| `reconcile-mentions` | a cada 6h | **Por tenant**, rede de segurança: relê o edge de menções caso um webhook tenha se perdido. |

Padrão de fan-out: um job "agendador" varre os tenants com conexão ativa e **enfileira um job
filho por tenant** (cada filho carrega o `ownerId`), em vez de um job monolítico. Isola falhas
(um tenant com token inválido não afeta os outros) e distribui a carga. Todo job é **idempotente**
e à prova de falha. Respeitar **rate limits da Graph API por conta** — espaçar/limitar concorrência.

---

## 7. Webhook de ingestão

- **Endpoint público** `POST /api/webhooks/instagram` + `GET` para o handshake de verificação.
  Público **por necessidade** (a Meta chama sem JWT) — documentar a exceção no código.
- Segurança: validar `hub.verify_token` no GET e a assinatura **`X-Hub-Signature-256`** no POST
  (HMAC com o app secret). Rejeitar payload sem assinatura válida.
- Fluxo: verifica assinatura → grava `webhook_event` (dedup por `external_id`) → enfileira job de
  processamento → responde `200` rápido. O processamento **resolve o tenant** (`payload.ig_user_id`
  → `instagram_connection` → `owner_id`), cria a `detection` **com aquele `owner_id`** e, se
  `source_username` bater com um `watched_account` **do mesmo tenant**, associa e marca como destacada.
  Evento sem tenant correspondente é descartado (log, `resolved_owner_id` = null).

---

## 8. Endpoints da API (protegidos por `JwtAuthGuard`, salvo o webhook)

```
# Autenticação (própria — login local) — PÚBLICOS
POST   /api/auth/register             → cria conta { name, email, password }
POST   /api/auth/login                → { email, password } → access + refresh token
POST   /api/auth/refresh              → troca refresh por novo access token
GET    /api/auth/me                   → usuário autenticado (do token)
POST   /api/auth/request-password-reset
POST   /api/auth/reset-password

# Conexão do Instagram do tenant autenticado
GET    /api/connection                → status da conexão do tenant
GET    /api/connection/oauth-url      → gera URL de autorização da Meta
POST   /api/connection/callback       → troca o code por token (criptografa, salva com owner_id)
DELETE /api/connection                → revoga/desconecta

# Lista de acompanhamento (escopo do tenant)
GET    /api/watchlist                 → lista contas acompanhadas do tenant
POST   /api/watchlist                 → adiciona { handle }
DELETE /api/watchlist/:id             → remove (valida que o registro é do tenant)

# Minhas mídias e métricas (escopo do tenant)
GET    /api/media                     → mídias do tenant (paginado)
GET    /api/media/:id/insights        → série temporal de snapshots do post
PATCH  /api/media/:id/campaign        → atribui/remove a campanha do post

# Campanhas (gestão de campanha)
GET    /api/campaigns                 → lista campanhas
POST   /api/campaigns                 → cria { name, color?, startsAt?, endsAt? }
GET    /api/campaigns/:id/summary      → alcance/compartilhamentos/republicações agregados
DELETE /api/campaigns/:id             → remove (posts ficam sem campanha)

# Detecções (repostagens)
GET    /api/detections                → feed paginado (filtros: watchlistOnly, período, seen)
PATCH  /api/detections/:id/seen       → marca como visto
GET    /api/detections/summary        → cards do dashboard (total, últimos 7/30 dias, por conta)

# Webhook (público, verificado por assinatura)
GET    /api/webhooks/instagram        → handshake
POST   /api/webhooks/instagram        → recebe eventos
```

Todo request DTO com `class-validator`; toda resposta com Response DTO (`static fromDomain()`);
nunca expor domain/ORM entity nem `access_token`.

---

## 9. Frontend (Next.js 14 + MUI) — porta 3003

Telas:
- **Login / Registro** — autenticação própria; fluxo de "esqueci a senha". Rotas do dashboard
  protegidas (redireciona pro login sem token válido).
- **Conexão** — status ("conectado como @…"), botão conectar/desconectar, aviso se token expirou.
  Deixar claro que conectar o Instagram é um passo **separado** de estar logado no Ecoa.
- **Lista** — adicionar/remover `@handles`; indicar quais foram resolvidos.
- **Feed de detecções** — cartões cronológicos ("@anamaria compartilhou seu post • há 2h"),
  filtro "só da minha lista", marcar como visto, link pro post.
- **Post em detalhe** — gráfico de evolução (alcance, compartilhamentos, curtidas ao longo do tempo).
- **Resumo/Home** — cards: republicações no período, contas que mais repostam, posts mais repostados.

Padrões do `CLAUDE.md`: `src/services/api.ts` com interceptor JWT; serviços por recurso;
notistack para feedback; MUI + theme (sem cor hardcoded); HTML semântico.

**Deixar visível na UI a limitação da Opção A:** um aviso discreto explicando que só aparecem
os compartilhamentos que preservam o `@`, e que alcance de terceiros não é acessível.

### Direção de design — cockpit de gestão de marketing / campanha

O layout **não** deve parecer um simples CRUD ou uma listagem administrativa. A referência
mental é um **painel de performance de marketing / gestão de campanha** — do tipo que uma
equipe de social media abre todo dia para acompanhar resultado. Diretrizes:

- **Layout de dashboard analítico**: `AppBar` + `Drawer` lateral de navegação; área principal
  com uma **faixa de KPIs no topo** (cards grandes com número + variação vs. período anterior,
  ex.: "Republicações — 34 ▲ +18% vs. 7 dias"), seguida de gráficos e do feed.
- **Orientado a período**: seletor global de intervalo (7 / 30 / 90 dias / custom) que recalcula
  toda a tela. Marketing pensa em janela de tempo, não em registro isolado.
- **Visão de campanha (agrupamento)**: permitir agrupar posts/detecções por **campanha** (um
  rótulo/tag que eu atribuo aos meus posts), com um painel por campanha comparando alcance,
  compartilhamentos e republicações entre elas. É o diferencial de "gestão de campanha".
- **Ranking e comparação**: "top contas que mais repostam", "posts que mais repercutiram",
  ranqueados visualmente (barras/pódio), não só tabela.
- **Gráficos de série temporal** (linha/área) para evolução de alcance e compartilhamentos —
  usar a lib de charts que o `frontend-design` do GitSpread indicar (ou Recharts/Chart.js),
  sempre com cores vindas do `theme.palette`.
- **Tom visual**: clean, moderno, "data-driven" — bastante respiro (whitespace), tipografia
  clara com hierarquia forte, uso de cor com intenção (verde/vermelho para variação positiva/
  negativa, cor de destaque para as detecções da minha lista). Densidade de informação alta,
  mas legível — dashboard de quem monitora resultado, não tela de cadastro.
- **Estados vazios com propósito**: quando ainda não há detecção, mostrar um empty state que
  orienta ("Conecte sua conta e adicione perfis para começar a monitorar"), não uma tela em branco.
- Consultar o **skill `frontend-design`** do ambiente ao construir as telas, para tokens de
  design, tipografia e evitar aparência de template genérico.

---

## 10. Segurança (Security by Design — obrigatório)

- Dashboard atrás de **JWT próprio** (login local). Webhook é a única rota pública, verificada por assinatura.
- **Isolamento de tenant é regra de segurança, não só de modelagem:** todo use case escopa por
  `owner_id` = `sub` do token; nunca confiar em id de dono vindo do cliente. Um usuário jamais
  acessa conexão, mídia, detecção ou campanha de outro — testar isso explicitamente (usuário A
  não enxerga dados do usuário B = 404/403, nunca vazamento).
- **Access token do Instagram criptografado** (AES-256-GCM); chave só em `.env`; nunca logar token.
- `GlobalExceptionFilter`: cliente recebe mensagem genérica; stack só no log.
- **Port `ERROR_REPORTER`** (fire-and-forget, no-op por padrão) já plugado no filter — preparação
  para o Guard, conforme `CLAUDE.md`.
- Nenhuma resposta HTTP inclui `access_token`, `password_hash`, assinatura de webhook ou payload cru sensível.
- Chamadas à Graph API sempre server-side; o token nunca chega ao browser.

---

## 11. Variáveis de ambiente (adicionar ao `.env.example`)

```env
APP_NAME=Ecoa
NODE_ENV=development
PORT=3001

# Banco (PostgreSQL via Supabase) — usado pelo MikroORM
# Direta (5432) ou pooler transaction (6543 — se usar, desabilitar prepared statements)
DATABASE_URL=postgresql://postgres:[SUA_SENHA]@db.jlroiomaceuopbocwhpa.supabase.co:5432/postgres

# Supabase API/Storage (server-side apenas) — só se usar buckets/Storage
SUPABASE_URL=https://jlroiomaceuopbocwhpa.supabase.co
SUPABASE_SECRET_KEY=       # sb_secret_... — secret; NUNCA no frontend, NUNCA commitar

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth do dashboard (JWT próprio)
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Meta / Instagram Graph API (confirmar nomes na doc vigente da Meta)
META_APP_ID=
META_APP_SECRET=
META_OAUTH_REDIRECT_URI=https://SEU_DOMINIO/api/connection/callback
META_WEBHOOK_VERIFY_TOKEN=
META_GRAPH_API_VERSION=

# Criptografia do token do Instagram (chave de 32 bytes em hex/base64)
IG_TOKEN_ENCRYPTION_KEY=

# CORS
CORS_ORIGIN=http://localhost:3003

# Error reporter (vazio = no-op)
ERROR_REPORTER_URL=
ERROR_REPORTER_API_KEY=
```

---

## 12. Ordem de implementação (respeitando a regra de dependência)

1. **Scaffold** `apps/ecoa-system/{backend,frontend}` no padrão do monorepo; MikroORM com driver
   `@mikro-orm/postgresql` apontando para o Supabase (atenção ao pooler transaction/6543).
2. **Auth própria + tenant**: contextos `auth` e `user` (registro, login, refresh, reset), JWT do
   `CLAUDE.md`, e o **padrão de escopo por `owner_id`** (helper/base que injeta o filtro em toda
   query). Isolamento de tenant validado por teste **antes** de seguir.
3. Contexto **`connection`**: OAuth, criptografia e persistência do token (com `owner_id`),
   `ig_user_id` unique global, job `refresh-token` com fan-out por tenant.
4. Contexto **`content`** + job `sync-own-media` (por tenant).
5. Contexto **`insight`** + job `capture-insights` (série temporal, por tenant).
6. Contexto **`watchlist`** + job `resolve-watchlist` (por tenant).
7. **Webhook** de menções + verificação de assinatura + dedup + **resolução de tenant** + processamento → `detection`.
8. Contexto **`detection`** (associação com watchlist, endpoints, `summary`) + `campaign` + job `reconcile-mentions`.
9. **Frontend**: login/registro → conexão → lista → feed → detalhe do post → resumo (cockpit).
10. `GlobalExceptionFilter` + port `ERROR_REPORTER` + hardening final.

Após cada contexto: rodar `lint`, `typecheck`, `test`. Domínio e use cases com teste unitário
(alvo > 80%). Auth sempre testada (rota protegida sem token = 401) **e isolamento de tenant testado**
(usuário A não acessa dado de B).

---

## 13. Checklist de aceite

- [ ] Crio conta e faço login local (JWT próprio); rotas do dashboard exigem token.
- [ ] Conecto minha conta IG (passo separado do login) e o token renova sozinho sem re-login.
- [ ] Cadastro/removo `@handles` na minha lista.
- [ ] Recebo detecção quando alguém compartilha meu post preservando meu `@` (webhook).
- [ ] Detecções de contas da lista aparecem **destacadas**.
- [ ] Vejo a evolução de alcance/compartilhamentos de cada post no tempo (gráfico).
- [ ] **Isolamento: o usuário A não vê nenhum dado do usuário B** (testado).
- [ ] **O webhook roteia o evento para o tenant certo** pelo `ig_user_id`; evento órfão é descartado.
- [ ] Um mesmo Instagram não pode ser conectado por dois tenants.
- [ ] Nenhum `access_token` nem `password_hash` aparece em resposta HTTP ou log.
- [ ] Webhook rejeita payload sem assinatura válida.
- [ ] A UI comunica claramente as limitações da Opção A.
- [ ] `lint`, `typecheck` e `test` passam; migrations versionadas.

---

## 14. Definições de pronto que dependem da Meta (não bloquear o resto)

Estes itens só ficam **plenamente funcionais** após App Review aprovado e conta Business
vinculada. Enquanto isso, desenvolver contra a conta de teste do app e deixar os pontos de
integração isolados atrás dos ports, para que a troca não exija refatoração:

- Webhook de `mentions` em produção (fora do sandbox).
- Escopos de insights liberados para uso real.
