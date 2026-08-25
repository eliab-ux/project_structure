# HISTÓRICO — EMDR Remoto (handoff para nova conversa com o Claude)

> **Cole este arquivo inteiro numa conversa nova** para o Claude retomar todo o contexto.
> A memória automática do Claude é atrelada ao **caminho da pasta** — ao renomear
> `KAZATEM`, a memória zera. Este arquivo é a fonte da verdade.
> **Idioma das conversas: pt-BR.**

---

## 0. Visão geral

- **App:** `apps/emdrremoto/` — **EMDR Remoto**, telemedicina para sessões de EMDR à distância
  (vídeo P2P + estímulo bilateral audiovisual em tempo real + chat + billing/assinatura).
- Foi **copiado** de um legado (Express + TypeORM + MySQL + React 17) e **reescrito**
  em **arquitetura hexagonal** conforme o `CLAUDE.md` do monorepo.
- **Stack:** Backend **NestJS 10 + Fastify + MikroORM (MySQL/MariaDB, driver `@mikro-orm/mysql`)
  + Socket.IO via NestJS Gateway** (porta 3005). Frontend **Next.js 14 (App Router) + MUI**
  (porta 3006). JWT próprio. Todos os `@mikro-orm/*` fixados em **6.6.15**.
- **Contexts do backend:** `auth`, `psicologo`, `paciente`, `session`, `notification`,
  `whatsapp`, **`billing`**.

## 1. Repositórios e Deploy (Dokploy)

- **Pasta de trabalho (fonte):** `C:\HD\Eliab\KAZATEM\apps\emdrremoto\` (será renomeada).
- **Repo standalone de DEPLOY:** `C:\HD\Eliab\emdrremoto\` (só `packages/` + `apps/emdrremoto/`,
  sem `_legacy`; Dockerfiles enxutos, package-lock próprio). Git: **`git@gitlab.com:eliab1/emdr.git`**,
  branch **`deploy`**. (O `main` do GitLab é o legado antigo, intocado.)
  - ⚠️ **Fluxo de deploy:** eu edito em `KAZATEM\apps\emdrremoto`, mas o que builda no Dokploy é o
    **repo standalone `C:\HD\Eliab\emdrremoto`**. Na prática, durante esta conversa eu editei
    **direto no repo standalone** e dei `git push origin deploy`. Mantê-los em sincronia é manual.
- **Dokploy:** servidor mdantas, project **`emdrremoto`**. Provider **Git + Deploy Key `key-ecoa`**
  (habilitada em GitLab → emdr → Settings → Repository → Deploy keys → "Privately accessible" → Enable).
  Build Type = **Dockerfile**, Docker Context Path = **`/`**.
  - **Serviços (renomeados):**
    - **`emdr-api`** = backend (era "Sistema"). Dockerfile `apps/emdrremoto/backend/Dockerfile`,
      porta **3005**, domínio **`api.emdrremoto.com.br`** (Path `/`, Strip Path OFF, HTTPS ON).
    - **`emdr-frontend`** = frontend. Dockerfile `apps/emdrremoto/frontend/Dockerfile`,
      porta **3006**, domínio **`emdrremoto.com.br`** (Path `/`, HTTPS ON).
      Build-args do Next: `NEXT_PUBLIC_API_URL=https://api.emdrremoto.com.br/api` e
      `NEXT_PUBLIC_SOCKET_URL=https://api.emdrremoto.com.br` — mas **os defaults já estão no
      Dockerfile do front** (ARG com valor), porque o Dokploy **não** repassa Environment como build-arg.
    - **`EMDR Remoto DB`** = MariaDB. Internal Host **`emdrremoto-emdr-remoto-db-p5knqi:3306`**,
      user/db `emdr`.
  - Backend em subdomínio próprio (`api.`) porque o **Socket.IO (`/socket.io`)** precisa cair no
    backend inteiro (sala EMDR em tempo real).
