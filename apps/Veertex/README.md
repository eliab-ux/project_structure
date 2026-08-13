# Veertex

ERP SaaS multi-tenant para pequenas e médias empresas brasileiras. Arquitetura hexagonal
(Ports & Adapters), NestJS + Fastify no backend e Next.js 14 + MUI no frontend, sobre PostgreSQL.

> **Leitura obrigatória antes de escrever código:** [`CLAUDE.md`](CLAUDE.md) (constituição técnica) e
> [`Requisitos/00_Veertex_Visao_Geral.md`](Requisitos/00_Veertex_Visao_Geral.md) (o que o sistema é).

## Estrutura

```
backend/      API NestJS + Fastify + MikroORM        (porta 3020)
frontend/     Next.js 14 App Router + MUI            (porta 3021)
packages/     @veertex/domain-primitives, @veertex/shared-kernel
Requisitos/   requisitos, ADRs e instruções
```

> ⚠️ **`packages/` são CÓPIAS** do monorepo `project_structure`, não código compartilhado. Correção
> feita aqui **não chega** ao Batuta/Ecoa/Kaza Tem, e vice-versa — a divergência é silenciosa por
> construção. A decisão, o motivo e o que fazer ao alterar um desses arquivos estão em
> [`Requisitos/ADR-0002_Pacotes_Copiados.md`](Requisitos/ADR-0002_Pacotes_Copiados.md).

## Começar

O passo a passo completo — subir o Postgres, provisionar os papéis, migrar, verificar o isolamento e
rodar os testes — está em **[`backend/README.md`](backend/README.md)**. Em resumo:

```bash
npm install
npm run db:up                                    # Postgres local em 127.0.0.1:5433

# provisionar os dois papéis do banco (uma vez por banco) — ver backend/README.md
MSYS_NO_PATHCONV=1 docker exec -i veertex-pg-dev psql -U postgres -d veertex \
  -v ON_ERROR_STOP=1 -v db_name=veertex \
  -v owner_password=SENHA_OWNER -v app_password=SENHA_APP \
  -f /sql/001_create_roles.sql

cp backend/.env.example backend/.env.local       # ajuste as senhas do passo anterior
npm run migration:up -w @veertex/backend         # como veertex_owner
npm run verify                                   # invariantes de isolamento — precisa sair 0
npm run dev -w @veertex/backend                  # porta 3020
```

## O isolamento entre contas, em duas frases

Toda tabela de negócio carrega `account_id`, e o isolamento tem **duas camadas independentes**: um
filtro global do MikroORM que **lança** se o escopo não foi estabelecido, e **RLS no PostgreSQL** com
policy por `account_id`. O tenant chega ao banco por `set_config` **transaction-local** — de sessão
vazaria entre conexões do pool.

Isso só é seguro porque a aplicação conecta como um papel (`veertex_app`) que **não é dono de tabela
nenhuma** e não tem `BYPASSRLS` — e esse fato mora fora do código. Por isso ele é **verificado a cada
boot**, e uma falha **aborta o processo**:

```bash
npm run verify        # atalho para verify:isolation no backend
```

## Estado

| Fatia | Conteúdo | Estado |
|---|---|---|
| **F1** | conta, empresas, papéis, usuários, autenticação, isolamento | em `main`; fila de verificação contra produção pendente |
| **F2** | módulos (`module` / `account_module`, `@RequireModule`) | em `feat/f2-modules` — **não integrar antes da F1 fechar** |

## Deploy

Dokploy no servidor mdantas, via Git + Deploy Key **read-only** (dar escrita à chave fecharia o loop
"comprometer o servidor → injetar código → o servidor deploya"). Detalhes, variáveis e a fila de
verificação em [`backend/deploy/README.md`](backend/deploy/README.md) e
[`backend/deploy/verify/README.md`](backend/deploy/verify/README.md).
