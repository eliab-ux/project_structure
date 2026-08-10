# VEERTEX — Instruções para o Claude Code (VS Code)

> **Escopo deste documento:** desbloquear a verificação da **F1** sem depender da porta
> externa do Postgres, e executar a **F2** (module / account_module + guard de módulo).
> **Base normativa:** `CLAUDE.md` (raiz do monorepo) e `apps/Veertex/Requisitos/01_Veertex_Core.md`.
> Em conflito, o `CLAUDE.md` prevalece.

---

## 0. Regras de execução (valem para tudo abaixo)

1. **Não invente requisito.** Todo item implementado tem origem rastreável em
   `01_Veertex_Core.md` ou neste documento. Se faltar informação, **pare e pergunte** —
   não escolha um default silencioso. Default não pedido é bug, não conveniência.
2. **Não altere documento baselinado** (`00_Veertex_Visao_Geral.md`, `01_Veertex_Core.md`)
   sem aprovação explícita.
3. **Não faça merge da F2 antes da F1 estar verde.** F2 vive em branch própria
   (`feat/f2-modules`), rebaseada sobre a F1.
4. **Nenhum segredo no repositório.** Connection strings e senhas só no Environment do
   Dokploy ou no `.env` local (gitignored). `.env.example` sempre atualizado.
5. **Ao terminar cada bloco**, reporte: arquivos criados/alterados, comandos executados,
   saída dos gates, e o que ficou pendente. Sem "concluído" sem evidência.

---

## Bloco A — Fechamento da verificação da F1 (prioridade 1)

### Estado atual (ago/2026)

O runner **já existe**: `apps/Veertex/backend/deploy/verify/run-verification.sh` (sh POSIX
— a imagem é alpine) + `deploy/verify/README.md`.

**Correção de premissa registrada:** a versão anterior deste documento mandava rodar
`migration:up`, `verify:isolation`, `test:integration` e `seed:dev` de dentro do container
do backend. **Isso não funciona** — a imagem de runtime contém apenas `dist/`,
`node_modules/`, `packages/` e os `package.json`; não há `src/`, `test/`, `tsconfig*.json`
nem `mikro-orm.config.ts`. A solução adotada (correta) foi extrair as asserções do §7.2
para `rls-behavior-checks.ts`, compilar para `dist`, e ter o spec do jest consumindo o
**mesmo módulo** — uma definição, dois invólucros. Alvos dist: `verify:rls:prod`,
`smoke:auth:prod`, `seed:dev:prod`.

**Coordenadas internas confirmadas** (tela do Dokploy):

- Internal Host: **`veertex-veertex-eeilbu`** · Internal Port: **`5432`** · DB: **`veertex`**
- `DATABASE_URL=postgresql://veertex_app:<SENHA_APP>@veertex-veertex-eeilbu:5432/veertex`
- `DATABASE_URL_MIGRATIONS=postgresql://veertex_owner:<SENHA_OWNER>@veertex-veertex-eeilbu:5432/veertex`
- Senha com caractere especial → URL-encode. De dentro do próprio container do Postgres o
  host é `127.0.0.1`.
- **A porta externa 5422 é irrelevante para esta fila.** Não é bloqueio da F1.

### A1. Ajuste do gate — abortivo onde há dependência

O runner hoje é integralmente não-abortivo (reporta todas as falhas e sai ≠ 0). O
argumento é válido para etapas **independentes** e fica. Mas duas dependências não são
preferência:

- **Migration falhou** → tudo depois é ruído. Aborta.
- **`verify:isolation` falhou** → a fronteira de isolamento está quebrada, e seguir para
  o seed **grava dados num banco sem fronteira**. Aborta antes de qualquer etapa que
  escreve.

Desenho final: **misto** — não-abortivo nas verificações independentes, abortivo em
migration e em `verify:isolation` antes das etapas de escrita.

### A2. Migration — caminho e usuário

O relatório do runner lista os alvos dist e **nenhum de migration**. Explicitar:

- Como o schema é aplicado no container (se é o `AUTO_MIGRATE` do bootstrap, dizer isso).
- Com **qual usuário** — deve ser `veertex_owner` via `DATABASE_URL_MIGRATIONS`. O
  `veertex_app` não tem DDL, por desenho da F1.
- Documentar no `README.md` do `deploy/verify/`.

### A3. Pré-condições que ficam (já implementadas — não regredir)

- **Abortar se `DATABASE_URL` e `DATABASE_URL_MIGRATIONS` tiverem o mesmo usuário.** Dono
  de tabela ignora policy: a fila passaria verde com RLS desligado. Imprime nome de
  usuário, nunca senha.
- **Asserção do escopo morrendo no `COMMIT`** — prova que o `set_config` é
  transaction-local. Se fosse de sessão, vazaria para a próxima requisição que pegasse a
  mesma conexão do pool, e nenhum teste sequencial encontra o furo.
- **Etapa de smoke somente leitura** — não troca senha, não cria conta.
- **Etapa WhatsApp manual**: `request-password-reset` responde 204 exista ou não a conta
  (anti-enumeração, `CLAUDE.md`), então teste sobre status prova zero.

