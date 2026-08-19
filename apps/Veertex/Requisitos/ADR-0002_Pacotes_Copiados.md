# ADR-0002 — `packages/` são cópias, não código compartilhado

| | |
|---|---|
| **Status** | **REVERTIDO em 2026-08-18** · ver o adendo final |
| **Data** | 2026-08-10 |
| **Decisor** | Eliab |
| **Contexto** | Extração do Veertex do monorepo `project_structure` para repositório próprio (`gitlab.com/eliab1/veertex`) |

> ⚠️ **O contexto abaixo descreve 10/08/2026 e mudou.** Em 13/08/2026 o trabalho voltou para
> `apps/Veertex/` **dentro** do monorepo, e o `gitlab.com/eliab1/veertex` passou a ser **publicado**
> a partir dali. A DECISÃO (copiar, com escopo `@veertex/*`) foi mantida — e ganhou um argumento
> novo. O adendo no fim registra o quê, o porquê, e a receita de publicação.

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

---

# Adendo de 2026-08-13 — o código voltou ao monorepo, e a decisão ficou mais forte

**O que mudou.** O Veertex voltou a ser desenvolvido em `apps/Veertex/` dentro do
`project_structure`. O `gitlab.com/eliab1/veertex` continua existindo e é o que o Dokploy builda,
mas agora é **publicado** a partir do monorepo, não editado direto.

**A decisão de copiar foi mantida**, e o argumento melhorou: as duas cópias agora vivem no **mesmo
repositório** — `apps/Veertex/packages/` (escopo `@veertex/*`) e `packages/` na raiz (escopo
`@gitspread/*`, servindo os outros cinco apps). O risco que este ADR registrou como "divergência
silenciosa entre dois repositórios" virou **um diff visível num único clone**. É estritamente melhor
do que era em 10/08, e não pior do que compartilhar: compartilhar significaria os cinco outros apps
herdarem qualquer mudança feita para o Veertex.

## O escopo foi trocado e destrocado — e o motivo técnico, medido

Em 12/08, ao trazer o código para o monorepo, os 67 arquivos foram reescritos para `@gitspread/*`
"porque era o que resolvia". Em 13/08 voltaram para `@veertex/*`. O que a ida e volta ensinou, e
que vale escrito:

**O que resolve um import de workspace é o symlink que o npm cria em `node_modules/` a partir do
campo `name` do pacote** — não os `paths` do `tsconfig`. No backend isso é fácil de comprovar: ele
declara `paths` próprios (`@contexts/*`, `@infrastructure/*`…), e um `tsconfig` filho que declara
`paths` **substitui** os da base por completo, então as entradas da base nunca foram lidas. Em
runtime, `node dist/main` só procura em `node_modules`.

Ou seja: `@gitspread/*` não era exigido por resolução de módulo alguma — era só o `name` dos pacotes
que existiam. Manter `@veertex/*` exigiu apenas **pacotes alcançáveis por esse nome**, que é
exatamente a decisão deste ADR. Os dois escopos coexistem sem conflito no mesmo `node_modules`.

E o escopo distinto continua sendo o mecanismo que este ADR queria: código copiado de um app para o
outro **não compila** sem ajustar o import. Com escopo único, a mesma cópia entraria em silêncio.

## Receita de publicação (a parte operacional desta decisão)

`apps/Veertex/` tem `package.json`, `package-lock.json`, `tsconfig.base.json`, `tsconfig.json`,
`.dockerignore` e configs de lint **próprios** — sem isso o subtree publicado não seria um
repositório que builda, e é essa forma que os `Dockerfile` assumem (`COPY backend ./backend`).

Para publicar:

```bash
git subtree split --prefix=apps/Veertex -b veertex-publish
TREE=$(git rev-parse veertex-publish^{tree})
NEW=$(git commit-tree $TREE -p $(git rev-parse veertex/main) -p $(git rev-parse veertex-publish) \
      -m "publish: conteúdo de apps/Veertex do monorepo (subtree split)")
git push veertex $NEW:main
```

