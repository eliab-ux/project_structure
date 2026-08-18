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
# Então isto é um espelho de CONTEÚDO, não de histórico: cada publicação é um commit único no
# repositório-espelho, com a árvore exata do recorte e uma mensagem que aponta para o commit de
# origem. O monorepo continua sendo a fonte da verdade; o espelho existe para o Dokploy ter o que
# clonar.
#
# ---------------------------------------------------------------------------
# Como funciona
# ---------------------------------------------------------------------------
# Um worktree descartável em /tmp, com um branch órfão por publicação. Nada é copiado por cima do
# clone anterior: a árvore é montada do zero a cada vez, então arquivo apagado no monorepo
# desaparece do espelho — que é justamente o que um `cp -r` sobre um clone existente NÃO faz.
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
git add --all
git -c user.name="$(git -C - config user.name 2>/dev/null || echo Kortex)" \
    -c user.email="$(git -C - config user.email 2>/dev/null || echo deploy@kortex.ind.br)" \
    commit --quiet -m "chore(kortex): espelho do monorepo em ${SOURCE_SHORT}

Recorte gerado por apps/Kortex/deploy/publish-mirror.sh.
Origem: monorepo Veertex, commit ${SOURCE_SHA}.

Este repositório é um ESPELHO DE CONTEÚDO — não edite aqui. Toda alteração
nasce no monorepo e chega por uma nova publicação."

git remote add "$REMOTE_NAME" "$REMOTE_URL"
# `--force`: cada publicação substitui a anterior. O histórico do espelho é uma sequência de
# fotos, e reescrevê-la é o comportamento pretendido, não um acidente.
git push --force "$REMOTE_NAME" "$BRANCH"

echo "✓ Publicado. O Dokploy pode fazer Deploy a partir de ${REMOTE_URL} (${BRANCH})."
