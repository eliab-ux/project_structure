# Batuta

SaaS multi-tenant de distribuição de conteúdo para WhatsApp sobre múltiplos números remetentes
("chips"), com envio **1:1 para contatos**, aprovação de conteúdo e caixa de entrada unificada.

Especificação técnica: [`Requisitos/BATUTA_SPEC.md`](Requisitos/BATUTA_SPEC.md).
Regras transversais de arquitetura e segurança: `CLAUDE.md` na raiz do monorepo (prevalece em
qualquer conflito).

> **Estado atual: FASE 0 (fundação) concluída.** Não há tabela de negócio, autenticação nem
> endpoint de produto ainda — `accounts`, `users`, `platform_admins` e o JWT entram na FASE 1.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `backend/` | API NestJS 10 + Fastify + MikroORM 6 (PostgreSQL), BullMQ, MinIO — porta **3010** |
| `frontend/` | Next.js 14 (App Router) + Material-UI — porta **3003** |
| `Requisitos/` | Especificação técnica |

## Rodando local

```bash
# 1. Dependências (na raiz do monorepo)
npm install

# 2. Backend
cd apps/batuta-system/backend
cp .env.example .env          # ajuste DATABASE_URL, REDIS_*, MINIO_*
npm run migration:up          # aplica as migrations (exige Postgres acessível)
npm run dev                   # http://localhost:3010/api/health

# 3. Frontend (outro terminal)
cd apps/batuta-system/frontend
cp .env.example .env.local
npm run dev                   # http://localhost:3003
```

Com `DATABASE_URL` ainda em placeholder (`user:pass@…`) e `NODE_ENV=development`, o MikroORM
**não** conecta e a API sobe mesmo assim — útil para conferir o wiring antes de ter banco.

### Infra local esperada

- **PostgreSQL** — database `batuta` (self-hosted; em produção fica no servidor mdantas)
- **Redis** — filas BullMQ
- **MinIO** — storage de arquivos (um bucket por conta, `batuta-{account_id}`)

Sem Redis a API sobe, mas o BullMQ fica tentando reconectar. Sem MinIO a API sobe e o upload
falha com mensagem explícita no ponto de uso.

## Comandos

### Backend (`apps/batuta-system/backend`)

```bash
npm run dev                   # watch mode
npm run build                 # nest build
npm run start                 # node dist/main
npm run typecheck             # tsc --noEmit
npm run test                  # jest
npm run migration:create -- --name=Descricao
npm run migration:up          # aplica pendentes
npm run migration:down        # desfaz a última
npm run smoke:queue           # enfileira 1 job na fila de smoke test (valida Redis + BullMQ)
```

### Frontend (`apps/batuta-system/frontend`)

```bash
npm run dev                   # next dev -p 3003
npm run build                 # next build
npm run lint                  # eslint --max-warnings=0
npm run typecheck
```

## Deploy (Dokploy / mdantas)

Playbook completo no `CLAUDE.md` da raiz. Pontos específicos deste app:

| Item | Valor |
|---|---|
| Project no Dokploy | `batuta` |
| Domínio de validação | `batuta.techbs.com.br` |
| Domínio final | `batuta.com.br` |
| Docker Context Path | `/` (raiz do monorepo) |
| Backend | `apps/batuta-system/backend/Dockerfile` · Path `/api` · Strip Path **OFF** · porta **3010** |
| Frontend | `apps/batuta-system/frontend/Dockerfile` · Path `/` · porta **3003** |
| DNS (Cloudflare) | A → `72.61.43.90`, **DNS only** (nuvem cinza) |

Segredos vão **apenas** na aba Environment do Dokploy — nunca versionados. `REDIS_HOST` é o
*Internal Host* gerado pelo Dokploy, não o nome amigável do serviço.

Postgres self-hosted: dimensione `max_connections` somando API (pool máx. 5) + workers.