### A4. `seed:dev:prod` é temporário

Rotina que popula dados de desenvolvimento passou a existir dentro do runtime que atende
cliente. **Aceitável para fechar a F1; inaceitável a partir do primeiro cliente** — mesmo
gatilho do precedente de invalidação de tokens. Registrar no ADR.

### A5. Separação por commit (estrutura, não disciplina)

Hoje `apps/Veertex/` é integralmente untracked na branch `Deploy` (`git ls-files` → 0), F1
e F2 coexistem na mesma árvore, e isolar a F1 exige mover arquivos para diretório
temporário — frágil.

- Commit 1: **F1** na `Deploy`.
- Commit 2: **F2** em `feat/f2-modules`, criada a partir do commit 1.

Com isso, rodar a F1 pura é `checkout` do commit da F1.

**DoD do Bloco A:** commits feitos; migration documentada; gate misto aplicado; execução
no container do mdantas com `verify:isolation` saindo **0**, asserções do §7.2 passando,
seed aplicado e smoke de auth verde. **Só então a F1 fecha.**

---

## Bloco B — F2: `module` / `account_module` + `@RequireModule`

Executar em branch `feat/f2-modules`, **sem merge** enquanto a F1 não fechar.

**Fonte normativa:** `01_Veertex_Core.md` §3.7, §3.1, §3.3, §4, §5 e critério de aceite
§7.4. Toda regra abaixo cita sua origem. **Nada aqui é inferência de best practice** —
os pontos sem fonte estão isolados no §B4 e dependem de decisão do Eliab.

### B1. Modelo de dados

**`module` — catálogo (§3.7):** `code`, `name`, `depends_on[]`, `core` (boolean).
É catálogo global do produto, **não** tabela de negócio por conta — não leva
`account_id` nem RLS. Semeado por migration idempotente e reexecutável.

**`account_module` — ativação por conta (§3.7):** vínculo conta × módulo. É tabela de
negócio, portanto **`account_id` NOT NULL indexado** (§3.1) e entra nas **duas camadas
de isolamento** da F1: filtro global do MikroORM **e** RLS no PostgreSQL. Tabela nova
sem RLS quebra o invariante que o `verify:isolation` protege.

**Dependências a semear (§3.7, literal):** `COB→FIN` · `ROT→EST` · `PDV→EST` ·
`CAN→VND+EST` · `FUNIL→CRM`.

**RESOLVIDA** (Eliab, 10/08/2026): **PDV, FUNIL e CRM ficam fora do catálogo**, e portanto
as arestas `PDV→EST` e `FUNIL→CRM` não são semeadas. Elas ficam **registradas como
comentário** em `modules.catalog.ts`, citando o §3.7, para entrarem junto com o módulo.

O motivo de não semear: a FK é `account_modules.module_code → modules.code`, então a
aresta exige que o módulo alvo exista na tabela — e um módulo no catálogo é um módulo que a
conta consegue ativar. Adicionar PDV agora criaria um toggle que liga algo sem código
atrás. Semeadas hoje: `COB→FIN` · `ROT→EST` · `CAN→VND+EST`.

**Catálogo da V1:** os códigos completos não estão enumerados em `01_Veertex_Core.md`.
Extraia de `00_Veertex_Visao_Geral.md`. **Se não estiverem lá, pare e pergunte** — não
deduza a lista a partir dos nomes dos documentos de requisitos.

### B2. Regras de ativação

- `ToggleModule` **valida dependência e plano** (§4 e §3.7).
- **Teto de módulos vem de `plan.limits` jsonb** (§3.1) — ver lacuna B4.1.
- **CORE é sempre ativo, não desativável** (cabeçalho do documento + `core: true`
  em §3.7). O guard trata módulo `core` como sempre ativo; `@RequireModule` só decora
  controller de **módulo opcional** (§3.3).
- **Desativar preserva dados** (§3.7). Nenhum delete, nenhum cascade. Os dados ficam
  inacessíveis enquanto o módulo estiver inativo (403 nos endpoints) e voltam intactos
  na reativação — é exatamente o critério §7.4 ("reativar restaura tudo").

### B3. Guard `@RequireModule`

- **403 quando o módulo está inativo** (§3.7 e §7.4 — literal no documento; não há
  decisão a tomar aqui).
- **Server-side é a fronteira de segurança.** O sumiço do item de menu (§7.4) é
  consequência de UX, nunca o controle. O menu deriva de **plano ∩ conta ∩ papel**
  (§3.7) e é servido pelo backend — ver B4.3.
- Composição com os guards da F1, nesta ordem: `JwtAuthGuard` → `@RequireModule` →
  guard de papel/permissão (§3.3).
