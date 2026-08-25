# Ecoa — SaaS multi-tenant de monitoramento de reposts no Instagram

Backend **NestJS + Fastify + MikroORM (PostgreSQL/Supabase)** + frontend **Next.js 14 + MUI**.
Cada usuário conecta a própria conta do Instagram e acompanha quem republica seu conteúdo
(quando o `@` é preservado). Arquitetura hexagonal, isolamento por tenant (`owner_id`).

> Fonte de verdade da feature: [`../ecoa/Requisito/ECOA_SPEC.md`](../ecoa/Requisito/ECOA_SPEC.md).
> Regras transversais: `CLAUDE.md` na raiz.

---

## Pré-requisitos

- **Node 20+** e **npm 10+** (o repo é um monorepo npm workspaces).
- **Docker** (para subir o Redis do BullMQ localmente).
- **Postgres do Supabase** acessível (a `DATABASE_URL` já vem no `backend/.env`).
- Para conectar o Instagram de verdade: um app na Meta configurado — ver
  [`docs/CONFIGURACAO_META_INSTAGRAM.md`](docs/CONFIGURACAO_META_INSTAGRAM.md).

> O `backend/.env` contém segredos reais (banco, JWT, Meta, SMTP) e **está no `.gitignore`** —
> nunca commite. Ao publicar, rotacione qualquer segredo que tenha circulado.

---

## 1. Instalar dependências (na raiz do monorepo)

```bash
cd c:/HD/Eliab/KAZATEM
npm install
```

## 2. Subir o Redis (BullMQ) via Docker

```bash
docker run -d --name ecoa-redis -p 6379:6379 redis:7-alpine
# parar/remover depois:  docker rm -f ecoa-redis
```

> O **Docker Desktop precisa estar em execução** (senão o comando falha com "failed to connect to
> the docker API"). Alternativas sem Docker: instalar o Redis nativo (WSL/Memurai no Windows) ou
> usar um Redis gerenciado (ex.: Upstash) — nesse caso ajuste `REDIS_HOST`/`REDIS_PORT` no `.env`.

(Corresponde a `REDIS_HOST=localhost` / `REDIS_PORT=6379` no `.env`.)

## 3. Criar o schema no banco

O schema está versionado em [`deploy/sql/01_ecoa_schema.sql`](deploy/sql/01_ecoa_schema.sql)
(idempotente, `IF NOT EXISTS`). Duas formas:

**Opção A — script do projeto (usa as entities compiladas):**
```bash
cd apps/ecoa-system/backend
npm run build                 # gera dist/ (o script lê dist/**/*.entity.js)
node scripts/db-schema.js     # cria o que falta, modo seguro (não dropa nada)
# saída esperada: SCHEMA_UPDATED_OK
```

**Opção B — SQL direto:** copiar o conteúdo de `deploy/sql/01_ecoa_schema.sql` no
*SQL Editor* do Supabase e executar.

## 4. Rodar backend + frontend

```bash
# Terminal 1 — backend (porta 3001)
cd apps/ecoa-system/backend
npm run dev

# Terminal 2 — frontend (porta 3003)
cd apps/ecoa-system/frontend
npm run dev
```

- Backend health: <http://localhost:3001/api/health> → `{ "status": "ok", ... }`
- App: <http://localhost:3003>

---

## 5. Testes manuais

### 5.1 Smoke test da API (auth + isolamento de tenant + webhook)

Com o **backend rodando** e o **schema criado**:

```bash
cd apps/ecoa-system/backend
bash test/e2e/ecoa-api.e2e.sh
# RESUMO: N passaram, 0 falharam
```

Esse script valida ponta a ponta: registro/login, `me` sem token = 401, **isolamento**
(usuário B não vê a lista de A; B não deleta item de A = 404), detecções e o
webhook público (verify token errado = 403, POST sem assinatura = 403).

### 5.2 Walkthrough pela UI

1. **Registrar / Login** — cria conta local (JWT próprio). Sem token, as rotas do dashboard
   redirecionam para o login.
2. **Conexão** — "Conectar Instagram". Requer o app da Meta configurado
   ([guia](docs/CONFIGURACAO_META_INSTAGRAM.md)). Após autorizar, o status vira "conectado como @…".
3. **Lista** — adicionar/remover `@handles` a acompanhar.
4. **Mídias** — após o job `sync-own-media` (ou aguardando o agendamento), listar seus posts;
   abrir um post mostra o gráfico de evolução (alcance/compartilhamentos/curtidas).
5. **Detecções** — quando alguém compartilha seu post preservando seu `@`, o webhook gera uma
   detecção; as de contas da sua lista aparecem **destacadas**.
6. **Dashboard** — KPIs por período e ranking de contas que mais repostam.

### 5.3 Testar os jobs manualmente (opcional)

```bash
cd apps/ecoa-system/backend
node scripts/enqueue-test-jobs.js   # enfileira os jobs BullMQ sem esperar o agendador
```

### 5.4 Testes automatizados

```bash
cd apps/ecoa-system/backend
npm test            # unit (domínio, VOs, cripto, tenant, webhook)
npm run lint        # ESLint (deve ficar limpo)
npm run build       # typecheck + build

cd ../frontend
npm run typecheck && npm run lint && npm run build
```

---

## Estrutura

```
apps/ecoa-system/
├── backend/    NestJS — contexts: auth, user, connection, watchlist, content, insight, detection
│   ├── src/infrastructure/integrations/instagram/   ← ÚNICO ponto que fala com a Meta (isolado atrás de port)
│   ├── src/infrastructure/jobs/                      ← BullMQ (fan-out por tenant)
│   ├── src/infrastructure/http/controllers/webhook/  ← webhook público (assinatura X-Hub-Signature-256)
│   ├── scripts/db-schema.js                          ← cria/atualiza schema (modo seguro)
│   └── test/e2e/ecoa-api.e2e.sh                       ← smoke test manual
├── frontend/   Next.js 14 (App Router) + MUI — cockpit de monitoramento de repostagem
├── deploy/sql/01_ecoa_schema.sql                     ← schema versionado (idempotente)
├── deploy/sql/02_drop_campaign.sql                   ← remove o recurso Campanhas (destrutivo)
└── docs/CONFIGURACAO_META_INSTAGRAM.md               ← configurar o app na Meta/Facebook
```

## Limitações (Opção A — deixar claro na UI)

- Só detecta compartilhamento que **preserva o `@`**. Reshare sem `@`, print re-upado ou DM são invisíveis.
- **Não** vê o alcance da republicação de terceiros (é privado da conta deles).
- Sem scraping (proibido pelos ToS). O que depende da Meta (webhook `mentions` fora do sandbox,
  insights para terceiros) exige **App Review** aprovado — ver o guia da Meta.