**Por que `commit-tree` com dois pais, e não `git subtree push`.** O `main` do GitLab é **branch
protegida** e o histórico do split não é descendente dos 19 commits que estavam lá — um push direto
exige force, e force é recusado. O commit de junção tem a árvore do split (conteúdo idêntico) e dois
pais (o `main` anterior + o split), o que torna o push fast-forward. Efeito colateral bom: os 19
commits permanecem na ancestralidade do `main`, além de estarem na tag **`pre-monorepo`**.

**Duas notas de armadilha, ambas custaram tempo:**

- `tsconfig.json` dos pacotes usa `extends: "../../tsconfig.base.json"` — por isso `apps/Veertex/`
  precisa da sua própria `tsconfig.base.json`. Apontar para a do monorepo funcionaria e seria pior:
  o subtree publicado não a teria.
- Ao copiar `packages/` de um lugar para outro, **apague `dist/` e `*.tsbuildinfo`**. O estado
  incremental herdado faz o `tsc` pular a emissão dos `.d.ts` **reportando sucesso**, e o erro
  aparece longe: `TS7016 implicitly has an 'any' type` no consumidor.

## Sinal de que a decisão precisa ser revista (atualizado)

O sinal original continua valendo: `packages/` recebendo alteração frequente, ou um terceiro produto
precisando das mesmas classes com evolução conjunta.

Acrescento um: se alguém **editar direto** o `gitlab.com/eliab1/veertex`. A publicação por subtree
pressupõe que o GitLab é destino, nunca origem. Um commit feito lá fica órfão no próximo publish —
e a receita acima o sobrescreveria sem avisar.

## Referências

- `CLAUDE.md` → "ONDE ESTE CÓDIGO VIVE", "Estrutura do repositório" e "Shared Packages"
- `Requisitos/ADR-0001_Modulos_no_JWT.md` — o outro ADR deste repositório
- Monorepo: `github.com/eliab-ux/project_structure`, em `apps/Veertex/`
- Repositório publicado: `gitlab.com/eliab1/veertex` (tag `pre-monorepo` = os 19 commits de 10 a
  12/08/2026, quando foi repositório de trabalho)

---

# Adendo de 2026-08-18 — REVERTIDO: os pacotes voltam a ser um só, na raiz

**A decisão de copiar foi desfeita.** O Veertex passou a usar `@gitspread/domain-primitives` e
`@gitspread/shared-kernel` da raiz do monorepo, como os outros cinco apps. `apps/Veertex/packages/`
não existe mais.

## O argumento que derrubou a decisão, e ele é do Eliab

> *"Todos são publicados igual, o Veertex vai ser, e nenhum copiou o pacote aqui no repositório. Por
> que só o Veertex tem que ter? Não aceito."*

Medido antes de aceitar, e ele estava certo:

| | Contexto do build no Dockerfile | Tem `packages/` próprio? |
|---|---|---|
| Kortex, batuta, ecoa (e os demais) | **raiz do monorepo** — `COPY apps/<app>/backend/...` | não |
| Veertex (antes) | **`apps/Veertex/` como raiz** — `COPY backend ./backend` | sim |

A anomalia nunca foi a pasta: era o **esquema de publicação por subtree**, herdado da época em que o
Veertex vivia num repositório separado. Os Dockerfiles dele esperavam ser a raiz porque vieram de
lá; os outros cinco nunca esperaram. A cópia dos pacotes existia só para sustentar essa herança.

**Onde eu errei:** sustentei, em duas mensagens seguidas, que os pacotes precisavam ficar no app
"porque os Dockerfiles esperam isso" — sem verificar que os Dockerfiles dos outros cinco esperam o
oposto. Era uma verificação de trinta segundos.

## A divergência que a decisão original previu — ela aconteceu

