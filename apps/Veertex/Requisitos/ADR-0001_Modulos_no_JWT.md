# ADR-0001 — Módulos efetivos viajam no JWT

| | |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-08-09 |
| **Decisor** | Eliab |
| **Fatia** | F2 (module / account_module + guard) |
| **Fonte da aprovação** | Mensagem do Eliab na sessão de desenvolvimento de 09/08/2026: *"F2: Opção A aprovada (modules no token, plano ∩ conta no login/refresh) com a assinatura proposta (ModuleGuard separado estendendo JwtAuthGuard, @RequireModule no controller, @RequirePermission no método, módulo verificado primeiro)."* |

> **Por que este documento existe.** A decisão vivia apenas em comentário de código
> (`token-service.port.ts`, `module.guard.ts`, `get-effective-modules.use-case.ts`) e numa mensagem
> de chat. Comentário explica a implementação a quem já a encontrou; não registra uma decisão de
> arquitetura nem preserva as alternativas descartadas. O §9.2 da Visão Geral proíbe decisão
> implícita, e uma decisão sem registro versionado é o caso mais puro disso.

## Contexto

A Visão Geral §2.1 define a visibilidade como `plano ∩ conta ∩ papel`. Os três eixos:

- **plano** — teto comercial (`plans.limits.modules`);
- **conta** — o que ela ligou (`account_modules`);
- **papel** — o que aquele usuário pode fazer (`roles.permissions`).

O `@RequireModule` precisa avaliar `plano ∩ conta` em toda requisição de módulo opcional.

**A restrição que decide tudo:** guards do NestJS rodam **antes** dos interceptors, e é o
`TenantTransactionInterceptor` que abre a transação onde o `set_config('app.account_id', …, true)`
é aplicado. Sem transação não há escopo; sob RLS, sem escopo uma consulta devolve **zero linhas**.

Logo: **um guard não consegue ler `account_modules` do banco.** A consulta não erraria — ela
devolveria vazio, e todo módulo pareceria inativo. É a mesma restrição que já havia levado as
permissões para dentro do token na F1.

## Decisão

O access token carrega `modules: string[]`, com `plano ∩ conta` **já intersectado** no momento da
emissão (login e refresh). O `ModuleGuard` lê do token, sem I/O.

```ts
interface AuthTokenPayload {
  sub: string;
  accountId: string;
  roleId: string;
  permissions: string[];
  modules: string[];   // ← esta decisão
}
```

Decisões acopladas, aprovadas na mesma mensagem:

1. **`ModuleGuard` separado**, estendendo `JwtAuthGuard` — não fundido ao `PermissionGuard`. Módulo é
   da **conta**, permissão é do **papel**: dois eixos que mudam por motivos diferentes. Estender o
   guard de JWT (em vez de assumir que ele rodou antes) faz com que anotar só um dos dois não abra a
   rota. Compor os dois verifica o token duas vezes — ~15µs de HS256, irrelevante pela garantia.
2. **`@RequireModule` no controller, `@RequirePermission` no método.** Um controller pertence a um
   módulo; a permissão varia por operação.
3. **Módulo verificado primeiro** (`@UseGuards(ModuleGuard, PermissionGuard)`): "o módulo X não está
   ativo" é mais acionável que "sem permissão" para quem, de fato, tem o direito.
4. **`ToggleModule` devolve `requiresTokenRefresh: true`** e o frontend renova a sessão na hora.
5. **Teste de metadata** que falha o build se rota não pública não declarar permissão — e módulo,
   quando aplicável.

## Alternativas consideradas

**B — o guard abre a própria transação.** Após o `establish()` do `JwtAuthGuard`, o `ModuleGuard`
chamaria `em.transactional(...)`, o subscriber aplicaria o GUC e a leitura de `account_modules`
funcionaria. Tecnicamente viável e **sem defasagem alguma**.

Descartada pelo custo: uma transação e uma query a mais em **toda** requisição de módulo, e um guard
que faz I/O — assimétrico com o `PermissionGuard`, que é síncrono. A casa já aceita a defasagem de
um ciclo de access token para papel e permissão, e ativação de módulo é evento administrativo raro,
bem menos sensível que uma despromoção de segurança.

