# BATUTA backend (NestJS + Fastify) — build a partir da RAIZ do monorepo.
# No Dokploy: Build Type = Dockerfile | Dockerfile Path = apps/batuta-system/backend/Dockerfile
#             Docker Context Path = /        (a raiz do repo — sem isso os COPY falham)
#             Domains: Host batuta.com.br | Path /api | Strip Path OFF | Container Port 3010
#
# Depende de @gitspread/domain-primitives e @gitspread/shared-kernel (precisam ser buildados,
# pois seus package.json apontam main: dist/index.js). O backend usa imports relativos, então
# `node dist/main` roda sem tsconfig-paths.

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /repo

# Manifests de TODOS os workspaces do app primeiro (npm ci exige o layout do lockfile).
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY packages/domain-primitives/package.json ./packages/domain-primitives/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY apps/batuta-system/backend/package.json ./apps/batuta-system/backend/
COPY apps/batuta-system/frontend/package.json ./apps/batuta-system/frontend/
RUN npm ci

# Fontes necessárias ao build do backend + pacotes compartilhados
COPY packages ./packages
COPY apps/batuta-system/backend ./apps/batuta-system/backend

RUN npm run build -w @gitspread/domain-primitives \
 && npm run build -w @gitspread/shared-kernel \
 && npm run build -w @gitspread/batuta-system-backend

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

# node_modules (com os symlinks @gitspread/* → ../../packages/*) + pacotes buildados + dist
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/batuta-system/backend/dist ./apps/batuta-system/backend/dist
COPY --from=builder /repo/apps/batuta-system/backend/package.json ./apps/batuta-system/backend/package.json

WORKDIR /repo/apps/batuta-system/backend
EXPOSE 3010
# Healthcheck em 127.0.0.1 (não localhost — evita IPv6 no Alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3010)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
# As migrations NÃO rodam no start do container, de propósito: com duas réplicas, dois processos
# aplicariam o mesmo lote ao mesmo tempo. O deploy roda `npm run migrate:prod` uma vez (ver
# apps/batuta-system/deploy/README.md) e só depois o serviço sobe.
CMD ["node", "dist/main"]