`validation.util.ts` já havia divergido quando a reversão foi feita:

| | linhas | `isValidCPF` / `isValidCNPJ` |
|---|---|---|
| `packages/` (raiz) | 87 | **sim** |
| `apps/Veertex/packages/` (cópia) | 35 | não |

A cópia do Veertex ficou para trás e ninguém notou — em cinco dias. O ADR dizia que a divergência
seria silenciosa "por construção", e o escopo distinto (`@veertex/*`) **não a impediu**: ele só
faria uma cópia-e-cola entre apps falhar na compilação, e ninguém copiou e colou. A reversão elimina
o problema na raiz: com um pacote só, não há o que divergir.

## O que mudou, em concreto

1. `apps/Veertex/packages/` removido;
2. 83 arquivos voltaram a importar `@gitspread/*`; os workspaces do app viraram
   `@gitspread/veertex-backend` e `@gitspread/veertex-frontend`, no padrão dos outros;
3. os dois `Dockerfile` reescritos no formato dos demais (contexto = raiz do monorepo);
4. removido o andaime do subtree — `package.json`, `package-lock.json`, `tsconfig.json`,
   `tsconfig.base.json`, `.eslintrc.js`, `.prettierrc`, `.editorconfig`, `.dockerignore`,
   `.gitignore`, `jest.config.js` e o `CLAUDE_PYTHON.md` duplicado. O backend passou a estender
   `../../../tsconfig.base.json`, como os outros;
5. `apps/Veertex/packages/*` saiu dos workspaces da raiz;
6. mantidos: `CLAUDE.md` (regras específicas do Veertex, que a raiz não cobre — a dela é do
   GITVEERT), `.gitattributes` (a raiz não tem, e sem ele os arquivos voltam a CRLF) e `README.md`.

## O que isso custa, e é preciso dizer

**A publicação por `git subtree split` deixa de funcionar** — ela levava só o que estava dentro de
`apps/Veertex/`, e agora os pacotes estão fora. O Veertex passa a ser publicado como os outros
cinco, e é assim que o Dokploy deve apontar para ele: `Docker Context Path = .` e
`Dockerfile Path = apps/Veertex/backend/Dockerfile`.

**O substituto já existe, e é o mecanismo da casa.** O Kortex resolveu o mesmo problema em
16-18/08/2026 com um **espelho de conteúdo**: `apps/Kortex/deploy/publish-mirror.sh` monta o recorte
(`packages/` + `apps/Kortex/` + manifests da raiz) num diretório descartável, encadeia um commit no
histórico remoto e dá `push` fast-forward numa branch protegida. O Veertex ganhou o equivalente:

```bash
./apps/Veertex/deploy/publish-mirror.sh --dry-run   # confere o recorte
./apps/Veertex/deploy/publish-mirror.sh             # publica
```

⚠️ **Ainda não foi publicado.** O `gitlab.com/eliab1/veertex` continua com o layout do subtree (o app
na raiz, com os pacotes copiados dentro). A primeira publicação neste formato **exige reconfigurar o
Dokploy**, porque o caminho do Dockerfile muda:

| | antes | agora |
|---|---|---|
| Dockerfile Path (backend) | `backend/Dockerfile` | `apps/Veertex/backend/Dockerfile` |
| Dockerfile Path (frontend) | `frontend/Dockerfile` | `apps/Veertex/frontend/Dockerfile` |
| Docker Context Path | `/` | `/` (não muda) |

Publicar sem esse ajuste faz o build falhar em "Dockerfile not found" — e o serviço no ar continua
sendo a versão velha até que alguém repare.

## A lição, já registrada no `CLAUDE.md`

Este ADR virou um caso da **regra 4**: "duas cópias vão divergir" era previsão correta, e mesmo
assim eu tratei a divergência como custo aceito sem nunca ter medido se ela já havia ocorrido.
Bastava um `diff`.
