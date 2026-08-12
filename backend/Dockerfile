# VEERTEX backend (NestJS + Fastify) — build a partir da RAIZ do monorepo.
# No Dokploy: Build Type = Dockerfile | Dockerfile Path = backend/Dockerfile
#             Docker Context Path = /        (a raiz do repo — sem isso os COPY falham)
#             Domains: Host <sub>.<dominio> | Path /api | Strip Path OFF | Container Port 3020
#
# Depende de @veertex/domain-primitives e @veertex/shared-kernel (precisam ser buildados, pois
# seus package.json apontam main: dist/index.js). O backend usa imports relativos, então
# `node dist/main` roda sem tsconfig-paths.

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /repo

# Manifests de TODOS os workspaces do app primeiro (npm ci exige o layout do lockfile).
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY packages/domain-primitives/package.json ./packages/domain-primitives/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

COPY packages ./packages
COPY backend ./backend

RUN npm run build -w @veertex/domain-primitives \
 && npm run build -w @veertex/shared-kernel \
 && npm run build -w @veertex/backend

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/backend/dist ./backend/dist
COPY --from=builder /repo/backend/package.json ./backend/package.json

WORKDIR /repo/backend
EXPOSE 3020
# Healthcheck em 127.0.0.1 (não localhost — evita IPv6 no Alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3020)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
# As migrations rodam NO START, dentro de um advisory lock do Postgres — é ele que torna isso seguro
# com várias réplicas: a primeira migra, as demais bloqueiam no lock e, ao acordar, não encontram
# nada pendente. Em seguida os invariantes de isolamento são verificados e o processo ABORTA se
# algum falhar; só então o servidor passa a escutar. Ver database-bootstrap.service.ts.
#
# Para deploy controlado (migration aplicada fora de banda), defina AUTO_MIGRATE=false — a
# verificação continua rodando.
CMD ["node", "dist/main"]
