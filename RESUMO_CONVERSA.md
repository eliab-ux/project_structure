# Resumo da Conversa — Handoff para Nova Sessão (GitPSI)

> **Cole este arquivo inteiro na nova conversa** para o Claude retomar o contexto.
> Este arquivo está na raiz do projeto e viaja junto ao renomear a pasta KAZATEM → GitPSI.
> Última atualização: 07/07/2026.

---

## 0. Contexto do projeto

- Pasta local: `c:\HD\Eliab\KAZATEM` → **sendo renomeada para `GitPSI`** (por isso o histórico se perde).
- São **projetos PESSOAIS**, sem qualquer vínculo com Spread/SpreadUp/ChangePoint/NativeAuth. Autenticação 100% própria (JWT). O escopo npm `@gitspread/*` é só namespace legado — não implica vínculo com a Spread.
- Regras completas de arquitetura e segurança estão no `CLAUDE.md` (Hexagonal, Security by Design, NestJS+Fastify+MikroORM+Supabase, Next.js 14+MUI, auth JWT própria).
- **Idioma**: todas as conversas em **pt-BR**.

## 1. Apps no monorepo

- `apps/kaza-tem-system/` — e-commerce com sistema de revendedores (backend + frontend).
- `apps/ecoa-system/` — **ECOA**: SaaS multi-tenant de monitoramento de repostagens do Instagram (spec em `apps/ecoa/Requisito/ECOA_SPEC.md`). Backend NestJS (porta 3005), frontend Next.js (porta 3003), PostgreSQL/Supabase, Redis/BullMQ, JWT próprio, cripto de token AES-256-GCM, Instagram Graph API via **Login do Facebook**.
- (Há também `apps/tkc/` no repo — não foi tema desta conversa.)

## 2. STATUS ATUAL — ECOA (o foco desta conversa)

### 2.1 Deploy em PRODUÇÃO ✅ FUNCIONANDO
- **URL**: https://ecoa.equipamentospsi.com (login, conexão Instagram, mídias, insights — tudo OK end-to-end).
- Repo standalone **só do ECOA** no GitLab: `git@gitlab.com:eliab1/ecoa.git` (branch `main`) — pasta local `C:\HD\Eliab\ecoa\`.
- Hospedado no **Dokploy** (servidor mdantas, IP `72.61.43.90`), project **`psi`**, domínio **equipamentospsi.com** (Cloudflare, DNS-only/nuvem cinza).
- 3 serviços: Redis + Backend (Dockerfile, path `/api`, porta 3005) + Frontend (Dockerfile, porta 3003).
- Lições de deploy documentadas no CLAUDE.md (context path `/`, node:22-alpine, Session Pooler Supabase IPv4, pool max 5, REDIS_HOST interno, API base relativa `/api`).
- Páginas públicas no ar: `/privacy` e `/data-deletion`. Ícone violeta cadastrado.

### 2.2 App Review da Meta — ✅ SUBMETIDO (aguardando resposta)
App Meta ID: `2047002089570738` (app "Ecoa"). Textos em `apps/ecoa-system/docs/APP_REVIEW.md`.

| Etapa | Status |
|---|---|
| Configurações do app | ✅ |
| Uso permitido (6 permissões + vídeo real) | ✅ |
| Tratamento de dados | ✅ |
| Instruções da análise | ✅ |
| **Verificação de negócio (CNPJ OTEC)** | ✅ **APROVADA em 02/07/2026** |
| **Análise do app (6 permissões)** | ✅ **ENVIADA em 07/07/2026 — "Análise em andamento" (até ~20 dias)** |

- **6 permissões submetidas (Login do Facebook)**: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`, `business_management`, `public_profile`.
- Screencast REAL do ECOA anexado (login → Conectar Instagram → Minhas mídias → gráfico de métricas → Visão geral).
- Empresa verificada: **OTEC ORGANIZAÇÃO TÉCNICA DE CADASTROS LTDA**, CNPJ **02.237.162/0001-73**, Goiânia-GO.

## 3. PRÓXIMOS PASSOS (o que falta)

1. **Aguardar a resposta da Meta** (até ~20 dias) — chega por e-mail (`eliab@techbs.com.br`) + sininho 🔔 no painel.
2. **Se APROVADO** ✅ → menu **"Publicar"** (hoje "Não publicado") → colocar em **modo Live** → qualquer usuário conecta o Instagram (não só testadores).
3. **Se pedir AJUSTE** ⚠️ → a Meta indica o que faltou (geralmente vídeo ou descrição). Corrigir e reenviar (não perde o já feito).
4. Opcional: criar página `/terms` (Termos de Serviço) — hoje o campo aponta pra facebook.com como placeholder.

## 4. Credenciais / dados úteis (NÃO são secrets sensíveis)

- **Login de teste do ECOA (produção)**: `eliab@techbs.com.br` / `Ecoa@2026`.
- Backend porta **3005** (3001 conflita com Docker Desktop).
- Dokploy: `https://dokploy.mdantas.com.br` (conta `eliab@techbs.com.br`).
- GitLab: `eliab1/ecoa`, via **Deploy Key** (não OAuth).
- Secrets reais (DATABASE_URL, META_APP_SECRET, IG_TOKEN_ENCRYPTION_KEY, SMTP) ficam **só na aba Environment do Dokploy** e no `.env` local (gitignored) — **nunca no repo, nunca colar em chat**.
- SMTP correto: `smtp.equipamentospsi.com`.

## 5. Observação sobre a memória do Claude

A memória automática fica em `...\projects\c--HD-Eliab-KAZATEM\memory\` — atrelada ao **caminho da pasta**. Ao renomear para GitPSI, o novo projeto (`c--HD-Eliab-GitPSI`) começa com memória vazia. Este resumo + `apps/ecoa-system/docs/RETOMAR.md` e `docs/APP_REVIEW.md` no repo são a fonte de verdade.

---

### Primeira mensagem sugerida na nova conversa
> "Renomeei a pasta de KAZATEM para GitPSI. Segue o RESUMO_CONVERSA.md da conversa anterior. O App Review do ECOA na Meta foi ENVIADO em 07/07/2026 e está 'Análise em andamento' (até ~20 dias); a verificação de negócio (CNPJ OTEC) já foi aprovada. Quando a Meta responder: se aprovar, publicar o app em modo Live; se pedir ajuste, corrigir. Me ajude a continuar."