- **O estado do módulo VAI no JWT** (`modules`, resolvido no login e no refresh) —
  decisão aprovada em 09/08/2026 e registrada em
  `apps/Veertex/Requisitos/ADR-0001_Modulos_no_JWT.md`. Motivo: os guards rodam **antes**
  da transação que estabelece o contexto do RLS, então consultar a fonte de verdade dentro
  do guard exigiria abrir transação própria em todo request. Alternativas B e C descartadas
  no ADR.
  > **Esta regra substitui a versão anterior deste documento**, que proibia `modules` no
  > token. A proibição partia de uma leitura do §7.4 sem conhecer a restrição de ordem
  > guard/RLS. Consequência aceita: existe janela até o refresh — ver **B4.4**.

### B4. Lacunas — pare e pergunte antes de implementar

Estes três pontos **não têm resposta em `01_Veertex_Core.md`**. Não escolha um default.

**B4.1 — RESOLVIDA.** `plan.limits.modules` é **lista de códigos de módulo**, não
contagem. Confirmado pela implementação e pela ordem do seed (módulos antes de planos).

**B4.2 — RESOLVIDA** (Eliab, 10/08/2026). **Bloquear**, com a mensagem **nomeando os
dependentes ativos**. Cascata desligaria num clique um módulo que o cliente estava usando
sem ter pedido nada sobre ele; permitir deixaria o dependente ativo e quebrado. A
`ListModules` já devolve `blockingDependents` para a UI mostrar o impedimento antes do
clique. Implementado em `toggle-module.use-case.ts`.

**B4.3 — RESOLVIDA** (Eliab, 10/08/2026). **Não se expõe endpoint de menu efetivo.** O
claim `modules` do token já é a fonte única, e a tela de administração usa o
`ModuleController` existente (`GET /modules`), que devolve o catálogo com o estado de cada
módulo na conta — incluindo `availableInPlan`, `blockingDependents` e
`missingDependencies`. `GetEffectiveModules` permanece um caso de uso **interno**, chamado
por login e refresh. Um segundo endpoint devolvendo a mesma interseção seria uma segunda
fonte para a mesma verdade.

**B4.4 — RESOLVIDA** (Eliab, 10/08/2026). O critério **§7.4 foi emendado** no
`01_Veertex_Core.md`, com aprovação registrada no próprio arquivo:

> "Módulo desativado → 403 no endpoint a partir da renovação do token, que o `ToggleModule`
> força para os usuários da conta; item some do menu; reativar restaura tudo."

O teste do §7.4 encoda o refresh explicitamente
(`test/integration/module-lifecycle.spec.ts`).

> ⚠️ **Ressalva sobre "para os usuários da conta"** — a redação descreve mais do que a
> Opção A entrega. O `ToggleModule` devolve `requiresTokenRefresh` e o frontend renova a
> sessão **de quem fez o toggle**; os **demais** usuários da conta convergem ao renovarem os
> próprios tokens (≤ 15 min). Forçar renovação imediata para todos exigiria o guard
> consultar um "epoch" da conta no banco a cada request — que é precisamente a Opção B,
> descartada no ADR-0001. Ver ressalva registrada ao final desta seção.

### B5. Entregáveis

- Entidades de domínio puras + ORM entities + mappers (domínio sem decorators).
- Repositórios com **port por Symbol**; use case `ToggleModule` (§4).
- Guard `@RequireModule` em `infrastructure/security/`.
- Migration versionada MikroORM + seed idempotente do catálogo e das dependências.
- **Atualizar `verify:isolation`** para cobrir `account_module`.
- Testes: unitário do guard (ativo / inativo / conta sem vínculo / módulo `core`);
  integração do isolamento de `account_module` entre contas; e o caminho do critério
  §7.4 (desativar → 403 → reativar → 200 com os dados intactos).

**DoD do Bloco B:** `typecheck`, `lint` e testes verdes; `verify:isolation` cobrindo
`account_module` e saindo 0; nenhum controller de módulo opcional sem `@RequireModule`;
critério §7.4 coberto por teste; lacunas do §B4 respondidas pelo Eliab antes do código
correspondente.

---

## Anexo — Diagnóstico da porta 5422 (fora do escopo do agente)

Isso é infraestrutura no Dokploy/provedor, não código. **Não é bloqueio da F1** (ver
Bloco A). Checar, nesta ordem:

1. No serviço Postgres do Dokploy, o campo **External Port** está preenchido com `5422`?
   A tela mostrando apenas "porta container 5432" sugere que **não foi aplicado**.
2. Porta externa no Dokploy **só passa a valer após redeploy** do serviço. Salvar não
   basta.
3. No servidor: `docker ps` deve mostrar `0.0.0.0:5422->5432/tcp` no container do
   Postgres. Se não mostrar, o problema é o passo 1/2 — não é firewall.
4. Só se o passo 3 estiver correto, investigar firewall: `ufw status` / `iptables -L` no
   host, e o firewall do painel do provedor (bloqueio de portas altas de entrada é
   comum, e o ICMP bloqueado que você viu indica política de provedor ativa).

**Recomendação:** deixar a porta **fechada**. Expor Postgres na internet é superfície de
ataque permanente em troca de conveniência pontual. O Bloco A já entrega o caminho
interno; para acesso local eventual, um túnel SSH resolve sem publicar a porta.
