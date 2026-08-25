# EMDR Remoto — backend (NestJS + Fastify + Socket.IO) — build a partir da RAIZ do monorepo.
# No Dokploy: Build Type = Dockerfile | Dockerfile Path = apps/emdrremoto/backend/Dockerfile
#             Docker Context Path = /  (a raiz do repo — necessário p/ os pacotes @gitspread/*)
#
# Base node:22-alpine (lição do playbook Dokploy). O backend usa imports relativos, então
# `node dist/main` roda sem tsconfig-paths. Socket.IO sobe na MESMA porta do HTTP (IoAdapter).

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /repo

# Manifests de TODOS os workspaces (npm ci exige o layout completo do lockfile).
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY packages/domain-primitives/package.json ./packages/domain-primitives/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY apps/kaza-tem-system/backend/package.json ./apps/kaza-tem-system/backend/
COPY apps/kaza-tem-system/frontend/package.json ./apps/kaza-tem-system/frontend/
COPY apps/ecoa-system/backend/package.json ./apps/ecoa-system/backend/
COPY apps/ecoa-system/frontend/package.json ./apps/ecoa-system/frontend/
COPY apps/emdrremoto/backend/package.json ./apps/emdrremoto/backend/
COPY apps/emdrremoto/frontend/package.json ./apps/emdrremoto/frontend/
RUN npm ci

# Fontes necessárias ao build do backend + pacotes compartilhados
COPY packages ./packages
COPY apps/emdrremoto/backend ./apps/emdrremoto/backend

RUN npm run build -w @gitspread/domain-primitives \
 && npm run build -w @gitspread/shared-kernel \
 && npm run build -w @gitspread/emdr-remoto-backend

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/emdrremoto/backend/dist ./apps/emdrremoto/backend/dist
COPY --from=builder /repo/apps/emdrremoto/backend/package.json ./apps/emdrremoto/backend/package.json

WORKDIR /repo/apps/emdrremoto/backend
EXPOSE 3005
# Healthcheck em 127.0.0.1 (não localhost — evita IPv6 no Alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3005)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/main"]
