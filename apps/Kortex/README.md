# Kortex

Venda de **hora de máquina de corte de tecido**: pré-pedido do Modelista, reserva e cobrança do
Administrativo, apontamento do corte, histórico por tecido e caixa da operação.

A especificação é o contrato: [`Requisitos/SPEC_CORTE_FASES_1_A_5.md`](Requisitos/SPEC_CORTE_FASES_1_A_5.md)
(fases 1 a 6). Os protótipos são a referência visual:
[`kortex_prototipo_admin.html`](Requisitos/kortex_prototipo_admin.html) e
[`kortex_prototipo_modelista.html`](Requisitos/kortex_prototipo_modelista.html).
O `CLAUDE.md` da raiz do monorepo define **como** implementar; a spec define **o quê**.

> A pasta `Requisitos/` está no `.prettierignore` da raiz. Documento de requisito é entrada do
> trabalho — a formatação é de quem escreveu, não do formatador de código.

**Estado atual: Fases 1 a 6 completas.**

- **Fase 1** — autenticação JWT própria com os três papéis, guards por papel, recuperação de senha
  por código no WhatsApp, configuração da conta (janelas de funcionamento, máquinas com preço por
  hora, responsável pelo relatório) e gestão da equipe.
- **Fase 2** — cadastros de cliente (com CNPJ/CPF validados por dígito verificador, endereço e
  representante legal), tecido com altura máxima de enfesto e tipo de produto.
- **Fase 3** — pré-pedido criado pelo Modelista em uma tela no app mobile, fila de espera gerida
  pelo Administrativo com destaque para quem quer antecipar, e o aviso de horário vago.
- **Fase 4** — agenda em grade horas × máquinas com sobreposição lado a lado, reserva com preço
  vindo da máquina, o gate de pagamento, liberação para a fila, no-show e sua resolução.
- **Fase 5** — apontamento da matriz em dois toques com os dois cronômetros (corrido e restante,
  com excedente contando para cima), `total_pieces` derivado e histórico por tecido.
- **Fase 6** — caixa em regime de caixa: contas bancárias, categorias, lançamentos com
  cancelamento auditado, transferência entre contas próprias e o mini DRE por consulta agregada. O
  pagamento da reserva cria a entrada automaticamente, no mesmo ato.

409 testes automatizados. Todas as seis fases da spec estão entregues.

## Subir o ambiente local

```bash
# 1. Banco (Postgres 17 — mesma major do container do mdantas)
docker compose -f apps/Kortex/docker-compose.yml up -d

# 2. Dependências (a partir da raiz do monorepo)
npm install

# 3. Variáveis de ambiente
cp apps/Kortex/backend/.env.example  apps/Kortex/backend/.env
cp apps/Kortex/frontend/.env.example apps/Kortex/frontend/.env.local
# gere segredos fortes para JWT_ACCESS_SECRET e JWT_REFRESH_SECRET

# 4. Schema
npm run migration:up -w apps/Kortex/backend

# 5. Primeira conta e o dono dela (não há cadastro público de conta, por decisão)
npm run account:create -w apps/Kortex/backend -- \
  --name "Corte Ceres · APL" --city "Ceres" \
  --owner-name "Gleidson Dantas" --owner-email "gleidson@corteceres.com.br" \
  --owner-phone "62996010090" --owner-password "uma-senha-forte"

# 6. Rodar
npm run dev -w apps/Kortex/backend    # http://localhost:3030/api/health
npm run dev -w apps/Kortex/frontend   # http://localhost:3031
```

### Verificações

```bash
npm run check:tenant-scope -w apps/Kortex/backend   # nenhuma consulta sem filtro de conta
npm run test:unit -w apps/Kortex/backend            # domínio
npm run test:e2e  -w apps/Kortex/backend            # API real contra o banco kortex_test
```

| Item           | Valor                                                |
| -------------- | ---------------------------------------------------- |
| Backend        | `http://localhost:3030` (prefixo global `/api`)      |
| Frontend       | `http://localhost:3031`                              |
| Postgres       | `localhost:55433` — banco `kortex`, usuário `kortex` |
| Banco de teste | `kortex_test`, no mesmo container                    |

As portas fogem do padrão para não colidir com os outros apps do monorepo (o Batuta já usa 3010,
3003 e 55432).

## Nove coisas do schema que não são óbvias

**A tabela de usuários chama `app_user`, não `user`.** `user` é palavra reservada no PostgreSQL e
`select * from user` no psql **não dá erro** — devolve o usuário da conexão. A classe de domínio
continua `User`; o prefixo existe só para o banco.

