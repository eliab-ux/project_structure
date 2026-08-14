# Veertex — backend

NestJS + Fastify + MikroORM sobre PostgreSQL, arquitetura hexagonal (ver `CLAUDE.md` na raiz do
monorepo e `Requisitos/`).

## Os dois ambientes

| | Desenvolvimento e testes | Produção |
|---|---|---|
| Banco | Postgres local (`docker-compose.dev.yml`), `127.0.0.1:5433` | Postgres do Dokploy, host interno `veertex-veertex-eeilbu:5432` |
| Env | `.env.local` (gitignored) | aba Environment do Dokploy |
| Comandos | alvos sem `:prod` (ts-node, jest) | alvos `:prod` (a imagem só tem `dist/`) |
| Verificação | `npm run verify:isolation`, `verify:rls`, `test:integration` | `deploy/verify/run-verification.sh`, de dentro do container |

**Produção não é ambiente de desenvolvimento.** O que roda lá é a fila de verificação, de dentro do
container — ver [`deploy/verify/README.md`](deploy/verify/README.md).

## Subir o ambiente local

### 1. O Postgres

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml logs -f   # espere "database system is ready"
```

### 2. Provisionar os papéis

**O mesmo script do mdantas**, sem variante local:

```bash
docker exec -i veertex-pg-dev psql -U postgres -d veertex \
  -v ON_ERROR_STOP=1 \
  -v db_name=veertex \
  -v owner_password=SENHA_OWNER \
  -v app_password=SENHA_APP \
  -f /sql/001_create_roles.sql
