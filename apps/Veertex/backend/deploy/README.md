# Deploy do Veertex

## O modelo: um passo manual, o resto automático

```
PASSO ÚNICO DE PROVISIONAMENTO  (manual, superusuário, uma vez por banco)
  └─ deploy/sql/001_create_roles.sql → cria veertex_owner + veertex_app + o banco

BOOTSTRAP  (automático, a cada start do backend, sob advisory lock)
  ├─ 1. aplica migrations pendentes         (pula se AUTO_MIGRATE=false)
  ├─ 2. VERIFICA os invariantes de isolamento → falhou, o processo ABORTA
  └─ 3. reconcilia o catálogo de planos     (idempotente)

PRIMEIRA CONTA  (manual, uma vez)
  └─ npm run create:account
```

**Por que o passo 1 continua manual:** criar papéis e banco exige superusuário, e o backend jamais
deve carregar essa credencial. Automatizá-lo significaria dar ao processo que atende a internet o
poder de criar papéis — precisamente o oposto do que os dois papéis existem para garantir.

## 1. Provisionamento (uma vez por banco)

```bash
psql "postgresql://postgres:<senha-do-postgres>@<host>:5432/postgres" \
  -v ON_ERROR_STOP=1 \
  -v db_name=veertex \
  -v owner_password=SENHA_DO_OWNER \
  -v app_password=SENHA_DO_APP \
  -f backend/deploy/sql/001_create_roles.sql
```

**Senhas SEM aspas no `-v`.** O script usa `:'variavel'`, que já transforma o valor num literal SQL
escapado; aspas embutidas virariam parte da senha. Se houver caractere especial do shell, proteja
com aspas **duplas**: `-v owner_password="a senha"`.

Ao final o script imprime uma conferência. **`rolsuper` e `rolbypassrls` precisam ser `f` para os
dois papéis** — um `t` em `rolbypassrls` no `veertex_app` tornaria todo o RLS decorativo.

> O script não usa bloco `DO $$ … $$`, e isso é intencional: o psql **não** interpola variáveis
> dentro de strings dollar-quoted, então `:owner_password` chegaria literal ao servidor e o comando
> falharia com `syntax error at or near ":"`. A forma correta — montar o comando com `format()` numa
> consulta comum e executá-lo com `\gexec` — está no arquivo, comentada.

## 2. Bootstrap automático no start

Nada a rodar: o backend faz sozinho, antes de aceitar a primeira requisição.

| Passo | O que faz | Se falhar |
|---|---|---|
| 1 | `migrator.up()` com `DATABASE_URL_MIGRATIONS` | aborta |
| 2 | `verifyIsolationInvariants` | **aborta com o detalhe de cada violação** |
| 3 | seed idempotente do catálogo de planos | aborta |

Tudo dentro de um **advisory lock** do Postgres. É ele que torna a migration no start segura com
várias réplicas: a primeira migra, as demais bloqueiam no lock e, ao acordar, não encontram nada
pendente. Sem o lock, dois processos aplicariam o mesmo lote ao mesmo tempo.

O passo 2 é o que impede o pior cenário: subir e atender requisições enquanto o isolamento entre
contas não está garantido — uma falha invisível até um cliente enxergar dado de outro.

**Verificação avulsa** (mesmas checagens, fora do boot):

```bash
npm run verify:isolation        # dev
npm run verify:isolation:prod   # produção, a partir do dist/
```

### O que a verificação confere

| Invariante | Por quê |
|---|---|
| Toda tabela de `public` pertence a `veertex_owner` | dono lê sem filtro; tabela do papel de runtime = RLS inútil para ela |
| Ambos os papéis sem `SUPERUSER` e sem `BYPASSRLS` | qualquer um dos dois ignora policies incondicionalmente |
| Toda tabela com `account_id` (+ `accounts`) com RLS ligado **e ao menos uma policy** | derivado do schema, não de lista fixa: migration futura que esquecer a policy é pega aqui |
| `veertex_app` sem `DELETE`/`TRUNCATE` | exclusão no Veertex é soft delete (UPDATE) |
| `veertex_auth_find_user_by_email` é `SECURITY DEFINER`, do owner, com `search_path` fixo | é a única passagem sancionada pelo RLS; sem `search_path` fixo, um schema plantado sequestra a resolução de nomes dentro dela |

