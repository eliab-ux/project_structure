#!/usr/bin/env bash
#
# Publica o RECORTE ESPELHADO do Veertex em git@gitlab.com:eliab1/veertex.git
#
#   ./apps/Veertex/deploy/publish-mirror.sh            # publica o HEAD atual
#   ./apps/Veertex/deploy/publish-mirror.sh --dry-run  # mostra o que iria, sem empurrar
#
# ---------------------------------------------------------------------------
# Por que isto substituiu o `git subtree split`
# ---------------------------------------------------------------------------
# Até 18/08/2026 o Veertex era publicado por `git subtree split --prefix=apps/Veertex`, e isso só
# funcionava porque ele tinha CÓPIA PRÓPRIA dos pacotes compartilhados dentro do prefixo. A cópia
# foi removida (ADR-0002): os pacotes agora são os de `packages/` na raiz, como nos outros apps.
#
# `subtree split` extrai UM prefixo. O recorte precisa de três coisas sem prefixo comum —
# `packages/`, `apps/Veertex/` e os manifests da raiz. Rodar três splits e costurá-los produziria
# um histórico que não corresponde a nenhum commit real do monorepo, e a primeira vez que alguém
# precisasse comparar os dois repositórios o resultado seria inútil.
#
# Então isto é um espelho de CONTEÚDO, não de histórico — o mesmo mecanismo do Kortex
# (`apps/Kortex/deploy/publish-mirror.sh`). Cada publicação é UM commit no repositório-espelho,
# com a árvore exata do recorte e uma mensagem que aponta para o commit de origem. O monorepo
# continua sendo a fonte da verdade; o espelho existe para o Dokploy ter o que clonar.
#
# ---------------------------------------------------------------------------
# Como funciona
# ---------------------------------------------------------------------------
# Um diretório descartável em /tmp onde a árvore é montada do zero, por `git archive`. Nunca é uma
# cópia por cima do clone anterior: arquivo apagado no monorepo precisa DESAPARECER do espelho, e
# um `cp -r` sobre um clone existente deixaria o arquivo velho lá. Isto importa mais do que o
# normal nesta primeira publicação pós-reversão: o espelho ainda contém o layout antigo (o app na
# raiz, com `packages/` copiado), e ele tem de sumir por inteiro.
#
# O commit é encadeado no histórico remoto (`fetch --depth=1` + `reset --mixed`), não órfão: a
# `main` do espelho é branch protegida no GitLab e recusa force push — como deve. Depois do reset,
# `git add --all` enxerga como deleção todo arquivo que existe no remoto e não existe no recorte.
#
# ---------------------------------------------------------------------------
# ⚠️ O Dokploy precisa ser reconfigurado na primeira publicação deste formato
# ---------------------------------------------------------------------------
# O caminho do Dockerfile MUDOU, porque o app deixou de ser a raiz do repositório:
#
#     antes:  Dockerfile Path = backend/Dockerfile
#     agora:  Dockerfile Path = apps/Veertex/backend/Dockerfile     (idem frontend)
#
# `Docker Context Path = /` continua. Sem esse ajuste o build falha em "Dockerfile not found".
set -euo pipefail

REMOTE_URL="git@gitlab.com:eliab1/veertex.git"
REMOTE_NAME="veertex-mirror"
BRANCH="main"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

# Caminhos que compõem o recorte. `tsconfig.json` e `tsconfig.base.json` entram porque os dois
# Dockerfile os copiam explicitamente na primeira camada; sem eles o `COPY` falha no servidor.
PATHS=(
  "package.json"
  "package-lock.json"
  "tsconfig.json"
  "tsconfig.base.json"
  ".dockerignore"
  ".prettierrc"
  ".prettierignore"
  "packages"
  "apps/Veertex"
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

# Sanidade: sem estes, o build falha no servidor — longe de quem publicou.
for obrigatorio in \
  "package.json" "package-lock.json" "tsconfig.json" "tsconfig.base.json" \
  ".prettierrc" ".prettierignore" \
  "packages/domain-primitives" "packages/shared-kernel" \
  "apps/Veertex/backend/Dockerfile" "apps/Veertex/frontend/Dockerfile"; do
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
pkg.workspaces = ["packages/*", "apps/Veertex/backend", "apps/Veertex/frontend"];
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

git -c user.name="Veertex" -c user.email="deploy@veertex.local" \
    commit --quiet -m "chore(veertex): espelho do monorepo em ${SOURCE_SHORT}

Recorte gerado por apps/Veertex/deploy/publish-mirror.sh.
Origem: monorepo project_structure, commit ${SOURCE_SHA}.

Este repositório é um ESPELHO DE CONTEÚDO — não edite aqui. Toda alteração
nasce no monorepo e chega por uma nova publicação."

# Sem `--force`: o commit está encadeado no histórico remoto, então o push é fast-forward. Se ele
# for recusado por não-fast-forward, alguém editou o espelho à mão — e isso é para ser
# investigado, não atropelado.
git push --quiet "$REMOTE_NAME" HEAD:"$BRANCH"

echo "✓ Publicado. O Dokploy pode fazer Deploy a partir de ${REMOTE_URL} (${BRANCH})."
echo "  ⚠️ Primeira publicação neste formato? Ajuste no Dokploy:"
echo "     Dockerfile Path = apps/Veertex/backend/Dockerfile  (e .../frontend/Dockerfile)"
echo "     Docker Context Path = /"
