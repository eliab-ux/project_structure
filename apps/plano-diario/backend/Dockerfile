# Plano Diário — backend (NestJS + Fastify + MikroORM) — build a partir da RAIZ do repo.
# No Dokploy: Build Type = Dockerfile | Dockerfile Path = apps/plano-diario/backend/Dockerfile
#             Docker Context Path = /   (a raiz — necessário p/ os pacotes @gitspread/*)
#
# Base node:22-alpine (lição do playbook Dokploy). O backend usa imports relativos, então
# `node dist/main` roda sem tsconfig-paths.

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /repo

# Manifests de TODOS os workspaces primeiro (o npm ci exige o layout completo do lockfile).
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY packages/domain-primitives/package.json ./packages/domain-primitives/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY apps/plano-diario/backend/package.json ./apps/plano-diario/backend/
COPY apps/plano-diario/frontend/package.json ./apps/plano-diario/frontend/
RUN npm ci

# Fontes necessárias ao build do backend + pacotes compartilhados
COPY packages ./packages
COPY apps/plano-diario/backend ./apps/plano-diario/backend

RUN npm run build -w @gitspread/domain-primitives \
 && npm run build -w @gitspread/shared-kernel \
 && npm run build -w @gitspread/plano-diario-backend

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/plano-diario/backend/dist ./apps/plano-diario/backend/dist
COPY --from=builder /repo/apps/plano-diario/backend/package.json ./apps/plano-diario/backend/package.json
# Sem COPY do node_modules local do workspace: aqui o npm hoistou TODAS as dependências para
# /repo/node_modules, então a pasta não existe e o COPY falharia ("not found"). Se algum dia
# entrar uma dep que o npm não hoiste (típico de módulo nativo), adicionar o COPY dela aqui.

WORKDIR /repo/apps/plano-diario/backend
EXPOSE 3011
# Healthcheck em 127.0.0.1 (não localhost — evita IPv6 no Alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3011)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/main"]