O F1 usa `ENABLE ROW LEVEL SECURITY`, não `FORCE` — seguro por um único fato: a aplicação nunca
conecta com um papel capaz de furar as policies. Esse fato mora **fora do código**, em quem é dono
da tabela e em quais atributos e grants os papéis carregam. Um `GRANT` digitado à mão ou um
`ALTER ROLE … BYPASSRLS` posto para depurar e nunca revertido transforma o RLS em enfeite sem
alterar uma linha de TypeScript. Nenhum build perceberia. Esta verificação percebe.

### `AUTO_MIGRATE=false`

Desliga **apenas** o passo 1, para deploy controlado com migration aplicada fora de banda
(`npm run migrate:prod`). Os passos 2 e 3 continuam rodando: subir sem isolamento verificado nunca
é aceitável.

Só o literal `'false'` desliga — `0`, `no` ou vazio mantêm o padrão. Um typo capaz de desligar a
migration silenciosamente faria a aplicação subir contra um schema atrasado.

> ⚠️ **Custo de segurança do auto-migrate, explícito.** Com o passo 1 ligado, o processo da API
> precisa de `DATABASE_URL_MIGRATIONS` — uma credencial capaz de DDL. Isso reduz de verdade o que o
> desenho de dois papéis oferece: uma API comprometida passa a poder `DROP TABLE`, o que antes não
> podia. Mitigações aplicadas: a conexão de owner é aberta só no bootstrap e fechada em seguida, e a
> variável é removida de `process.env` logo após o uso. Nenhuma das duas é hermética — estreitam a
> janela, não a fecham. Com `AUTO_MIGRATE=false` e as migrations fora de banda, a postura anterior
> é restaurada por inteiro.

### 📌 Decisão datada — revisar antes do primeiro cliente em produção

**09/08/2026 — Eliab.** `AUTO_MIGRATE=true` é aceito **para agora**, na fase sem clientes, em troca
de operação sem passo manual.

**Quando houver clientes em produção, a postura muda:** `AUTO_MIGRATE=false`, e a migration passa a
ser um **passo de release** — aplicada deliberadamente, com o schema conferido antes, e não como
efeito colateral de um container subindo. A partir daí o processo que atende a internet deixa de
carregar credencial com DDL, que é o ponto todo dos dois papéis.

A verificação de isolamento (passo 2) **não muda** em nenhum dos dois regimes: continua rodando a
cada boot e continua abortando o processo.

## 3. Primeira conta

```bash
cd apps/Veertex/backend
npm run create:account -- \
  --account-name "Tudodicasa" \
  --account-document "12345678000195" \
  --plan COMPLETO \
  --company-legal-name "Tudodicasa Comércio Ltda" \
  --company-document "12345678000195" \
  --tax-regime SIMPLES \
  --state-registration-exempt \
  --street "Av. Central" --number "1000" --district "Centro" \
  --city "Goiânia" --state GO --zip "74000000" --ibge "5208707" \
  --admin-name "Eliab" \
  --admin-email "eliab@exemplo.com.br" \
  --admin-phone "62999999999" \
  --admin-password "<senha-forte>"
```

Transacional: conta, primeira empresa, os sete papéis padrão e o usuário admin são criados juntos ou
nada é criado.

