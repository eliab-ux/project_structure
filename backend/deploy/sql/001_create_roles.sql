-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Veertex — provisionamento dos papéis do PostgreSQL (idempotente)
--
-- PASSO ÚNICO DE PROVISIONAMENTO, manual por decisão de segurança: exige superusuário, e o backend
-- jamais terá essa credencial. Tudo o que vem depois (migrations, verificação de isolamento, seed
-- do catálogo de planos) é automático, no start da aplicação.
--
-- Rodar UMA vez por banco, como superusuário (postgres), ANTES da primeira subida do backend.
-- Reexecutar é seguro: tudo aqui é condicional ou idempotente.
--
--   psql "postgresql://postgres:<senha>@<host>:5432/postgres" -v ON_ERROR_STOP=1 \
--        -v db_name=veertex \
--        -v owner_password=SENHA_DO_OWNER \
--        -v app_password=SENHA_DO_APP \
--        -f 001_create_roles.sql
--
-- ⚠️ As senhas vão SEM aspas no `-v`. O script usa `:'variavel'`, que é a forma do psql de
--    transformar o valor num literal SQL corretamente escapado; embutir aspas no `-v` produziria
--    uma senha com aspas dentro dela. Se a senha tiver caracteres especiais do shell, proteja com
--    aspas DUPLAS do shell: -v owner_password="a senha"
--
-- ⚠️ Senhas não ficam neste arquivo nem em nenhum arquivo versionado — só na linha de comando e,
--    depois, na aba Environment do Dokploy.
--
-- ── NOTA DE IMPLEMENTAÇÃO: por que não há bloco DO $$ ... $$ aqui ──────────────────────────────
-- Uma versão anterior deste script usava `do $$ ... :owner_password ... $$`, e falhava com
-- `syntax error at or near ":"`. O motivo: a substituição de variáveis do psql acontece no
-- cliente e é SUSPENSA dentro de strings dollar-quoted — `$$...$$` é uma região opaca para ele.
-- O `:owner_password` chegava literal ao servidor, que não faz ideia do que seja.
--
-- A forma correta de misturar variável do psql com SQL condicional é a que está abaixo: montar o
-- comando com `format()` numa consulta comum (onde a substituição funciona) e executá-lo com
-- `\gexec`. Bônus: `%L` escapa o valor no comando gerado, então uma senha com aspas não quebra
-- nada nem permite injeção.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- ── 1. Os dois papéis ──────────────────────────────────────────────────────────────────────────
--
-- Por que DOIS, e não um:
--
--   veertex_owner  dono do schema. Roda migrations (DDL), o bootstrap do backend e os CLIs de
--                  operador. Como dono das tabelas, NÃO é afetado pelo RLS — é isso que permite a
--                  migration fazer backfill e a função de autenticação (SECURITY DEFINER) buscar um
--                  usuário por e-mail sem saber o tenant.
--
--   veertex_app    usuário de RUNTIME. É com ele que a API atende requisição. Sem DDL, sem DELETE,
--                  sem TRUNCATE, e SUJEITO ao RLS — porque não é dono de nada. É esta assimetria,
--                  e não uma convenção de código, que faz o isolamento entre contas valer.
--
-- Um único usuário para as duas coisas anularia o RLS por completo: o dono ignora as policies, de
-- modo que a aplicação passaria a enxergar todas as contas sem que nada no código mudasse — e a
-- falha seria invisível até alguém notar dados de outro cliente na tela.

-- CREATE só quando não existe; o ALTER logo abaixo cuida de senha e atributos nos dois casos.
select format('create role veertex_owner login password %L', :'owner_password')
where not exists (select 1 from pg_roles where rolname = 'veertex_owner')
\gexec

select format('create role veertex_app login password %L', :'app_password')
where not exists (select 1 from pg_roles where rolname = 'veertex_app')
\gexec

-- Atributos SEMPRE reafirmados, mesmo em papel que já existia. NOSUPERUSER/NOCREATEDB/NOCREATEROLE/
-- NOBYPASSRLS explícitos porque herdar um deles em silêncio destruiria o isolamento — BYPASSRLS em
-- veertex_app especialmente, que é exatamente o atributo capaz de tornar todo o RLS decorativo.
select format(
  'alter role veertex_owner with login password %L nosuperuser nocreatedb nocreaterole nobypassrls',
  :'owner_password'
)
\gexec

select format(
  'alter role veertex_app with login password %L nosuperuser nocreatedb nocreaterole nobypassrls noinherit',
  :'app_password'
)
\gexec

-- ── 2. O banco ─────────────────────────────────────────────────────────────────────────────────
-- CREATE DATABASE não roda dentro de transação, então também vai por \gexec.
select format('create database %I owner veertex_owner', :'db_name')
where not exists (select 1 from pg_database where datname = :'db_name')
\gexec

\connect :db_name

-- ── 3. Schema e privilégios de base ────────────────────────────────────────────────────────────
alter schema public owner to veertex_owner;

-- PUBLIC tem CREATE em public por padrão em Postgres < 15. Revogar impede que veertex_app crie
-- tabelas — a parte "sem DDL" do menor privilégio.
revoke create on schema public from public;
revoke all on database :"db_name" from public;

grant connect on database :"db_name" to veertex_owner, veertex_app;
grant usage on schema public to veertex_app;

-- Privilégios padrão: toda tabela que veertex_owner criar no futuro (próximas migrations) já nasce
-- com os grants certos para veertex_app. Sem isto, cada migration teria de lembrar de conceder — e
-- a que esquecesse produziria um erro de permissão em produção, não em teste.
--
-- Repare no que não está aqui: DELETE e TRUNCATE. Exclusão no Veertex é soft delete, que é UPDATE.
alter default privileges for role veertex_owner in schema public
  grant select, insert, update on tables to veertex_app;
alter default privileges for role veertex_owner in schema public
  grant usage, select on sequences to veertex_app;

-- ── 4. Verificação ─────────────────────────────────────────────────────────────────────────────
-- Deve listar rolsuper=f, rolbypassrls=f para AMBOS. Qualquer 't' aqui invalida o isolamento.
--
-- Esta é uma conferência visual do provisionamento. A verificação COMPLETA e automatizada (dono das
-- tabelas, policies, grants, função de autenticação) roda no start do backend e aborta o processo
-- se algo estiver errado — ver deploy/README.md.
select rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
from pg_roles
where rolname in ('veertex_owner', 'veertex_app')
order by rolname;
