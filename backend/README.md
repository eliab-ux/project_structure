# Veertex — backend

NestJS + Fastify + MikroORM sobre PostgreSQL, arquitetura hexagonal (ver `CLAUDE.md` na raiz do
monorepo e `apps/Veertex/Requisitos/`).

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
docker compose -f docker-compose.dev.yml exec -T postgres \
  psql -U postgres -v ON_ERROR_STOP=1 \
    -v db_name=veertex \
    -v owner_password=SENHA_OWNER \
    -v app_password=SENHA_APP \
  < deploy/sql/001_create_roles.sql
```

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

### 6. Rodar os testes — como `veertex_app`

```bash
npm run test:integration   # §7.2 (isolamento) e §7.4 (ciclo de vida de módulo)
npm run verify:rls         # as mesmas asserções do §7.2, pelo CLI
npm test                   # unitários
```

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