> **Por que CLI e não endpoint:** todo INSERT do onboarding é para um tenant que ainda não existe,
> logo não há escopo a estabelecer e o RLS recusaria as escritas sob o papel de runtime. Expor isso
> como rota HTTP exigiria abrir um buraco exatamente no isolamento que o F1 constrói. O console de
> plataforma (fase 2) e o self-service com quiz de segmento (onda do onboarding) terão caminho
> próprio e deliberado.

## 4. Desenvolvimento local

```bash
npm run seed:dev          # duas contas de demonstração
npm run test:integration  # teste de isolamento (§7.2) — precisa das duas connection strings
```

O seed cria **duas** contas de propósito: a maior parte dos bugs de multi-tenancy só é visível
quando existe um segundo tenant para vazar. Com uma conta só, uma query sem escopo devolve o mesmo
resultado de uma escopada.

O teste de integração verifica os invariantes no `beforeAll` e aborta o suite se o banco estiver mal
provisionado — um suite verde contra um banco sem isolamento seria pior que nenhum teste. Para pular
conscientemente (máquina sem banco), `VEERTEX_SKIP_DB_TESTS=true`.

## 5. Dokploy — runbook de `veertex.techbs.com.br`

> Definido por Eliab em 20/08/2026: **um hostname só**, `veertex.techbs.com.br`, com o Traefik
> roteando `/api` para o backend e `/` para o frontend. É por isso que o frontend **não** precisa de
> `NEXT_PUBLIC_API_URL`: o `services/api.ts` usa `/api` relativo.

**Project no Dokploy:** `Veertex e Kortex`, environment `production` — o mesmo que hospeda o Kortex.
Serviços de lá: `kortex-frontend`, `kortex-backend`, `kortex-postgres` e **`Veertex-postgres`**.

**Nomes dos serviços a criar:** `veertex-backend` e `veertex-frontend`, seguindo a convenção do
Kortex. O nome importa pouco para o Traefik e muito para quem olha a lista às três da manhã.

**Repositório que o Dokploy clona:** `git@gitlab.com:eliab1/veertex.git`, branch `main`. É um
**espelho de conteúdo** gerado por `./apps/Veertex/deploy/publish-mirror.sh` — nunca editado à mão.

### Ordem, e ela importa

| # | Passo | Onde | Por que nesta ordem |
|---|---|---|---|
| 1 | DNS: registro **A** `veertex` → `72.61.43.90`, **nuvem CINZA** | Cloudflare (`techbs.com.br`) | O Let's Encrypt precisa do DNS resolvendo. Com "Proxied" (laranja) o certificado **não é emitido** |
| 2 | Criar o **Postgres** (Database → Postgres) | Dokploy | ✅ **feito** — `Veertex-postgres` existe desde 08/08/2026. O backend aborta no boot se não alcançar o banco, então ele precisa vir antes |
| 3 | Provisionar papéis (`001_create_roles.sql`) | psql, **superusuário**, uma vez | Sem `veertex_owner`/`veertex_app` o boot falha na verificação de isolamento, que é o comportamento correto. **Confira se já foi feito** — ver abaixo |
| 4 | Criar o **Backend** (Application) e preencher Environment | Dokploy | — |
| 5 | Criar o **Frontend** (Application) | Dokploy | — |
| 6 | Deploy dos dois, e conferir o **Logs** do backend | Dokploy | O bootstrap migra, **verifica o isolamento e ABORTA se falhar** — o log é onde isso aparece |
| 7 | Primeira conta: `npm run create:account:prod -- …` | dentro do container | Não há endpoint: todo INSERT do onboarding é para um tenant que ainda não existe |

### Passo 3 — o provisionamento já foi feito neste banco?

O `Veertex-postgres` existe desde antes desta fatia, então a resposta pode ser sim. Uma consulta
responde, e ela é a mesma que o boot vai fazer:

```sql
select rolname, rolsuper, rolbypassrls
  from pg_roles
 where rolname in ('veertex_owner', 'veertex_app');
```

