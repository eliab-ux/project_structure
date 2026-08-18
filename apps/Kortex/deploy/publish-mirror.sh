#!/usr/bin/env bash
#
# Publica o RECORTE ESPELHADO do Kortex em git@gitlab.com:eliab1/kortex.git
#
#   ./apps/Kortex/deploy/publish-mirror.sh            # publica o HEAD atual
#   ./apps/Kortex/deploy/publish-mirror.sh --dry-run  # mostra o que iria, sem empurrar
#
# ---------------------------------------------------------------------------
# Por que não é `git subtree`
# ---------------------------------------------------------------------------
# `git subtree split` extrai UM prefixo. O recorte precisa de TRÊS coisas na raiz — `packages/`,
# `apps/Kortex/` e o `package.json` de workspace — e elas não compartilham prefixo. Rodar três
# splits e costurá-los produziria um histórico que não corresponde a nenhum commit real do
# monorepo, e a primeira vez que alguém precisasse comparar os dois repositórios o resultado seria
# inútil.
#
# Então isto é um espelho de CONTEÚDO, não de histórico: cada publicação é UM commit no
# repositório-espelho, com a árvore exata do recorte e uma mensagem que aponta para o commit de
# origem. O monorepo continua sendo a fonte da verdade; o espelho existe para o Dokploy ter o que
# clonar.
#
# ---------------------------------------------------------------------------
# Como funciona
# ---------------------------------------------------------------------------
# Um diretório descartável em /tmp onde a árvore é montada do zero, por `git archive`. Nunca é uma
# cópia por cima do clone anterior: arquivo apagado no monorepo precisa DESAPARECER do espelho, e
# um `cp -r` sobre um clone existente deixaria o arquivo velho lá.
#
# O commit é encadeado no histórico remoto (`git fetch` + `reset --mixed`), não órfão. Isso importa
# por dois motivos:
#
#   1. **`git push` normal, sem `--force`.** A `main` do espelho é branch protegida no GitLab, e
#      protegida ela recusa force push — como deve. Um script que exige desproteger a branch para
#      funcionar está pedindo para enfraquecer o repositório por conveniência dele.
#   2. **Dá para ver o que mudou entre duas publicações.** Com commits órfãos todo diff é "o
#      repositório inteiro", e a primeira vez que alguém precisar descobrir o que foi para
#      produção na terça o histórico não responde.
#
# A árvore continua sendo substituída por inteiro: depois do `reset --mixed`, o `git add --all`
# enxerga como deleção todo arquivo que existe no remoto e não existe no recorte. Se o GitLab tiver
# criado um README na inicialização, ele sai — o espelho reflete o recorte, e nada além dele.
set -euo pipefail

REMOTE_URL="git@gitlab.com:eliab1/kortex.git"
REMOTE_NAME="kortex-mirror"
BRANCH="main"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

# Caminhos que compõem o recorte. Ordem irrelevante; o conteúdo é que importa.
PATHS=(
  "package.json"
  "package-lock.json"
  "tsconfig.base.json"
  ".dockerignore"
  "packages"
  "apps/Kortex"
)

cd "$(git rev-parse --show-toplevel)"

if [[ -n "$(git status --porcelain -- "${PATHS[@]}")" ]]; then
  echo "❌ Há alterações não commitadas no recorte. Commite antes de publicar —" >&2
  echo "   publicar árvore suja produz um espelho que não corresponde a commit nenhum." >&2
  git status --short -- "${PATHS[@]}" >&2
  exit 1
fi

SOURCE_SHA="$(git rev-parse HEAD)"
SOURCE_SHORT="$(git rev-parse --short HEAD)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "→ Montando o recorte a partir de ${SOURCE_SHORT}"
# `git archive` e não `cp`: leva exatamente o que está COMMITADO, respeitando .gitattributes, e
# ignora qualquer coisa não rastreada que esteja no diretório de trabalho.
git archive "$SOURCE_SHA" -- "${PATHS[@]}" | tar -x -C "$STAGE"

# Sanidade: sem estes três, o Dockerfile do backend falha no COPY e o erro só aparece no build do
# servidor — longe de quem publicou.
for obrigatorio in "package.json" "package-lock.json" "packages/domain-primitives" "apps/Kortex/backend/Dockerfile"; do
  if [[ ! -e "$STAGE/$obrigatorio" ]]; then
    echo "❌ Recorte incompleto: falta $obrigatorio" >&2
    exit 1
  fi
done

# O workspace do espelho declara só o que existe nele. O package.json do monorepo lista os outros
# apps, e `npm ci` no servidor falharia procurando pastas que o recorte não tem.
node -e '
const fs = require("fs");
const p = process.argv[1] + "/package.json";
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
pkg.workspaces = ["packages/*", "apps/Kortex/backend", "apps/Kortex/frontend"];
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
' "$STAGE"

echo "→ Conteúdo do recorte:"
(cd "$STAGE" && find . -maxdepth 2 -not -path '*/.*' | sort | sed 's/^/    /')

if [[ $DRY_RUN -eq 1 ]]; then
  echo "✓ --dry-run: nada foi empurrado. Recorte montado em $STAGE (será apagado ao sair)."
  exit 0
fi

echo "→ Publicando em ${REMOTE_URL} (${BRANCH})"
cd "$STAGE"
git init --quiet --initial-branch="$BRANCH"
git remote add "$REMOTE_NAME" "$REMOTE_URL"

# Encadeia no histórico remoto quando ele existe. `--mixed` move HEAD e índice para o commit
# remoto e NÃO toca no diretório de trabalho — que já contém o recorte montado. O `git add --all`
# seguinte enxerga a diferença completa, inclusive as deleções.
if git fetch --quiet --depth=1 "$REMOTE_NAME" "$BRANCH" 2>/dev/null; then
  echo "  (encadeando sobre o histórico existente do espelho)"
  git reset --quiet --mixed FETCH_HEAD
else
  echo "  (espelho vazio — primeira publicação)"
fi

git add --all

if git diff --cached --quiet 2>/dev/null; then
  echo "✓ O espelho já está idêntico a ${SOURCE_SHORT}. Nada a publicar."
  exit 0
fi
git -c user.name="$(git -C - config user.name 2>/dev/null || echo Kortex)" \
    -c user.email="$(git -C - config user.email 2>/dev/null || echo deploy@kortex.ind.br)" \
    commit --quiet -m "chore(kortex): espelho do monorepo em ${SOURCE_SHORT}

Recorte gerado por apps/Kortex/deploy/publish-mirror.sh.
Origem: monorepo Veertex, commit ${SOURCE_SHA}.

Este repositório é um ESPELHO DE CONTEÚDO — não edite aqui. Toda alteração
nasce no monorepo e chega por uma nova publicação."

# Sem `--force`: o commit está encadeado no histórico remoto, então o push é fast-forward. Se ele
# for recusado por não-fast-forward, alguém editou o espelho à mão — e isso é para ser
# investigado, não atropelado.
git push --quiet "$REMOTE_NAME" HEAD:"$BRANCH"

echo "✓ Publicado. O Dokploy pode fazer Deploy a partir de ${REMOTE_URL} (${BRANCH})."
