# BATUTA frontend (Next.js 14) — build a partir da RAIZ do monorepo.
# No Dokploy: Build Type = Dockerfile | Dockerfile Path = apps/batuta-system/frontend/Dockerfile
#             Docker Context Path = /        (a raiz do repo)
#             Domains: Host batuta.com.br | Path / | Container Port 3003 | HTTPS ON
#
# Com backend e frontend no MESMO domínio, a API base é relativa (/api) e NÃO é preciso
# passar NEXT_PUBLIC_API_URL. Se algum dia a API ganhar domínio próprio, passe-a como
# BUILD ARG — NEXT_PUBLIC_* é embutido no build do Next, não lido em runtime.

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/domain-primitives/package.json ./packages/domain-primitives/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY apps/batuta-system/backend/package.json ./apps/batuta-system/backend/
COPY apps/batuta-system/frontend/package.json ./apps/batuta-system/frontend/
RUN npm ci

# O `next build` roda o ESLint, e o eslint-plugin-prettier lê o .prettierrc da RAIZ. Sem este COPY
# o prettier cai no default (aspas duplas) e reprova todo arquivo do projeto, que usa aspas simples.
COPY .prettierrc ./

COPY apps/batuta-system/frontend ./apps/batuta-system/frontend

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w @gitspread/batuta-system-frontend

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/apps/batuta-system/frontend ./apps/batuta-system/frontend

WORKDIR /repo/apps/batuta-system/frontend
EXPOSE 3003
# `npm run start` = next start -p 3003
CMD ["npm", "run", "start"]