| Resultado | O que fazer |
|---|---|
| duas linhas, `rolsuper` e `rolbypassrls` = `f` nas duas | nada — pule para o passo 4 |
| nenhuma linha | rodar o script abaixo |
| `rolbypassrls` = `t` em qualquer uma | **parar**: com `BYPASSRLS` o RLS é decorativo. `alter role … nobypassrls` antes de seguir |

Confira também se o banco `veertex` existe (`\l` no psql). O script cria os dois papéis **e** o
banco; rodá-lo num banco que já os tem é seguro, mas ele vai reclamar do que já existe.

### Passo 3b — rodando o script sem ter o arquivo no servidor

O `001_create_roles.sql` vive no repositório e **não** vai para a imagem (`deploy/` fica fora do
runtime). No servidor, então, ele não está em disco — e o script depende de variáveis `-v` do psql,
que só existem quando ele é invocado com `-f`.

A saída é o **prelúdio com `\set`**: as mesmas variáveis, definidas na sessão. Assim o arquivo pode
ser colado inteiro num `psql` interativo, que é o que o terminal do Dokploy oferece.

**1.** Gere duas senhas fortes e DIFERENTES, na sua máquina:

```bash
openssl rand -base64 24   # veertex_owner
openssl rand -base64 24   # veertex_app
```

**2.** No Dokploy, abra o terminal do serviço `Veertex-postgres` e entre no psql como superusuário:

```bash
psql -U postgres
```

**3.** Cole o prelúdio, trocando os três valores:

```sql
\set ON_ERROR_STOP on
\set db_name veertex
\set owner_password 'SENHA_DO_OWNER'
\set app_password 'SENHA_DO_APP'
```

Aqui as senhas vão **entre aspas simples**, ao contrário da forma com `-v` (onde vão sem aspas). O
motivo é o mesmo nas duas: o script usa `:'variavel'`, que transforma o VALOR num literal SQL
escapado. Com `-v` o shell já entrega o valor cru; com `\set` interativo, sem as aspas o psql
engoliria a senha até o primeiro espaço.

**4.** Cole o conteúdo de `apps/Veertex/backend/deploy/sql/001_create_roles.sql` **a partir da linha
`\set ON_ERROR_STOP on`** (o cabeçalho é comentário, pode ir junto). Ele cria os papéis, cria o
banco, dá `\connect` nele e ajusta schema, revokes, grants e privilégios padrão.

**5.** A última consulta do arquivo imprime a conferência. **`rolsuper` e `rolbypassrls` têm de ser
`f` nas duas linhas.**

⚠️ **As senhas ficam no scrollback do terminal e no `~/.psql_history` do container.** Depois de
terminar:

```sql
\q
```
```bash
rm -f ~/.psql_history
```

Não é paranoia: o histórico do psql é texto puro, e a senha do `veertex_owner` é a credencial com
DDL — a única capaz de `DROP TABLE` neste sistema. Ela existir num arquivo dentro do container do
banco é exatamente o tipo de coisa que ninguém procura.

### Passo 3c — a forma canônica, quando o arquivo estiver no servidor

Se você tiver o repositório na máquina do mdantas (ou copiar o arquivo com `docker cp`), a forma do
cabeçalho do script é a preferida — as variáveis vêm da linha de comando e não passam pelo histórico
da sessão:



Use o **Internal Host** que o Dokploy mostra na página do serviço (não o nome amigável), e rode de
dentro da rede do servidor (por exemplo, `docker exec` no container do Postgres):

```bash
psql "postgresql://postgres:<senha-do-postgres>@localhost:5432/postgres" \
  -v ON_ERROR_STOP=1 \
  -v db_name=veertex \
  -v owner_password=SENHA_DO_OWNER \
  -v app_password=SENHA_DO_APP \
  -f 001_create_roles.sql
```