**C — checar o módulo dentro do use case.** Rodaria dentro da transação, sem defasagem e sem
transação extra. Descartada porque devolve ao autor de cada use case a responsabilidade que um guard
existe para centralizar: o primeiro que esquecesse criaria uma rota de módulo desativado que
funciona.

## Consequências

**Aceitas:**

- **Defasagem de até um ciclo de access token (15 min)** entre ligar/desligar um módulo e o efeito
  na API. Mitigado no caso que mais incomoda — o administrador na própria tela de toggles — pelo
  `requiresTokenRefresh`.
- **Token maior.** Nove códigos de módulo somam poucas dezenas de bytes; irrelevante.
- **Tokens emitidos antes da F2 são rejeitados** (`modules` ausente → 401). Deliberado: tratá-los
  como "sem módulo nenhum" deixaria o usuário numa sessão que falha em toda rota de módulo sem
  explicar por quê; como "todos os módulos" seria abrir a porta. Na prática, **todos relogam no
  deploy da F2** — aceitável agora (nenhum cliente em produção) e **inaceitável depois**. Fica como
  precedente registrado: mudança incompatível no payload do token exige plano de transição a partir
  do primeiro cliente.
- **O frontend decodifica o payload sem verificar assinatura** para ler `modules` (o navegador não
  tem nem deve ter a chave). Serve só para decidir o que renderizar; toda decisão que importa é
  reverificada no servidor, com assinatura conferida.

**Rejeitada por consequência:** nada aqui autoriza esconder rota como controle de segurança. O
`hasModule()` do frontend decide o que **desenhar**; o `ModuleGuard` decide o que é **permitido**.

## Apêndice — precedentes registrados sob o mesmo gatilho

Duas concessões aceitas **para a fase sem clientes**, que expiram no mesmo momento e por isso ficam
juntas. O gatilho é único: **o primeiro cliente em produção.**

| # | Concessão | Por que é aceitável agora | O que muda no gatilho |
|---|---|---|---|
| 1 | **Invalidação de tokens no deploy.** `modules` passou a ser claim obrigatório; token anterior → 401. | Ninguém em produção; todos relogam. | Mudança incompatível no payload exige plano de transição (claim opcional com fallback por uma janela, ou emissão dupla). |
| 2 | **`seed:dev:prod` existe no runtime que atende cliente** (`INSTRUCOES §A4`). Uma rotina que popula dados de desenvolvimento passou a ser invocável de dentro do container de produção. | Necessária para fechar a verificação da F1 sem `src/` na imagem. O comando **recusa `NODE_ENV=production`**, o que é a única barreira real hoje. | **Remover o alvo `seed:dev:prod`** e, com ele, o `seed-dev.cli` do build de produção — ou mover para uma imagem de manutenção separada. Uma barreira baseada em variável de ambiente é uma barreira que um `-e NODE_ENV=development` derruba. |
| 3 | **`AUTO_MIGRATE=true`** — a API carrega credencial com DDL (ver `deploy/README.md`). | Operação sem passo manual. | `AUTO_MIGRATE=false` + migration como passo de release. |

Os três estão registrados em três lugares diferentes (aqui, no `deploy/README.md` e no
`INSTRUCOES_CLAUDE_CODE_F1_F2.md`). Esta tabela é o índice: **ao receber o primeiro cliente, revisar
os três juntos.**

## Revisão

Reabrir esta decisão se qualquer uma acontecer:

- ativação de módulo passar a ser operação frequente ou sensível a tempo (ex.: cobrança por uso) —
  aí a defasagem deixa de ser aceitável e a Opção B volta à mesa;
- surgir necessidade de revogação imediata de acesso a módulo (suspensão por inadimplência que deva
  valer no mesmo segundo);
- o access token crescer ao ponto de importar, por acúmulo de claims.

## Referências

- `00_Veertex_Visao_Geral.md` §2.1 (`plano ∩ conta ∩ papel`), §9.2 (nada de silent defaults)
- `01_Veertex_Core.md` §3.7 (module / account_module, `@RequireModule`, desativar preserva dados)
- Código: `contexts/module/domain/modules.catalog.ts` (`resolveEffectiveModules`),
  `infrastructure/security/guards/module.guard.ts`,
  `contexts/module/application/use-cases/get-effective-modules/`
- Teste: `test/unit/route-metadata.spec.ts`
