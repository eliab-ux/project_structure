# Plano Diário — frontend (Next.js 14 + MUI) — build a partir da RAIZ do repo.
# No Dokploy: Build Type = Dockerfile | Dockerfile Path = apps/plano-diario/frontend/Dockerfile
#             Docker Context Path = /
#
# NEXT_PUBLIC_* é congelado no BUILD do Next. Com backend e frontend no MESMO domínio
# (backend em Path /api), a base relativa `/api` do services/api.ts já resolve e nenhum
# build-arg é necessário. Se a API ficar em domínio separado, passe NEXT_PUBLIC_API_URL
# como Build Arg no Dokploy.

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/domain-primitives/package.json ./packages/domain-primitives/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY apps/plano-diario/backend/package.json ./apps/plano-diario/backend/
COPY apps/plano-diario/frontend/package.json ./apps/plano-diario/frontend/
RUN npm ci

COPY apps/plano-diario/frontend ./apps/plano-diario/frontend

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w @gitspread/plano-diario-frontend

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/apps/plano-diario/frontend ./apps/plano-diario/frontend

WORKDIR /repo/apps/plano-diario/frontend
EXPOSE 3013
# `npm run start` = next start -p 3013
CMD ["npm", "run", "start"]