- **Redeploy:** frontend sempre com **Clean Cache** (mudança de UI do Next) + `Ctrl+Shift+R`.
  Sempre confira no topo do build do Dokploy que o **commit** é o esperado.

## 2. Banco de dados — MUITO IMPORTANTE

- **Não há auto-migration.** As migrations MikroORM existem no código, mas **as tabelas em produção
  foram criadas à mão via SQL** no terminal do banco (Dokploy → EMDR Remoto DB → Open Terminal).
  Ao criar tabela nova, rode o `CREATE TABLE` correspondente manualmente.
- **Senha real do `emdr`:** `T7dATBIAGLVyis52RZDN` (a senha exibida no painel do Dokploy estava
  DESATUALIZADA — a real é a do 1º boot). Conectar: `mariadb -u emdr -p'T7dATBIAGLVyis52RZDN' emdr`.
  - `DATABASE_URL` do backend usa **`mysql://`** (não `mariadb://`) e **senha só alfanumérica**
    (o editor de Environment do Dokploy **corta em `#`**).
- **Migração de dados feita:** do MariaDB legado → banco novo. **66 psicólogos** e **63 pacientes**
  migrados (senhas bcrypt preservadas; PKs viraram UUID **v1** do `UUID()` do MySQL — por isso os DTOs
  usam `@IsUUID('all')`, não `'4'`). Sessões NÃO foram migradas.
- **Tabelas existentes:** `psicologos`, `pacientes`, `sessions`, `session_history`,
  `whatsapp_instances`, `admins`, `plans`, `plan_prices`, `billing_settings`, `subscriptions`,
  `access_grants`, `payment_events`. (As temporárias `_leg_paciente`/`_leg_psicologo` podem ser
  dropadas: `DROP TABLE IF EXISTS _leg_paciente, _leg_psicologo;`.)

## 3. Login / credenciais

- **Psicólogo de teste:** `eliab@techbs.com.br`, senha resetada para **`Emdr@2026`**
  (hash bcrypt inserido direto no banco; login é por **e-mail + senha**).
- **Admin:** login SEPARADO em **`https://emdrremoto.com.br/admin/login`** →
  `eliab@techbs.com.br` / **`Admin@2026`** (conta na tabela `admins`, role `admin`, não é o
  psicólogo promovido). O admin **não** aparece na área do psicólogo — só pela URL `/admin/login`.
- **Trocar senha admin:** gerar hash bcrypt e
  `UPDATE admins SET password_hash='...' WHERE email='eliab@techbs.com.br';`.

## 4. Funcionalidades implementadas (todas no ar)

### Sala EMDR (`/emdr/[code]`)
- **Vídeo P2P (WebRTC)**, sinalização via Socket.IO (handshake `rtc-ready`; psicólogo = initiator).
- **Todos os controles do legado:** bolinha bilateral (movimentos horizontal/vertical/diagonais/
  sacádico), velocidade, contagem de movimentos com auto-pausa, mostrar/ocultar bola, cor, tamanho,
  sons (tons + música) com **pan estéreo acompanhando a bola**, mic/câmera (**só o psicólogo**
  controla — removido do paciente), convite (WhatsApp/e-mail), fullscreen, encerrar+timer, chat.
- **Vídeo do participante em `object-fit: contain`** (sem zoom/corte no celular).
- **PiP (self-view) flutuante, arrastável e minimizável.**
- **Parada suave da bola:** ao pedir parar, ela continua até **cruzar o centro** e só então para/fecha
  (2º clique cancela). Sincronizada psicólogo↔paciente.
- **Código da sala oculto** na tela do psicólogo.
- **Presença:** "Aguardando [Nome] entrar"; quadro "🟢 [Paciente] online" na sala e chip no dashboard.
- **Encerrar:** psicólogo → volta ao **dashboard**; paciente → tela "Sessão encerrada".

