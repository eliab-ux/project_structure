# EMDR Remoto — frontend (Next.js 14 + MUI) — build a partir da RAIZ do monorepo.
# No Dokploy: Build Type = Dockerfile | Dockerfile Path = apps/emdrremoto/frontend/Dockerfile
#             Docker Context Path = /
#
# NEXT_PUBLIC_* é embutido no BUILD do Next. Com API no MESMO domínio, use a base relativa
# /api (não precisa build-arg). Se a API estiver noutro domínio, passe NEXT_PUBLIC_API_URL
# como Build Arg. NEXT_PUBLIC_SOCKET_URL/NEXT_PUBLIC_DAILY_DOMAIN também são build-args.

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/domain-primitives/package.json ./packages/domain-primitives/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY apps/kaza-tem-system/backend/package.json ./apps/kaza-tem-system/backend/
COPY apps/kaza-tem-system/frontend/package.json ./apps/kaza-tem-system/frontend/
COPY apps/ecoa-system/backend/package.json ./apps/ecoa-system/backend/
COPY apps/ecoa-system/frontend/package.json ./apps/ecoa-system/frontend/
COPY apps/emdrremoto/backend/package.json ./apps/emdrremoto/backend/
COPY apps/emdrremoto/frontend/package.json ./apps/emdrremoto/frontend/
RUN npm ci

COPY apps/emdrremoto/frontend ./apps/emdrremoto/frontend

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_DAILY_DOMAIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_DAILY_DOMAIN=$NEXT_PUBLIC_DAILY_DOMAIN
RUN npm run build -w @gitspread/emdr-remoto-frontend

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/apps/emdrremoto/frontend ./apps/emdrremoto/frontend

WORKDIR /repo/apps/emdrremoto/frontend
EXPOSE 3006
# `npm run start` = next start -p 3006
CMD ["npm", "run", "start"]
