# EMDR Remoto

Plataforma de telemedicina para sessões de **EMDR** (Eye Movement Desensitization and
Reprocessing) à distância: vídeo, **estímulo bilateral sincronizado em tempo real** e chat
entre psicólogo e paciente.

Reescrito para os padrões do `CLAUDE.md` do monorepo — **NestJS 10 + Fastify + MikroORM
(MySQL) + Socket.IO** no backend, **Next.js 14 + MUI** no frontend, **arquitetura hexagonal**
e **Security by Design**. O plano de reestruturação está em
[`PLANO_REESTRUTURACAO_EMDR_REMOTO.md`](./PLANO_REESTRUTURACAO_EMDR_REMOTO.md).

> O código do sistema legado (Express + TypeORM + React 17 + Socket.IO) foi preservado em
> [`_legacy/`](./_legacy) apenas como **referência** da migração — não faz parte do build.

## Estrutura

```
apps/emdrremoto/
├── backend/    NestJS + Fastify + MikroORM(MySQL) + Socket.IO (porta 3005)
├── frontend/   Next.js 14 (App Router) + MUI (porta 3006)
└── _legacy/    código original (referência; fora do build/workspaces)
```

### Bounded contexts (backend)
`auth` · `psicologo` · `paciente` · `session` (aggregate da sessão EMDR) · `notification`.
Real-time em `infrastructure/realtime/` (Gateways Session/Emdr/Chat — inbound adapter).

## Desenvolvimento

```bash
# a partir da raiz do monorepo
npm install

# Backend (porta 3005) — precisa de DATABASE_URL (MySQL) no .env
cd apps/emdrremoto/backend
cp .env.example .env      # preencha os segredos
npm run migration:up      # cria as tabelas
npm run dev               # http://localhost:3005/api/health

# Frontend (porta 3006)
cd apps/emdrremoto/frontend
cp .env.example .env.local
npm run dev               # http://localhost:3006
```

### Testes
```bash
cd apps/emdrremoto/backend
npm test                  # unit (domain + application)
npx jest --coverage       # cobertura (>80% em domain/application)
```

## Fluxos principais

1. **Psicólogo**: cadastra-se (`POST /api/psicologos`) → verifica e-mail → login (JWT próprio)
   → cadastra pacientes → **inicia sessão** (`POST /api/sessions`, cria sala Daily.co e envia
   convite ao paciente).
2. **Paciente**: recebe o link `/sessao/<hash>?code=<sessionCode>` → troca o **hash** por um
   token de sessão (sem senha) → entra na sala.
3. **Sessão EMDR (tempo real)**: ambos entram na room `session:<code>` do Socket.IO. O
   psicólogo controla o estímulo bilateral (`ball-handler`) e o áudio (`audio-handler`); o
   chat usa `new-message`. **Autorização no `join-session`**; depois o roteamento é por
   **room** (sem consulta ao banco por evento).

## Segurança (resumo)

- **Auth 100% própria** (JWT access + refresh); psicólogo por e-mail+senha (bcrypt),
  paciente por hash de convite. Guards: `JwtAuthGuard`, `PsicologoGuard`, `WsJwtGuard`.
- **Todo DTO validado** (`class-validator`); `ValidationPipe` global (whitelist).
- **Nenhuma domain entity exposta** via HTTP — sempre Response DTO; `passwordHash`/
  `recoveryCode` nunca mapeados.
- **GlobalExceptionFilter** (erros internos não vazam) + **error-reporter port** (no-op por
  padrão, pronto para o `<NomeDoGuard>`).
- **Socket**: handshake autenticado, payload validado, rooms (nunca `socket_id` no banco),
  CORS por `CORS_ORIGIN`.

## Deploy no Dokploy (project `emdrremoto`)

Playbook completo no `CLAUDE.md`. Resumo para este app:

| Serviço | Dockerfile | Context | Path | Porta |
|---|---|---|---|---|
| Backend | `apps/emdrremoto/backend/Dockerfile` | `/` (raiz do repo) | `/api` (Strip Path OFF) | 3005 |
| Frontend | `apps/emdrremoto/frontend/Dockerfile` | `/` | `/` | 3006 |

- **DNS (Cloudflare)**: A record `<sub>` → `72.61.43.90`, **DNS only (cinza)**.
- **Env** na UI do Dokploy (nunca no arquivo): `DATABASE_URL` (MySQL), `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `CORS_ORIGIN` (domínio real do frontend), `DAILY_CO_API_KEY`,
  `TWILIO_*`, `SMTP_*`.
- **Frontend build-args** (NEXT_PUBLIC_* são embutidos no build): `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_DAILY_DOMAIN`. Com API no mesmo domínio, use base
  relativa `/api`.
- **Redis**: opcional — só necessário com **>1 réplica** do backend (adapter do Socket.IO),
  presença em memória ou filas. Uma instância única não precisa (ver Seção 2.1 do plano).

## Migração de dados do MySQL legado (opcional)

O schema novo usa **UUID (varchar 36)** como PK. Reaproveitar os dados da base legada
(int PK, colunas do TypeORM) exige um **script de transformação** à parte (fora do build):
mapear `psicologo`→`psicologos`, `paciente`→`pacientes`, `sessions`→`sessions`, gerando
UUIDs e remapeando as FKs. Se não precisar dos dados antigos, basta rodar `migration:up`
numa base nova.