### Ciclo de vida da sessão
- Encerrar **mata** a sessão (`active=false`) → **link inativo** (`SessionEndedException` ao entrar).
- Um novo **"Enviar link"** gera **sessão/código novos** (reaproveita só sessão ATIVA).
- **Histórico** (`session_history`): registra início quando **ambos** estão juntos e fim quando um sai
  ou o psicólogo encerra. Relatório em `/relatorios` (filtros paciente/período; nome, data, início,
  fim, duração + tempo total).

### Cadastro/gestão de pacientes
- Tela separada (`/pacientes/novo`, `/pacientes/[id]`), com **DDI (país)** + Sobrenome.
- Campo de telefone rotulado **"WhatsApp"** (paciente e psicólogo).

### WhatsApp (Evolution API — `https://evo2.techbs.com.br`)
- Adapter de saída `EvolutionGateway`. **Ativação de conta** e **reset de senha** saem **sempre pela
  instância COMPARTILHADA padrão** (`EVOLUTION_SHARED_INSTANCE` = `emdr`), com **e-mail de fallback**.
  Envio de link de sessão pode usar a instância própria do psicólogo (se configurada) ou a padrão.
- Reset de senha por **código** (não link). Config de WhatsApp em `/whatsapp`.

### Branding
- Logo **Equipamentos PSI** (`public/logo.png`) no login e no AppBar (chip branco p/ contraste).
  Favicon = emblema recortado (`src/app/icon.png`).
- **Notificações (notistack) no rodapé** (bottom-center).

### Billing / Licenciamento (context `billing`) — spec em `apps/emdrremoto/docs/SPEC_PAGAMENTO_EMDR_REMOTO.md`
- **ResolveLicense** (ordem: free_mode → grant → assinatura → trial → NONE), `GET /api/me/license`.
- **Trial** criado no cadastro (via evento `psicologo.registered` → handler), snapshot em `trial_ends_at`.
- **Enforcement server-side:** `LicenseGuard` → **HTTP 402** em criar-sessão/enviar-link +
  **WsException('payment_required')** no `join-session` do gateway (só psicólogo; paciente isento).
- **Papel `admin`** próprio (tabela `admins`, `POST /api/auth/login-admin`, `AdminGuard`).
- **Planos** com **preço por moeda** (`plan_prices`: BRL/USD). Settings singleton (`free_mode`,
  `trial_days`). Grants manuais (`access_grants`).
- **Gateways atrás de um router por (método, moeda):** **Fake** (dev, funcional) + **Stripe**
  (checkout REST + webhook assinado) + **Cielo/Sicoob** (esqueleto guardado por credencial — `supports()`
  desliga sem chave; router cai no Fake). Webhooks públicos `/api/webhooks/{stripe,cielo,sicoob}` com
  verificação de origem + idempotência (`payment_events`). `rawBody` habilitado no `main.ts`.
- **Frontend:** `LicenseContext` + **PaywallModal** (seletor BRL/USD, planos do banco, cartão/Pix),
  **TrialBanner**, **interceptor 402**, e **área `/admin`** (login + Cobrança + Planos + **Psicólogos** +
  Usuários/liberações). `adminService` usa token de admin próprio (`emdr_admin_token`) com auto-refresh.
- **CRUD de psicólogos no admin** (`/admin/psicologos`, endpoints `/api/admin/psicologos`): list/criar/
  editar/excluir via **repositório admin CRU** (sem VO de e-mail — tolera/corrige registros legados
  com e-mail inválido, ex. `asdfasdf@asdf`). Admin cria conta **já verificada**.

### Rollout do billing (estado atual)
- `billing_settings.free_mode = **1** (ligado)` → ninguém bloqueado no lançamento.
- **Backfill:** todos os **66 psicólogos existentes** receberam `access_grant` até **31/10/2026**
  (motivo `ADMIN_GRANT`) — não são cobrados até essa data mesmo com paywall ligado.
