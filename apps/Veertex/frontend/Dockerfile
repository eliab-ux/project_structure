# VEERTEX frontend (Next.js 14) — build a partir da RAIZ do monorepo.
# No Dokploy: Build Type = Dockerfile | Dockerfile Path = apps/Veertex/frontend/Dockerfile
#             Docker Context Path = /        (a raiz do MONOREPO — sem isso os COPY falham)
#             Domains: Host <sub>.<dominio> | Path / | Container Port 3021
#
# A base da API é RELATIVA (`/api`) por padrão, então o mesmo domínio serve front e back e não é
# preciso passar NEXT_PUBLIC_API_URL como build arg. Se um dia a API mudar de domínio, aí sim
# vira build arg — variável NEXT_PUBLIC_* é embutida no build, não lida em runtime.

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /repo

# O `.prettierrc` entra na imagem, e não é detalhe de estilo: o `next build` roda o ESLint, o ESLint
# do frontend usa o plugin do prettier, e o prettier SEM este arquivo volta ao padrão dele — aspas
# duplas. O build então reprovava todo arquivo do app por "Replace 'react' with \"react\"", enquanto
# o mesmo build passava na máquina de desenvolvimento, onde o arquivo existe.
#
# Descoberto em 20/08/2026 buildando a imagem ANTES de publicar. A alternativa seria
# `eslint.ignoreDuringBuilds` (o que o Kortex faz), mas isso esconde a divergência em vez de
# corrigi-la: o certo é o container lintar com a mesma configuração da máquina.
COPY package.json package-lock.json tsconfig.json tsconfig.base.json .prettierrc .prettierignore ./
COPY packages/domain-primitives/package.json ./packages/domain-primitives/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY apps/Veertex/backend/package.json ./apps/Veertex/backend/
COPY apps/Veertex/frontend/package.json ./apps/Veertex/frontend/
RUN npm ci

COPY apps/Veertex/frontend ./apps/Veertex/frontend

RUN npm run build -w @gitspread/veertex-frontend

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/apps/Veertex/frontend ./apps/Veertex/frontend

WORKDIR /repo/apps/Veertex/frontend
EXPOSE 3021
CMD ["npx", "next", "start", "-p", "3021"]