```

O `-f /sql/...` usa o mount read-only que o compose cria para isso — deliberadamente **fora** de
`/docker-entrypoint-initdb.d`, onde rodaria só na primeira criação do volume e editar o script
depois não teria efeito. Os quatro `-v` são obrigatórios; sem eles o psql aborta em variável não
definida. Senhas **sem aspas**.

> **Git Bash no Windows:** prefixe com `MSYS_NO_PATHCONV=1`. Sem isso o shell converte
> `/sql/001_create_roles.sql` em `C:/Program Files/Git/sql/001_create_roles.sql` antes de o docker
> ver o argumento, e o psql responde `No such file or directory` — apontando para um caminho que
> ninguém escreveu. No PowerShell e no cmd não é necessário.
>
> ```bash
> MSYS_NO_PATHCONV=1 docker exec -i veertex-pg-dev psql -U postgres -d veertex \
>   -v ON_ERROR_STOP=1 -v db_name=veertex \
>   -v owner_password=SENHA_OWNER -v app_password=SENHA_APP \
>   -f /sql/001_create_roles.sql
> ```

Ao final o script imprime os quatro atributos dos dois papéis. **Todos precisam ser `f`.**

Um script por ambiente divergiria, e o que ficaria errado é o local — o que faria os testes de
isolamento passarem contra um banco cuja configuração não é a de produção. Ele é idempotente:
reexecutar é seguro.

Ao final imprime a verificação dos papéis. **`rolsuper` e `rolbypassrls` precisam ser `f` nos dois.**

### 3. `.env.local`

Copie o bloco de desenvolvimento do [`.env.example`](.env.example) para um `.env.local` novo
(gitignored) e preencha as senhas usadas no passo 2:

```
DATABASE_URL=postgresql://veertex_app:SENHA_APP@127.0.0.1:5433/veertex
DATABASE_URL_MIGRATIONS=postgresql://veertex_owner:SENHA_OWNER@127.0.0.1:5433/veertex
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
```

`.env.local` **ganha** de `.env` (ver [`src/config/load-env.ts`](src/config/load-env.ts)), e a
precedência é a mesma no ConfigModule, em cada CLI e no setup do jest — a lista vive num único
módulo justamente para não divergir entre pontos de entrada.

### 4. Schema — como `veertex_owner`

```bash
npm run migration:up
```

Lê `DATABASE_URL_MIGRATIONS`. **Nunca `veertex_app`:** ele não tem DDL, então o `CREATE TABLE`
falharia — e se não falhasse seria pior, porque tabela criada por ele teria **ele** como dono, e o
dono não é afetado pelas policies. O RLS deixaria de valer para a aplicação sem nada no código
mudar. É exatamente o invariante `ownership` que o `verify:isolation` detecta.

Se `DATABASE_URL_MIGRATIONS` faltar, o comando avisa em stderr antes de cair no fallback.

### 5. Verificar o isolamento — antes de confiar em qualquer teste

```bash
npm run verify:isolation
```

Confere que `veertex_app` não é `SUPERUSER`, não tem `BYPASSRLS`, `CREATEDB` nem `CREATEROLE`, e
**não é dono de nenhuma tabela**; que toda tabela com `account_id` tem RLS ligado com policy; que o
runtime não tem `DELETE`/`TRUNCATE`; e que a função de autenticação é `SECURITY DEFINER`, do owner,
com `search_path` fixo.

Se qualquer atributo vier `true`, **o RLS local não vale nada e os testes de isolamento passam sem
significado** — verde sem prova é pior do que vermelho.

### 6. Rodar os testes — no BANCO DE TESTE, como `veertex_app`

⚠️ **A suíte roda contra `veertex_test`, nunca contra `veertex`.** Ela APAGA CONTAS por desenho — é o
que dá sentido aos testes de isolamento entre tenants —, e enquanto os dois ambientes compartilhavam
o banco, rodar os testes destruía os dados de quem estivesse com a aplicação aberta. Aconteceu: o
login passou a responder `unknown_email` no meio de uma sessão porque a conta do `seed:dev` havia
sido apagada.

Provisione o banco de teste com o **mesmo** script de produção — é o artefato cujo comportamento os
testes de isolamento existem para verificar, então testar contra outro provisionamento anularia o
propósito:

```bash
docker exec -i veertex-pg-dev psql -U postgres -d postgres -v ON_ERROR_STOP=1   -v db_name=veertex_test -v owner_password=SENHA_OWNER -v app_password=SENHA_APP   -f - < deploy/sql/001_create_roles.sql
```

E aponte as duas variáveis no `.env.local` (os papéis são os mesmos; só o banco muda):

```env
DATABASE_URL_TEST=postgresql://veertex_app:SENHA_APP@127.0.0.1:5433/veertex_test
DATABASE_URL_MIGRATIONS_TEST=postgresql://veertex_owner:SENHA_OWNER@127.0.0.1:5433/veertex_test
```

O `test/setup-env.ts` troca `DATABASE_URL`/`DATABASE_URL_MIGRATIONS` por essas antes de qualquer spec
carregar, e **aborta o processo** se elas faltarem, se forem iguais às de desenvolvimento, ou se o
nome do banco não contiver `test`. A guarda é a parte que importa: o risco não é a troca falhar de
forma visível, é ela não acontecer e ninguém perceber — a suíte rodaria verde limpando o banco de
desenvolvimento exatamente como antes.

O schema do banco de teste é criado sozinho: o primeiro spec que sobe a aplicação aplica as
migrations no boot.

```bash
npm run test:integration   # §7.2 (isolamento) e §7.4 (ciclo de vida de módulo)
npm run verify:rls         # as mesmas asserções do §7.2, pelo CLI (usa o banco de DEV)
npm test                   # unitários
```

⚠️ **Rode a suíte sozinho** — sem `next build`, sem dev server, sem typecheck em paralelo. Duas
suítes medem tempo real (`login-throttle` e tudo que usa `runCli`) e falham por concorrência de CPU
sem que nada esteja errado no código: em 13/08/2026, a mesma árvore deu 14 falhas, depois 4, depois 0.
Falhou nelas? Rode só elas antes de investigar. Ver ADR-0003 e a regra 3 em `CLAUDE.md`.

Os testes de integração conectam com **as duas** credenciais: as fixtures são criadas pelo owner
(a conta não existe ainda, não há escopo a estabelecer), e as **asserções** rodam como
`veertex_app`. Asseverar como owner deixaria tudo verde com o isolamento desligado.

O suite **falha** se as duas variáveis estiverem ausentes, em vez de pular. Para pular
conscientemente: `VEERTEX_SKIP_DB_TESTS=true`.

### 7. Dados de desenvolvimento

```bash
npm run seed:dev           # duas contas de demonstração
```

Duas, porque quase todo furo de multi-tenancy só é observável quando existe um segundo tenant para
vazar. **Recusa se o banco tiver qualquer conta que não seja demo** — barreira de dado, não de
`NODE_ENV`, porque env é derrubável por quem invoca o comando e "este banco tem conta de cliente"
não é.

### 7b. Tradução por IA — o que cada adapter alcança

A Mesa (`/intent`) e a frase de permissões (`/roles/read-phrase`) traduzem texto por um port com dois
adapters. A escolha é da variável `INTENT_PARSER_DRIVER`, e o **padrão é o Gemini**: ambiente sem
chave FALHA visivelmente, em vez de parecer funcionar devolvendo comando enlatado por palavra-chave.

```env
GEMINI_API_KEY=...            # sem ela o canal não sobe (URL e modelo têm padrão)
INTENT_PARSER_DRIVER=         # vazio = Gemini · "deterministic" = palavra-chave (teste/dev sem chave)
```

⚠️ **O tradutor determinístico cobre APENAS o CORE**, e isso não é defeito: o catálogo de permissões
(`permissions.catalog.ts`) só tem `account`, `companies`, `users` e `roles` — cada módulo acrescenta o
seu bloco quando chegar. Na prática, com `INTENT_PARSER_DRIVER=deterministic`:

- *"pode ver e cadastrar empresas"* → traduz (empresas está no catálogo);
- *"pode vender, mas não pode dar desconto"* → **não traduz nada**, tudo volta como "a decidir",
  porque venda e desconto não são permissões que existam neste build.

Inventar um mapeamento para `vender` faria o teste passar mentindo, e faria a tela propor uma
permissão que nenhum guard verifica. Para exercitar frases de venda, use o Gemini (que também só
consegue propor o que está no catálogo — a lista fechada vai no prompt e a saída é validada contra
ela).

### 8. Subir a aplicação

```bash
npm run dev                # porta 3020
```

No boot: migrations → verificação dos invariantes → seed do catálogo (planos e módulos), tudo sob
advisory lock. **Falha na verificação aborta o processo** — nunca subir sem isolamento verificado.
`AUTO_MIGRATE=false` desliga só a migration; a verificação roda sempre.

## Comandos

| | Desenvolvimento | Produção (`dist`) |
|---|---|---|
| Migrations | `migration:up` / `migration:create` / `migration:down` | `migrate:prod` |
| Invariantes | `verify:isolation` | `verify:isolation:prod` |
| §7.2 | `verify:rls` / `test:integration` | `verify:rls:prod` |
| Smoke do auth | `smoke:auth` | `smoke:auth:prod` |
| Primeira conta | `create:account` | `create:account:prod` |
| Seed de dev | `seed:dev` | `seed:dev:prod` ⚠️ temporário (ADR-0001) |

## Versão do Postgres

⚠️ **Pendente de confirmação.** A tag da imagem em `docker-compose.dev.yml` precisa ser a **mesma
major** do Postgres do mdantas. Divergir traz dois problemas: comportamento sutilmente diferente em
RLS e em `set_config` entre majors, e um diretório de dados criado por uma major que não sobe na
outra — o que transforma um alinhamento futuro em recriação do banco local.
