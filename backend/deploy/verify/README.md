# Fila de verificação da F1 — passo a passo

Roda **dentro do container do backend**, contra o host interno do Postgres (ex.:
`veertex-veertex-eeilbu:5432`). Nenhuma porta precisa estar publicada para fora — a máquina de
desenvolvimento não participa.

> **Nota sobre a imagem.** O runtime é `node:22-alpine` e carrega apenas `dist/`, `node_modules/`,
> `packages/` e os dois `package.json`. **Não** tem `src/`, `test/`, `tsconfig*.json`,
> `mikro-orm.config.ts` nem `deploy/`. Isso decide tudo o que segue: comandos com `ts-node`, `jest`
> ou o CLI do `mikro-orm` **não rodam lá**. Só os alvos `:prod`, que apontam para `dist/`.
>
> Foi por isso que as asserções do §7.2 saíram do arquivo de teste para
> `src/infrastructure/persistence/rls-behavior-checks.ts` — o jest e o CLI compilado consomem o
> mesmo módulo, em vez de duas cópias que divergem na primeira correção.

## Etapas

| # | Etapa | Comando | Papel do banco |
|---|---|---|---|
| 1 | Migrations | `npm run migrate:prod` | owner |
| 2 | Invariantes de configuração | `npm run verify:isolation:prod` | owner |
| 3 | Comportamento do RLS (§7.2) | `npm run verify:rls:prod` | **owner + runtime** |
| 4 | Primeira conta (opcional) | `npm run create:account:prod -- …` | owner |
| 5 | Auth ponta a ponta | `npm run smoke:auth:prod` | via HTTP |
| 6 | WhatsApp | manual — ver abaixo | — |

### O gate é misto, não uniforme

Nas verificações **independentes** o runner não aborta: reporta todas e devolve código ≠ 0 no fim —
abortar na primeira faria você descobrir um problema por execução.

Duas etapas **abortam**, porque continuar é pior que parar:

| Etapa | Por que aborta |
|---|---|
| 1 — migration | Sem saber qual schema está no banco, tudo depois reporta sobre um estado desconhecido: "policy ausente" fica indistinguível de "tabela nunca criada" |
| 2 — `verify:isolation` | A fronteira de isolamento está quebrada, e as etapas 4 e 5 **escrevem**. Gravar dado num banco sem isolamento entre contas é o único erro desta fila que não se desfaz relendo o log |

## Migration — caminho e usuário

**O schema é aplicado em dois momentos, e os dois usam o mesmo caminho e o mesmo usuário.**

1. **No start do container (automático).** `DatabaseBootstrapService.onApplicationBootstrap` roda
   `migrator.up()` antes de a aplicação aceitar a primeira requisição, dentro de um
   `pg_advisory_lock` — é o lock que torna isso seguro com várias réplicas. Controlado por
   `AUTO_MIGRATE` (padrão: ligado; `false` desliga só esta etapa).
2. **Pela fila (explícito).** A etapa 1 do runner roda `npm run migrate:prod`
   (`node dist/infrastructure/persistence/mikro-orm/migrate`). É **idempotente**: se o bootstrap já
   aplicou, aqui não há nada pendente, e a saída confirma isso em vez de deixar assumido.

**Usuário: `veertex_owner`, via `DATABASE_URL_MIGRATIONS`.** Nunca `veertex_app`. Duas razões, e a
segunda é a que importa:

- `veertex_app` **não tem DDL** — o `CREATE TABLE` falharia;
- se tivesse, seria pior que falhar: tabela criada pelo runtime vira tabela cujo **dono** é o
  runtime, e o dono não é afetado pelas policies. O RLS deixaria de valer para a aplicação sem
  nada no código mudar. É exatamente o que a etapa 2 detecta (invariante de `ownership`).

O `mikro-orm.config.ts` da raiz do pacote (usado pelos alvos `migration:*` de desenvolvimento)
também aponta para `DATABASE_URL_MIGRATIONS` e **avisa em stderr** se cair no fallback para
`DATABASE_URL`.

> **Por que `migrate:prod` e não `migration:up`:** o CLI do `mikro-orm` precisa do
> `mikro-orm.config.ts`, que não existe na imagem de runtime. `migrate:prod` é um script compilado
> que carrega a config em código. Mesma razão de todos os alvos `:prod`.

## 1. Levar o script para dentro do container

`deploy/` não vai para a imagem, então há duas opções.

**Opção A — copiar (recomendada, não requer rebuild):**

```bash
CONTAINER=$(docker ps --filter "name=veertex" --filter "name=backend" --format '{{.Names}}' | head -1)
docker cp apps/Veertex/backend/deploy/verify/run-verification.sh \
          "$CONTAINER":/tmp/run-verification.sh
docker exec -it "$CONTAINER" sh /tmp/run-verification.sh
```

**Opção B — sem o script, comando por comando:**

```bash
docker exec -it "$CONTAINER" sh -c 'cd /repo/apps/Veertex/backend && npm run migrate:prod'
docker exec -it "$CONTAINER" sh -c 'cd /repo/apps/Veertex/backend && npm run verify:isolation:prod'
docker exec -it "$CONTAINER" sh -c 'cd /repo/apps/Veertex/backend && npm run verify:rls:prod'
```

Use a B se quiser acompanhar etapa a etapa; a A para ter o relatório consolidado e um código de
saída único.

## 2. Rodar

```bash
docker exec -it "$CONTAINER" sh /tmp/run-verification.sh
```

