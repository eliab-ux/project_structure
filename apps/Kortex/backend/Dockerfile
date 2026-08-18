# syntax=docker/dockerfile:1
#
# Backend do Kortex — NestJS + Fastify + MikroORM.
#
# CONTEXTO DE BUILD = RAIZ DO REPOSITÓRIO. No Dokploy: Docker Context Path = `/`.
# O backend importa `@gitspread/domain-primitives` e `@gitspread/shared-kernel`, que vivem em
# `packages/`. Com o contexto na pasta do app, o `COPY packages/ ...` abaixo falha com
# `"/packages": not found` — o erro nº 1 do playbook do CLAUDE.md.
#
# Base node:22-alpine: `@supabase/*` exige Node >= 22 no monorepo, e a 20 quebra o `npm ci` com
# EBADENGINE. O Kortex não usa Supabase, mas divide o lockfile com quem usa.

# ============================================================================
# 1. build — instala, compila os pacotes compartilhados e depois o app
# ============================================================================
FROM node:22-alpine AS build
WORKDIR /repo

# Só os manifests primeiro: enquanto nenhum package.json mudar, a camada do `npm ci` (a cara) vem
# do cache mesmo que todo o código tenha mudado.
COPY package.json package-lock.json ./
COPY packages/domain-primitives/package.json packages/domain-primitives/
COPY packages/shared-kernel/package.json packages/shared-kernel/
COPY apps/Kortex/backend/package.json apps/Kortex/backend/
COPY apps/Kortex/frontend/package.json apps/Kortex/frontend/

# `npm ci` e não `npm install`: instala exatamente o lockfile e falha se ele estiver
# dessincronizado — o comportamento que se quer num build reprodutível. Exige o package-lock.json
# versionado (CLAUDE.md).
#
# A instalação acontece NESTE estágio, e o `node_modules` nunca é copiado de outro. O npm
# workspaces hoista quase tudo para a raiz mas aninha o que conflita de versão entre workspaces —
# copiar só `/repo/node_modules` de um estágio `deps` deixaria esses para trás, e o sintoma é um
# `Module not found` de dependência que está declarada e instalada.
RUN npm ci --workspaces --include-workspace-root

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/Kortex/backend ./apps/Kortex/backend

# Ordem obrigatória: os pacotes primeiro. O backend importa os `dist/` deles, e o `tsc` do app
# falharia com "Cannot find module '@gitspread/domain-primitives'" se rodasse antes.
RUN npm run build --workspace @gitspread/domain-primitives \
  && npm run build --workspace @gitspread/shared-kernel \
  && npm run build --workspace @gitspread/kortex-backend

# Poda o que era só de build. Roda DEPOIS de compilar, e os `packages/*/dist` sobrevivem porque
# vivem em `packages/`, não em `node_modules`.
RUN npm ci --workspaces --include-workspace-root --omit=dev

# ============================================================================
# 2. runtime — o que vai para o servidor
# ============================================================================
FROM node:22-alpine AS runtime
WORKDIR /repo

ENV NODE_ENV=production
ENV PORT=3030
ENV HOST=0.0.0.0

# `wget` para o HEALTHCHECK; `tini` para o PID 1 encaminhar SIGTERM ao Node — sem ele o
# `enableShutdownHooks()` do Nest nunca roda e o pool do Postgres fica pendurado a cada redeploy.
RUN apk add --no-cache wget tini

# Usuário não-root. A imagem `node` já traz o usuário `node` (uid 1000); reusar o existente evita
# conflito de uid com volume montado.
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages ./packages
COPY --from=build --chown=node:node /repo/apps/Kortex/backend/dist ./apps/Kortex/backend/dist
COPY --from=build --chown=node:node /repo/apps/Kortex/backend/package.json ./apps/Kortex/backend/
COPY --from=build --chown=node:node /repo/package.json ./

WORKDIR /repo/apps/Kortex/backend
USER node

EXPOSE 3030

# 127.0.0.1 e não o nome do serviço: o healthcheck testa ESTE processo. Apontar para fora
# transformaria uma falha de rede do Docker em "aplicação morta" e dispararia restart em cascata.
# `/api/health` é público por decisão documentada — só liveness, sem dado de conta.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3030/api/health || exit 1

# Migration NÃO roda aqui — ver apps/Kortex/deploy/README.md. O start é só o start.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]