O script imprime uma conferência no fim. **`rolsuper` e `rolbypassrls` têm de ser `f` nos dois
papéis** — um `t` em `rolbypassrls` no `veertex_app` torna todo o RLS decorativo, e nada no código
perceberia.

O arquivo não vai na imagem (`deploy/` fica fora do runtime), então copie-o do repositório:
`apps/Veertex/backend/deploy/sql/001_create_roles.sql`.

### Passos 4 e 5 — os dois serviços

| | Backend | Frontend |
|---|---|---|
| Build Type | Dockerfile | Dockerfile |
| **Dockerfile Path** | `apps/Veertex/backend/Dockerfile` | `apps/Veertex/frontend/Dockerfile` |
| **Docker Context Path** | `/` | `/` |
| Domain | `veertex.techbs.com.br` | `veertex.techbs.com.br` |
| Path | **`/api`** · Strip Path **OFF** | `/` |
| Container Port | **3020** | **3021** |
| HTTPS | ON (Let's Encrypt) | ON |

**Strip Path OFF** porque o backend usa `setGlobalPrefix('api')`: com o strip ligado, o Traefik
entregaria `/contacts` para uma aplicação que só responde em `/api/contacts`, e tudo daria 404.

### Environment do backend — o bloco inteiro

Valores entre `<>` são segredos e ficam **apenas na UI do Dokploy**. Nunca neste arquivo, nunca no
repositório.

```env
NODE_ENV=production
PORT=3020
HOST=0.0.0.0
VEERTEX_APP_NAME=Veertex

# Dois papéis, duas connection strings — apontar as duas para o mesmo usuário
# faz o RLS parar de valer para a aplicação (o dono ignora as policies).
DATABASE_URL=postgresql://veertex_app:<SENHA_DO_APP>@<INTERNAL_HOST>:5432/veertex
DATABASE_URL_MIGRATIONS=postgresql://veertex_owner:<SENHA_DO_OWNER>@<INTERNAL_HOST>:5432/veertex
DATABASE_OWNER_ROLE=veertex_owner
DATABASE_APP_ROLE=veertex_app
AUTO_MIGRATE=true

JWT_ACCESS_SECRET=<segredo-forte-1>
JWT_REFRESH_SECRET=<segredo-forte-2-DIFERENTE-do-primeiro>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

CORS_ORIGIN=https://veertex.techbs.com.br
FRONTEND_URL=https://veertex.techbs.com.br

# Recuperação de senha por WhatsApp. A apikey é a DA INSTÂNCIA, nunca a global.
EVOLUTION_API_URL=https://evo2.techbs.com.br
EVOLUTION_SYSTEM_INSTANCE=<instancia-de-sistema>
EVOLUTION_SYSTEM_APIKEY=<apikey-da-instancia>

# A Mesa. Sem a chave, o adapter RECUSA a intenção — nunca cai para o determinístico.
INTENT_PARSER_DRIVER=gemini
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_API_KEY=<chave-do-gemini>
GEMINI_MODEL=gemini-2.5-flash
AUDIO_TRANSCRIPTION_ENABLED=false
```

**O frontend não precisa de nenhuma variável** — API relativa no mesmo domínio.

⚠️ **`DATABASE_URL_TEST` e `DATABASE_URL_MIGRATIONS_TEST` não vão para produção.** Elas existem para
a suíte, apontam para o banco de teste, e um valor delas em produção é uma connection string a mais
num lugar que não precisa dela.

### Depois do deploy — o que conferir no log, e nesta ordem

```
1. migrations aplicadas          → "Successfully migrated" / "no pending migrations"
2. ✅ isolamento íntegro          → se falhar, o processo ABORTA e a mensagem diz qual invariante
3. catálogo de planos reconciliado
4. servidor escutando em 3020
```

Se o passo 2 abortar, **não force o start**: a mensagem nomeia o invariante quebrado (tabela sem
policy, papel com `BYPASSRLS`, `veertex_app` com DELETE). Subir por cima disso é atender requisições
sem isolamento entre contas garantido — o único erro desta fila que não se desfaz relendo o log.

### Fila de verificação completa

`deploy/verify/README.md` — as seis etapas (migration, invariantes, comportamento do RLS, primeira
conta, smoke de autenticação, WhatsApp), com os comandos `:prod` que rodam de dentro do container.

## 5.1 Referência resumida do Dokploy

Estrutura: **Backend (Application)** + **Frontend (Application)**. Sem Redis no F1 — nenhum job
ainda; ele entra com a fatia que precisar de fila (geocodificação de endereço, no F2).

| Serviço | Dockerfile | Context Path | Domain | Container Port |
|---|---|---|---|---|
| Backend | `apps/Veertex/backend/Dockerfile` | `/` | `<sub>.<dominio>` · Path `/api` · Strip Path **OFF** | 3020 |
| Frontend | `apps/Veertex/frontend/Dockerfile` | `/` | `<sub>.<dominio>` · Path `/` | 3021 |

> ⚠️ **O caminho do Dockerfile mudou em 18/08/2026.** O espelho publicado passou a ser o recorte
> do MONOREPO (`packages/` + `apps/Veertex/` + manifests da raiz), e não mais o subtree com o app
> na raiz. Um serviço configurado com `backend/Dockerfile` falha com "Dockerfile not found" e o
> container antigo continua no ar — o deploy não quebra nada, ele simplesmente não acontece.

**Docker Context Path = `/`** (a raiz do repo) nos dois — sem isso os `COPY` do monorepo falham.

DNS na Cloudflare: registro **A** → `72.61.43.90`, **Proxy status = DNS only (nuvem cinza)**. Com
"Proxied" o Let's Encrypt não emite o certificado.

### Variáveis obrigatórias (aba Environment)

| Variável | Observação |
|---|---|
| `DATABASE_URL` | usuário **veertex_app** |
| `DATABASE_URL_MIGRATIONS` | usuário **veertex_owner** — necessária no boot mesmo com `AUTO_MIGRATE=false` (a verificação precisa dela) |
| `AUTO_MIGRATE` | `true` (padrão) ou `false` para deploy controlado |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | dois segredos fortes e **diferentes** |
| `CORS_ORIGIN` | domínio real do frontend, sem `*` |
| `EVOLUTION_API_URL` / `EVOLUTION_SYSTEM_INSTANCE` / `EVOLUTION_SYSTEM_APIKEY` | recuperação de senha por WhatsApp; a apikey é a **da instância**, nunca a global |

Sem as variáveis do Evolution a aplicação sobe normalmente, e o pedido de recuperação de senha
responde "não foi possível enviar agora" — o restante do sistema não é afetado.

### A Mesa em produção — decisão antes de configurar

| Variável | Efeito |
|---|---|
| `INTENT_PARSER_DRIVER` | `gemini` (produção) ou `deterministic` (só suíte) |
| `GEMINI_API_KEY` | a chave do canal. **Sem ela o adapter RECUSA** |
| `GEMINI_API_URL` / `GEMINI_MODEL` | endpoint e modelo |
| `AUDIO_TRANSCRIPTION_ENABLED` | **`false`** — o caminho de áudio está parado e desligado (ADR-0005) |

⚠️ **O adapter determinístico NUNCA é fallback** (`CLAUDE.md`, regra 1). Se `GEMINI_API_KEY` faltar
com o driver `gemini`, a Mesa **recusa a intenção** em voz alta em vez de responder com um comando
enlatado por palavra-chave — falhar fechado é a escolha registrada. O resto do sistema (telas de
cadastro, autenticação) funciona sem a chave.

E `INTENT_PARSER_DRIVER=deterministic` em produção seria pior que não ter Mesa: ele devolveria
comando por palavra-chave chamando-o de tradução, e a procedência diria "ditado". **Nunca em
produção.**