O script primeiro confere as pré-condições e **aborta** se `DATABASE_URL` e
`DATABASE_URL_MIGRATIONS` apontarem para o **mesmo usuário** — nesse caso a verificação passaria
mesmo com o RLS desligado, porque o dono das tabelas ignora as policies. Ele imprime só o nome dos
usuários, nunca as senhas.

### Com a primeira conta e o smoke

```bash
docker exec -it \
  -e CREATE_ACCOUNT=true \
  -e ACCOUNT_ARGS='--account-name "Tudodicasa" --account-document "12345678000195" --plan COMPLETO --company-legal-name "Tudodicasa Comércio Ltda" --company-document "12345678000195" --tax-regime SIMPLES --state-registration-exempt --street "Av. Central" --number "1000" --district "Centro" --city "Goiânia" --state GO --zip "74000000" --ibge "5208707" --admin-name "Eliab" --admin-email "eliab@exemplo.com.br" --admin-phone "62999999999" --admin-password "SENHA_FORTE"' \
  -e SMOKE_EMAIL='eliab@exemplo.com.br' \
  -e SMOKE_PASSWORD='SENHA_FORTE' \
  "$CONTAINER" sh /tmp/run-verification.sh
```

A senha aparece no `docker exec` e portanto no histórico do shell — depois de rodar,
`history -d` na linha ou use um shell com `HISTCONTROL=ignorespace` e um espaço antes do comando.

## O que cada etapa prova

**Etapa 2 — configuração.** Dono das tabelas, atributos dos papéis (`SUPERUSER`/`BYPASSRLS` em
qualquer um dos dois invalida tudo), RLS ligado **com policy** em toda tabela que tem `account_id`,
ausência de `DELETE`/`TRUNCATE` no runtime, e a função de autenticação sendo `SECURITY DEFINER`, do
owner, com `search_path` fixo.

A lista de tabelas sai de `pg_attribute`, não de um array no código: uma migration futura que criar
tabela de tenant e esquecer a policy é pega aqui sem ninguém ter que lembrar de atualizar nada.

**Etapa 3 — comportamento.** Policy pode existir e estar escrita errada; a etapa 2 não veria. Aqui
se prova o efeito, com 11 asserções:

- sem escopo, cada tabela de tenant e `accounts` devolvem **zero** linhas;
- o GUC com string vazia (o valor que o subscriber escreve quando não há tenant) também não abre nada;
- o escopo da conta A enxerga só a conta A;
- pedir explicitamente o id da conta B devolve **vazio, não erro** — "proibido" e "inexistente" são
  a mesma resposta, e é isso que impede a API de confirmar a existência de dado de outro tenant;
- **o escopo morre no `COMMIT`** — a asserção que prova que o `set_config` é transaction-local e não
  de sessão. Se fosse de sessão, vazaria para a próxima requisição que pegasse a mesma conexão do
  pool, e esse é o furo que nenhum teste sequencial encontra;
- `INSERT` com `account_id` alheio é recusado pelo `WITH CHECK`;
- `UPDATE` em linha de outra conta afeta zero linhas;
- o papel de runtime não tem `DELETE`.

**Etapa 5 — auth.** Somente leitura: não troca senha, não cria conta. Verifica health, 401 sem
token, senha errada → 401, **e-mail inexistente respondendo igual a senha errada** (sem oráculo de
enumeração), login com token e refresh, `/auth/me` sem vazar hash, e o access token sendo recusado
como refresh token.

Bate em `127.0.0.1`, não no domínio público: o objetivo é provar que a aplicação responde. Misturar
Traefik e DNS faria uma falha de proxy parecer falha de autenticação.

## 6. WhatsApp — manual, de propósito

`POST /auth/request-password-reset` responde **204 exista ou não a conta**. É desenho, não descuido:
qualquer diferença entregaria quais e-mails estão cadastrados. Consequência para a verificação: um
teste automático que só olha o status passa sem provar nada.

A verificação real é manual — pedir o código para uma conta cujo WhatsApp você tem em mãos e
confirmar o recebimento. Precisa de `EVOLUTION_SYSTEM_INSTANCE` e `EVOLUTION_SYSTEM_APIKEY` (a
apikey **da instância**, nunca a global do servidor Evolution).

## Interpretando o resultado

```
✅ FILA VERDE — nenhuma etapa executada falhou.
```

**Etapa pulada não é etapa aprovada.** O script imprime `⏭️ Pulado` e continua, e o resumo final
repete isso. A F1 fecha com as etapas **1, 2, 3 e 5** executadas e verdes; a 4 é opcional (só na
primeira vez) e a 6 é manual.

Em caso de falha, releia a saída da etapa: os verificadores nomeiam a violação exata — qual tabela,
qual papel, qual privilégio, qual asserção e o que veio em vez do esperado.

## Rodando localmente (fora do container)

Mesmas verificações, alvos sem `:prod`, e aí o banco precisa ser alcançável da sua máquina — via
túnel SSH ou porta publicada:

```bash
cd apps/Veertex/backend
npm run verify:isolation     # etapa 2
npm run verify:rls           # etapa 3
npm run test:integration     # etapa 3 pelo jest, com diagnóstico por asserção
npm run seed:dev             # duas contas de demonstração (recusa NODE_ENV=production)
npm run smoke:auth           # etapa 5
```

`verify:rls` e `test:integration` exercitam **as mesmas asserções**, do mesmo módulo. A diferença é
o invólucro: o jest dá relatório item a item no desenvolvimento, o CLI roda onde não há jest.