**Duas horas de máquina não se sobrepõem — e quem garante é o banco.** A constraint
`schedule_entry_no_machine_overlap` (`EXCLUDE USING gist`) é parcial: vale só para `machine_hour`.
Atendimento pode sobrepor qualquer coisa e só gera aviso. Entre o `select` que não viu conflito e o
`insert` que o cria cabe uma segunda requisição, e duas telas do Administrativo abertas ao mesmo
tempo é o cenário normal.

**Documento de cliente é guardado só com dígitos.** Máscara é apresentação. Se a coluna guardasse
`11.222.333/0001-81`, o índice único `(account_id, document)` deixaria passar o mesmo CNPJ digitado
sem pontuação — o duplicado entraria pela porta da frente.

**Janelas de funcionamento, não par abre/fecha.** `business_hour` guarda N janelas por dia da
semana; o almoço é a ausência de janela entre duas linhas. A não-sobreposição é garantida por
constraint de exclusão no banco (`EXCLUDE USING gist`), não só na aplicação — por isso a extensão
`btree_gist` é criada já na migration baseline. Uma reserva precisa caber inteira dentro de uma
única janela: 11h→14h com intervalo das 11h30 às 13h é erro, não é partida em duas.

**O fuso é da conta, não do servidor.** `account.timezone` (default `America/Sao_Paulo`) é o
relógio pelo qual a agenda inteira é lida: as janelas de funcionamento são horários locais
("abre 07:00") e `schedule_entry.starts_at` é `timestamptz`. Em produção o servidor roda em UTC,
então sem esse dado uma reserva das 07:00 viraria 04:00. Ficou em variável de ambiente até a Fase 6
e virou coluna no deploy — fuso é atributo da operação, e duas contas no mesmo container podem
abrir em fusos diferentes.

**Tecido tem DUAS medidas, e elas não são intercambiáveis.** `max_layer_height_cm` é o limite do
enfesto inteiro (mesa, lâmina, material empilhado); `layer_thickness_cm` é a espessura de uma camada
só. Quantas camadas cabem é a divisão das duas. A coluna de espessura é **nullable e permanece
nullable**: sem ela o sistema **não avisa nada** sobre altura. Isso é intencional — a versão anterior
comparava a contagem de camadas com a altura em cm, o aviso disparava em quase todo corte, e aviso
que sempre aparece é aviso que ninguém lê. Para estimar a espessura dos tecidos que já têm
histórico: `npm run seed:layer-thickness -w apps/Kortex/backend -- --account <uuid>` (simula por
padrão; `--apply` grava).

**O preço da hora é da máquina, não da conta.** Cada `machine` tem seu `hour_price_cents`, e cada
reserva grava um snapshot desse valor — mudar o preço não altera reserva já criada.

**Uma reserva não gera duas entradas de caixa — e quem garante é o banco.** O índice único parcial
`cash_entry_one_per_reservation` (`where reservation_id is not null and cancelled_at is null`) é o
que impede o caixa duplicar. A checagem na aplicação existe para dar a mensagem certa; a garantia é
essa linha. O `partial` é o detalhe importante: um lançamento cancelado sai do índice, então dá para
cancelar e lançar de novo — que é justamente o caminho previsto, já que **editar valor efetivado não
existe**.

**Saldo de conta não é `Money`.** `opening_balance_cents` é um `int` puro porque saldo começa em zero
com frequência e pode ficar negativo; `Money` existe para preço e valor de lançamento, que são sempre
maiores que zero. E o **DRE não é tabela** (§4.16): é uma agregação sobre `cash_entry`, onde
`type <> 'transfer'` e `cancelled_at is null` estão no `where` — não em um `filter` depois.

## Por que não tem Supabase, Redis nem storage

- **Sem Supabase**: o Kortex não usa RLS — o isolamento multiconta é feito na aplicação, com
  `accountId` extraído do JWT (spec §0.6) — e não guarda arquivo (decisão 2.13). Postgres puro
  resolve, e é o que o mdantas oferece.
- **Sem Redis/fila**: não existe transição automática por tempo. Pré-reserva não expira sozinha; o
  sistema alerta e a pessoa decide (regra 6.5).
- **Sem storage**: arte e modelagem do cliente não ficam no sistema (decisão 2.13).

## Deploy

**Playbook completo em [`deploy/README.md`](deploy/README.md).** Em resumo: domínio
`kortex.ind.br` no Dokploy do mdantas, PostgreSQL 17 em container, um domínio para os dois
serviços (`/api` → backend, `/` → frontend).

A §9 foi resolvida como **recorte espelhado**: `git@gitlab.com:eliab1/kortex.git` recebe
`packages/`, `apps/Kortex/` e o `package.json` de workspace, publicados por
`./apps/Kortex/deploy/publish-mirror.sh`. O monorepo continua sendo a fonte da verdade — o espelho
é gerado, nunca editado.

Migrations **não** rodam no start do container: são um comando explícito
(`npm run migration:deploy`) depois do deploy. O porquê está no playbook, com os três motivos.
