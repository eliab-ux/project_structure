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

## 5. Dokploy

Estrutura: **Backend (Application)** + **Frontend (Application)**. Sem Redis no F1 — nenhum job
ainda; ele entra com a fatia que precisar de fila (geocodificação de endereço, no F2).

| Serviço | Dockerfile | Context Path | Domain | Container Port |
|---|---|---|---|---|
| Backend | `backend/Dockerfile` | `/` | `<sub>.<dominio>` · Path `/api` · Strip Path **OFF** | 3020 |
| Frontend | `frontend/Dockerfile` | `/` | `<sub>.<dominio>` · Path `/` | 3021 |

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
