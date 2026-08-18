# syntax=docker/dockerfile:1
#
# Frontend do Kortex — Next.js 14 (App Router) + MUI.
#
# CONTEXTO DE BUILD = RAIZ DO REPOSITÓRIO. No Dokploy: Docker Context Path = `/`.
# Mesmo motivo do backend: o build resolve o workspace inteiro a partir do lockfile da raiz.
#
# NÃO recebe `NEXT_PUBLIC_API_URL` como build arg de propósito. O `services/api.ts` usa `/api`
# relativo por padrão, e em produção o Traefik roteia `/api` do mesmo domínio para o backend —
# um domínio só, nenhuma variável embutida no bundle. Passar a URL como build arg é o caminho do
# erro "frontend chama http://localhost:3001/api" do playbook: o valor é congelado no build e não
# muda mais por Environment.

# ============================================================================
# 1. build — instala e compila num estágio só
# ============================================================================
FROM node:22-alpine AS build
WORKDIR /repo

ENV NEXT_TELEMETRY_DISABLED=1

# Manifests primeiro: enquanto nenhum package.json mudar, a camada do `npm ci` vem do cache.
COPY package.json package-lock.json ./
COPY packages/domain-primitives/package.json packages/domain-primitives/
COPY packages/shared-kernel/package.json packages/shared-kernel/
COPY apps/Kortex/backend/package.json apps/Kortex/backend/
COPY apps/Kortex/frontend/package.json apps/Kortex/frontend/

# A instalação fica NESTE estágio e o `node_modules` nunca é copiado de outro. O npm workspaces
# hoista quase tudo para a raiz mas ANINHA o que conflita de versão entre workspaces; um estágio
# `deps` separado deixaria esses aninhados para trás. Foi exatamente o que aconteceu aqui:
# `react-hook-form`, `yup` e `@hookform/resolvers` — declarados e instalados — davam
# `Module not found` no `next build`.
RUN npm ci --workspaces --include-workspace-root

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/Kortex/frontend ./apps/Kortex/frontend

# Os pacotes compartilhados antes do app: o frontend os importa por tipo, e o `tsc` do Next falha
# sem os `dist/` deles.
RUN npm run build --workspace @gitspread/domain-primitives   && npm run build --workspace @gitspread/shared-kernel   && npm run build --workspace @gitspread/kortex-frontend

# ============================================================================
# 2. runtime — `output: standalone` do Next
# ============================================================================
FROM node:22-alpine AS runtime
# WORKDIR na RAIZ, não na pasta do app: o `output: standalone` preserva a estrutura do monorepo
# DENTRO de si (`.next/standalone/apps/Kortex/frontend/server.js`). Trabalhar a partir da pasta do
# app duplicaria o caminho e o `static/` acabaria num lugar onde o servidor não o procura — a
# página subiria sem CSS nenhum, que é o tipo de erro que só aparece no navegador do usuário.
WORKDIR /repo

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3031
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache wget tini

# O `standalone` já traz o `node_modules` mínimo dentro de si — por isso não se copia o
# `node_modules` do monorepo aqui. `public` e `.next/static` ficam de fora do standalone por
# desenho do Next e precisam ser copiados à parte, senão a página sobe sem CSS nem imagem.
COPY --from=build --chown=node:node /repo/apps/Kortex/frontend/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/Kortex/frontend/.next/static ./apps/Kortex/frontend/.next/static
COPY --from=build --chown=node:node /repo/apps/Kortex/frontend/public ./apps/Kortex/frontend/public

USER node

EXPOSE 3031

# 127.0.0.1: o healthcheck testa ESTE processo, não a rede. `/login` é a rota pública mais barata
# que exercita o render de verdade — `/` redireciona conforme a sessão e não prova nada.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3031/login || exit 1

# Caminho conferido contra o build real: `.next/standalone/apps/Kortex/frontend/server.js`.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/Kortex/frontend/server.js"]
