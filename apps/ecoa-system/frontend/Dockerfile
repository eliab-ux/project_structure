# ECOA frontend (Next.js 14) — build a partir da RAIZ do monorepo.
# No Dokploy: Build Type = Dockerfile | Dockerfile Path = apps/ecoa-system/frontend/Dockerfile
#             Docker Context Path = .
#             Build Arg: NEXT_PUBLIC_API_URL = https://api-ecoa.mdantas.com.br/api
#
# IMPORTANTE: NEXT_PUBLIC_* é embutido no BUILD do Next. Por isso a URL da API entra como
# build-arg (não basta variável de runtime).

# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/domain-primitives/package.json ./packages/domain-primitives/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY apps/ecoa-system/backend/package.json ./apps/ecoa-system/backend/
COPY apps/ecoa-system/frontend/package.json ./apps/ecoa-system/frontend/
RUN npm ci

COPY apps/ecoa-system/frontend ./apps/ecoa-system/frontend

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w @gitspread/ecoa-system-frontend

# ---------- runtime ----------
FROM node:20-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/apps/ecoa-system/frontend ./apps/ecoa-system/frontend

WORKDIR /repo/apps/ecoa-system/frontend
EXPOSE 3003
# `npm run start` = next start -p 3003
CMD ["npm", "run", "start"]
