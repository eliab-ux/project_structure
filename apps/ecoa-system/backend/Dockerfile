# ECOA backend (NestJS) — build a partir da RAIZ do monorepo.
# No Dokploy: Build Type = Dockerfile | Dockerfile Path = apps/ecoa-system/backend/Dockerfile
#             Docker Context Path = .  (a raiz do repo — necessário p/ os pacotes @gitspread/*)
#
# Depende de @gitspread/domain-primitives e @gitspread/shared-kernel (precisam ser buildados,
# pois seus package.json apontam main: dist/index.js). O backend usa imports relativos, então
# `node dist/main` roda sem tsconfig-paths.

# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /repo

# Manifests de TODOS os workspaces primeiro (o npm ci exige o layout completo do lockfile).
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY packages/domain-primitives/package.json ./packages/domain-primitives/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY apps/ecoa-system/backend/package.json ./apps/ecoa-system/backend/
COPY apps/ecoa-system/frontend/package.json ./apps/ecoa-system/frontend/
RUN npm ci

# Fontes necessárias ao build do backend + pacotes compartilhados
COPY packages ./packages
COPY apps/ecoa-system/backend ./apps/ecoa-system/backend

# Builda os pacotes (tsc → dist) e depois o backend (nest build → dist)
RUN npm run build -w @gitspread/domain-primitives \
 && npm run build -w @gitspread/shared-kernel \
 && npm run build -w @gitspread/ecoa-system-backend

# ---------- runtime ----------
FROM node:20-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

# node_modules (com os symlinks @gitspread/* → ../../packages/*) + pacotes buildados + dist do backend
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/ecoa-system/backend/dist ./apps/ecoa-system/backend/dist
COPY --from=builder /repo/apps/ecoa-system/backend/package.json ./apps/ecoa-system/backend/package.json

WORKDIR /repo/apps/ecoa-system/backend
EXPOSE 3005
# Healthcheck em 127.0.0.1 (não localhost — evita IPv6 no Alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3005)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/main"]
