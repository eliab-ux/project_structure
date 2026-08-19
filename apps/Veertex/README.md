# Veertex

ERP SaaS multi-tenant para pequenas e médias empresas brasileiras. Arquitetura hexagonal
(Ports & Adapters), NestJS + Fastify no backend e Next.js 14 + MUI no frontend, sobre PostgreSQL.

> **Leitura obrigatória antes de escrever código:** [`CLAUDE.md`](CLAUDE.md) (constituição técnica) e
> [`Requisitos/00_Veertex_Visao_Geral.md`](Requisitos/00_Veertex_Visao_Geral.md) (o que o sistema é).

## Estrutura

O Veertex é um app do monorepo `project_structure`, como Batuta, Ecoa, Kaza Tem, EMDR Remoto,
Plano Diário e Kortex.

```
apps/Veertex/backend/     API NestJS + Fastify + MikroORM   (porta 3020)
apps/Veertex/frontend/    Next.js 14 App Router + MUI       (porta 3021)
apps/Veertex/Requisitos/  requisitos, ADRs e instruções
packages/                 @gitspread/domain-primitives, @gitspread/shared-kernel  ← na RAIZ
```

> **`packages/` é compartilhado com os outros apps**, e é a única cópia. Alterar um desses arquivos
> afeta todos eles. O Veertex teve cópia própria entre 10 e 18/08/2026; a decisão, a divergência que
> ela produziu em cinco dias e a reversão estão em
> [`Requisitos/ADR-0002_Pacotes_Copiados.md`](Requisitos/ADR-0002_Pacotes_Copiados.md).

## Começar

O passo a passo completo — subir o Postgres, provisionar os papéis, migrar, verificar o isolamento e
rodar os testes — está em **[`backend/README.md`](backend/README.md)**. Em resumo:

```bash
npm install                        # na RAIZ do monorepo — instala todos os workspaces

cd apps/Veertex/backend
npm run db:up                      # Postgres local em 127.0.0.1:5433

# provisionar os dois papéis do banco (uma vez por banco) — ver backend/README.md
MSYS_NO_PATHCONV=1 docker exec -i veertex-pg-dev psql -U postgres -d veertex \
  -v ON_ERROR_STOP=1 -v db_name=veertex \
  -v owner_password=SENHA_OWNER -v app_password=SENHA_APP \
  -f /sql/001_create_roles.sql

cp .env.example .env.local         # ajuste as senhas do passo anterior
npm run migration:up               # como veertex_owner
npm run verify:isolation           # invariantes de isolamento — precisa sair 0
npm run dev                        # porta 3020
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
cd apps/Veertex/backend && npm run verify:isolation
```

## Estado

| Fatia | Conteúdo | Estado |
|---|---|---|
| **F1** | conta, empresas, papéis, usuários, autenticação, isolamento | em `main`; fila de verificação contra produção pendente |
| **F2** | módulos (`module` / `account_module`, `@RequireModule`) | em `feat/f2-modules` — **não integrar antes da F1 fechar** |

## Deploy

O Dokploy clona `git@gitlab.com:eliab1/veertex.git`, que é um **espelho de conteúdo** do recorte
(`packages/` + `apps/Veertex/` + manifests da raiz) — gerado, nunca editado:

```bash
./apps/Veertex/deploy/publish-mirror.sh --dry-run   # confere o recorte
./apps/Veertex/deploy/publish-mirror.sh             # publica
```

Dokploy no servidor mdantas, via Git + Deploy Key **read-only** (dar escrita à chave fecharia o loop
"comprometer o servidor → injetar código → o servidor deploya"). Detalhes, variáveis e a fila de
verificação em [`backend/deploy/README.md`](backend/deploy/README.md) e
[`backend/deploy/verify/README.md`](backend/deploy/verify/README.md).
