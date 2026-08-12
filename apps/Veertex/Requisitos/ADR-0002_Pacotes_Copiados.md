# ADR-0002 — `packages/` são cópias, não código compartilhado

| | |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-08-10 |
| **Decisor** | Eliab |
| **Contexto** | Extração do Veertex do monorepo `project_structure` para repositório próprio (`gitlab.com/eliab1/veertex`) |

## Contexto

Até 10/08/2026 o Veertex vivia em `apps/Veertex/` dentro do monorepo `project_structure` — o
template de arquitetura que hospeda também Batuta, Ecoa, Kaza Tem, EMDR Remoto e Plano Diário. Lá,
`packages/domain-primitives` e `packages/shared-kernel` eram **um único código** consumido por todos
os apps via npm workspaces.

Ao virar produto com repositório próprio, o Veertex precisava dessas duas bibliotecas. Três saídas:

| | Como | Por que não |
|---|---|---|
| **Submódulo git** | `packages/` como submódulo do `project_structure` | Amarra o Veertex ao ciclo de vida de um repositório de template; qualquer clone precisa de `--recurse-submodules`; e o Docker build teria de resolver o submódulo |
| **Registry** | publicar `@veertex/*` num registry privado | Infraestrutura (registry, credenciais, versionamento, CI de publicação) para 13 arquivos de classes-base que mudam uma vez por semestre |
| **Cópia** ✅ | copiar os arquivos para este repositório | Ver consequências abaixo |

## Decisão

**Copiar.** `packages/domain-primitives` e `packages/shared-kernel` passam a ser código **deste**
repositório, renomeados de `@gitspread/*` para `@veertex/*`.

São 13 arquivos `.ts`: `AggregateRoot`, `Entity`, `ValueObject`, `DomainEvent`, `DomainException`,
`UseCase`, `Result`, `PaginatedResult`, `PaginationParams`, `IRepository`, `DateUtil`,
`ValidationUtil`. Classes-base sem nenhuma dependência externa — o `CLAUDE.md` garante que
`packages/` é framework-agnostic e não depende dos apps.

## ⚠️ A consequência, escrita antes de ser descoberta

**Existem agora DUAS CÓPIAS do mesmo código, e elas vão divergir.**

- Corrigir um bug em `ValueObject` **aqui** não chega ao `project_structure` — nem ao Batuta, nem ao
  Ecoa, nem a nenhum outro app que o consome.
- Corrigir o mesmo bug **lá** não chega ao Veertex.
- Nada avisa. Não há build que quebre, teste que falhe ou aviso de lint. A divergência é silenciosa
  por construção.

Isto é exatamente a regra que este projeto aplica em toda parte — *duas fontes de verdade para a
mesma coisa divergem na primeira alteração* — agora aceita deliberadamente **em nível de pacote**.
Os precedentes onde ela foi recusada:

- o catálogo de planos saiu da migration para o seed do boot, para não existir em dois lugares;
- as asserções do §7.2 saíram do arquivo de teste para um módulo compartilhado entre o jest e o CLI;
- a lista de arquivos de ambiente vive em `src/config/load-env.ts`, não repetida em sete pontos de
  entrada.

A diferença que justifica aceitar aqui: **o custo da divergência é baixo e o da alternativa é alto.**
Esses 13 arquivos são estáveis (nenhuma alteração desde o commit inicial do monorepo), pequenos, e
sem dependências. Um submódulo ou um registry cobrariam manutenção permanente para evitar um risco
que se materializa raramente.

### O que fazer quando alterar um deles

1. **Alterar aqui** e seguir. É o caminho normal — o Veertex é o dono desta cópia.
2. **Se a correção for um bug real da classe-base** (não uma adaptação ao Veertex), avaliar
   replicar no `project_structure`. Manualmente: são poucos arquivos, e o diff é legível.
3. **Nunca** presumir que a versão de lá é igual à de cá. Ao portar código entre os dois
   repositórios, comparar `packages/` primeiro.

### Sinal de que a decisão precisa ser revista

Se `packages/` começar a receber alteração com frequência — ou se um terceiro produto passar a
precisar das mesmas classes com evolução conjunta — o custo inverte e vale voltar para registry.
Enquanto forem classes-base estáveis consumidas por um produto, a cópia é a escolha mais barata.

## Consequência secundária: o escopo mudou

`@gitspread/*` → `@veertex/*`. O `@gitspread` era legado do template (o próprio `CLAUDE.md` dizia
para tratá-lo como namespace npm sem significado). Renomear na criação do repositório foi o momento
mais barato: depois exigiria mexer em todo import.

**Efeito prático:** um trecho de código copiado de outro app do monorepo para cá — ou daqui para lá —
não compila sem ajustar o import. É atrito visível, e preferível ao silencioso: obriga a olhar o que
se está copiando.

## Referências

- `CLAUDE.md` → "Estrutura do repositório" e "Shared Packages"
- `Requisitos/ADR-0001_Modulos_no_JWT.md` — o outro ADR deste repositório
- Repositório de origem: `github.com/eliab-ux/project_structure`, em `apps/Veertex/` até 10/08/2026
