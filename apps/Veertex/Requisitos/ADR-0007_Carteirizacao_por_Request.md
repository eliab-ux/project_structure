# ADR-0007 — Carteirização resolvida POR REQUEST, não no token

**Data:** 22/08/2026 · **Status:** aceito · **Decisão de:** Eliab

## Contexto

O §2.3 do `02_Veertex_Vnd.md` traz a carteirização de volta INTEIRA: coluna `sales_rep_id` no
contato, preferência de conta `contact_carteirizacao`, e o **filtro em RLS + guard** (nunca `if` de
aplicação). Com a preferência ligada, um vendedor sem `contacts.read.all` enxerga apenas os contatos
da própria carteira (`sales_rep_id = o id dele`).

A pergunta desta ADR é **onde o escopo do ator é resolvido**: no JWT (como os módulos, ADR-0001) ou
por leitura no request.

## Decisão

**Por leitura no request.** O escopo NÃO viaja no token. A cada request, o `ContactScopeService`
resolve o valor e o escreve em `app.contact_scope` (transaction-local), que a policy de RLS de
`contacts` lê. Ver `src/infrastructure/security/contact-scope.service.ts`.

## Por que NÃO estender o ADR-0001

O ADR-0001 pôs os módulos efetivos no JWT e aceitou uma defasagem de até 15 min (o TTL do access
token) para quem não fez o toggle. Aquilo foi aceito porque **o efeito de um módulo defasado é uma
tela a menos** — inconveniente, não inseguro. O ADR-0001 foi escrito para uma **chave comercial**.

Carteirização é **política de visibilidade de dado**, e o efeito da defasagem é outro: **contato de
um vendedor visível a outro por até 15 min** depois de ligar a preferência — vazamento entre atores
da mesma conta. Estender o precedente do ADR-0001 para cá seria aplicá-lo a um caso que ele não
pesou.

Além disso, um claim quebra em dois casos **sem saída**, apontados pelo Eliab:

1. **Admin troca o `sales_rep_id` de um contato.** Com o escopo (ou a lista de contatos) no token, o
   vendedor antigo continua vendo o contato até o token renovar. Com leitura no request, a policy
   compara `sales_rep_id` **ao vivo** com o escopo do ator — a troca vale na hora.
2. **Usuário desativado.** Um token válido ainda carregaria o escopo. Recomputar por request tira o
   estado de autorização de dentro de um artefato que não se revoga.

> **A assimetria que decide:** cache se invalida; token emitido, não.

## O desenho

- **Coluna** `contacts.sales_rep_id` (FK `users`, `on delete set null`).
- **Preferência** `accounts.contact_carteirizacao` (default `false`). Alterá-la muda visibilidade de
  dado → é registrada (§1 do 01A); hoje via log, e migra para a trilha de auditoria (item 12 do 01A)
  quando ela existir.
- **Quem é restrito:** por PERMISSÃO, não por nome de papel. Quem tem `contacts.read.all` vê todos
  os contatos; quem não tem fica restrito quando a preferência está ligada. Só o papel `SALES_REP`
  padrão nasce sem `contacts.read.all`.
- **`app.contact_scope`** — GUC transaction-local, setado pelo `ContactScopeService` no interceptor,
  depois que `app.account_id` já está posto. Vazio = não restrito; preenchido com o `sub` do ator =
  restrito à própria carteira.
- **Policy de `contacts`:**
  ```sql
  using (
    account_id = <tenantScope>
    and (contact_scope is null or sales_rep_id = contact_scope::uuid)
  )
  with check (account_id = <tenantScope>)   -- atribuição é da aplicação; a policy governa a VISIBILIDADE
  ```
  O `account_id = <tenantScope>` é **conjunção sempre aplicada**: o escopo de conta nunca é
  enfraquecido. `app.contact_scope` vazio/ausente cai no primeiro ramo do OR (vê tudo dentro da
  conta) — falha, no máximo, para o lado de "não restringir por ator", **nunca** para o lado de
  cruzar contas.

## Contato sem vendedor (`sales_rep_id` null)

Visível **só a quem não é restrito** (admin/gestor atribuem). Para um ator restrito, `null = escopo`
é falso → não aparece. É a leitura literal do §2.3 ("acessível somente ao vendedor vinculado").

## Custo e a saída se ele aparecer

A resolução lê a preferência da conta por request, e só para atores restritos-candidatos (quem tem
`contacts.read.all` nem lê). É uma leitura pequena e indexada. **Se o custo aparecer**, a saída é
cache server-side invalidado no toggle da preferência — não implementado até o custo se mostrar
(princípio: não otimizar adivinhando).

## Limite conhecido (defense in depth) — registrado, não escondido

A policy de carteirização está **na tabela `contacts`**. As filhas (`contact_emails`,
`contact_phones`, `contact_addresses`) seguem escopadas **por conta**, não por ator. Hoje elas só são
lidas pelo agregado de contato (que já é filtrado pela policy do pai), então não há caminho de
vazamento por ator. Estender o escopo de ator às filhas (via subquery ao pai na policy) é
**follow-up** para o dia em que existir uma leitura direta de filha — e está aqui para não virar
descoberta.

## Como se verifica

Teste de isolamento **por ator** (`test/integration/contact-carteirizacao.spec.ts`): dois vendedores
na mesma conta, cada um com o seu contato, mais um contato sem vendedor. O restrito ao vendedor A vê
só o contato de A; o não restrito vê os três. E **sabotagem** (regra 6 do CLAUDE.md): com a cláusula
de carteirização removida da policy, a asserção fica **vermelha** — o teste prova que detecta o
defeito que existe para pegar.