- Preços iniciais (editáveis no admin): monthly BRL 129,00 / USD 25,00; annual BRL 1290,00 / USD 250,00.
- **Para começar a cobrar:** ajustar preços no admin, plugar um gateway real (Stripe é o mais rápido:
  `STRIPE_SECRET_KEY`+`STRIPE_WEBHOOK_SECRET`, webhook → `https://api.emdrremoto.com.br/api/webhooks/stripe`),
  e só então desligar `free_mode` (a base existente já está coberta pelos grants).

## 5. Variáveis de ambiente (no Dokploy do `emdr-api`)

```
NODE_ENV=production · APP_NAME=EMDR Remoto · PORT=3005 · HOST=0.0.0.0
CORS_ORIGIN=https://emdrremoto.com.br · APP_PUBLIC_URL=https://emdrremoto.com.br
DATABASE_URL=mysql://emdr:T7dATBIAGLVyis52RZDN@emdrremoto-emdr-remoto-db-p5knqi:3306/emdr
JWT_ACCESS_SECRET=... · JWT_REFRESH_SECRET=... · JWT_ACCESS_EXPIRATION=15m · JWT_REFRESH_EXPIRATION=7d
SMTP_* (vazio → e-mail desativado, WhatsApp funciona)
EVOLUTION_API_URL=https://evo2.techbs.com.br
EVOLUTION_API_KEY=<GLOBAL>  EVOLUTION_SHARED_INSTANCE=emdr  EVOLUTION_SHARED_APIKEY=<da instância>
BILLING_* / STRIPE_* / CIELO_* / SICOOB_* (ver .env.example; vazios = gateways reais desligados, Fake ativo)
```
> Todas as chaves reais só na UI do Dokploy — nunca no repo. Ver `apps/emdrremoto/backend/.env.example`.

## 6. 🔒 Pendências de segurança (fazer!)

- **Rotacionar** (circularam no chat): senha do banco `emdr` (`T7dATBIAGLVyis52RZDN`),
  `EVOLUTION_API_KEY` global, e a senha do psicólogo/admin de teste. Ao trocar a do banco,
  atualizar o `DATABASE_URL` no Dokploy.
- Fechar portas externas do banco (3307/3308) se ainda abertas.

## 7. Gotchas aprendidos (não repetir)

- `EntityRepository` **não** tem `persistAndFlush` → usar `EntityManager.persistAndFlush`.
- `em.getKnex()` só existe no `EntityManager` de **`@mikro-orm/mysql`** (não do `@mikro-orm/core`).
- MikroORM `repository.create({...})` exige **todos** os campos obrigatórios (senão TS erro).
- Coluna **DATE** (`free_until`) volta como **string** do ORM → coagir com `new Date(...)` antes de
  `.toISOString()` (isso causou um 500 no `/admin/billing/users`).
- Dokploy **não** repassa Environment como build-arg → defaults `NEXT_PUBLIC_*` ficam no Dockerfile.
- Deep-link/CRUD admin deve ser **tolerante a dados legados** (e-mail fora do formato quebrava a lista).
- `GlobalExceptionFilter` agora loga **mensagem + stack** (antes serializava `Error` como `{}`).

## 8. Como retomar

1. Renomeie a pasta (a memória do Claude zera — este arquivo é a fonte).
2. Numa conversa nova, cole este arquivo e diga onde parou.
3. Último commit no GitLab (branch `deploy`): CRUD de psicólogos no admin (`a732bfb`).
   Deploy pendente: **emdr-api** e **emdr-frontend** (Clean Cache) com esse commit.

### Primeira mensagem sugerida na nova conversa
> "Renomeei a pasta. Segue o HISTORICO_ClaudeIA.md com todo o contexto do EMDR Remoto.
> Acabamos de subir o CRUD de psicólogos no admin (commit a732bfb) — falta eu deployar emdr-api e
> emdr-frontend. Me ajude a continuar daqui."
