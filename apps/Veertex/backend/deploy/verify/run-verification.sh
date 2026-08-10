#!/bin/sh
# ══════════════════════════════════════════════════════════════════════════════════════════════
# Veertex — fila de verificação da F1
#
# RODA DENTRO DO CONTAINER DO BACKEND. É de lá que o Postgres é alcançável (host interno do
# Dokploy, ex.: veertex-veertex-xxxxxx:5432); nenhuma porta precisa estar publicada para fora.
#
#   docker exec -it <container-do-backend> sh /repo/apps/Veertex/backend/deploy/verify/run-verification.sh
#
# Ver deploy/verify/README.md para o passo a passo, incluindo como levar este arquivo para dentro
# do container (a imagem de runtime não carrega deploy/).
#
# `sh`, não `bash`: a imagem é node:22-alpine, que traz busybox ash e não bash.
#
# ── GATE MISTO (§A1) ──────────────────────────────────────────────────────────────────────────
# `set -e` NÃO é usado, e o gate não é uniforme. A distinção é entre etapas independentes e
# dependências reais:
#
#   NÃO-ABORTIVO — verificações independentes. Reporta todas e sai ≠ 0 no fim. Abortar na primeira
#   faria o operador descobrir um problema por execução.
#
#   ABORTIVO — duas etapas, porque seguir adiante é pior que parar:
#     • migration falhou   → o schema não é o esperado; tudo depois vira ruído sobre um banco
#                            desconhecido, e um "verify:isolation falhou" nesse estado não diz se
#                            o problema é a policy ou a tabela que não existe;
#     • verify:isolation   → a fronteira de isolamento está quebrada. Aborta ANTES de qualquer
#       falhou                etapa que ESCREVE (criar conta, seed): gravar dado num banco sem
#                             fronteira é o único erro desta fila que não se desfaz relendo o log.
# ══════════════════════════════════════════════════════════════════════════════════════════════

APP_DIR="${APP_DIR:-/repo/apps/Veertex/backend}"
cd "$APP_DIR" || { echo "❌ Diretório da aplicação não encontrado: $APP_DIR"; exit 1; }

FAILED=0
STEP=0

banner() {
  STEP=$((STEP + 1))
  echo ""
  echo "──────────────────────────────────────────────────────────────────────────────"
  echo " ETAPA $STEP — $1"
  echo "──────────────────────────────────────────────────────────────────────────────"
}

record() {
  if [ "$1" -eq 0 ]; then
    echo "→ ETAPA $STEP: OK"
  else
    echo "→ ETAPA $STEP: FALHOU (código $1)"
    FAILED=$((FAILED + 1))
  fi
}

# Usado só nas duas dependências reais (§A1). Encerra na hora, explicando por que não faz sentido
# continuar — um abort sem motivo escrito parece um bug do script.
abort() {
  echo ""
  echo "══════════════════════════════════════════════════════════════════════════════"
  echo " ⛔ ABORTADO na ETAPA $STEP"
  echo ""
  echo " $1"
  echo ""
  echo " As etapas seguintes NÃO foram executadas. A F1 não está verificada."
  exit 1
}

# ── Pré-condições ─────────────────────────────────────────────────────────────────────────────
# Conferidas antes de qualquer coisa: uma variável ausente faria a primeira etapa falhar com um
# erro de conexão genérico, que manda o operador investigar rede quando o problema é ambiente.
banner "Pré-condições do ambiente"
MISSING=""
for var in DATABASE_URL DATABASE_URL_MIGRATIONS; do
  eval "value=\$$var"
  [ -z "$value" ] && MISSING="$MISSING $var"
done
if [ -n "$MISSING" ]; then
  echo "❌ Variáveis ausentes:$MISSING"
  echo "   As duas são necessárias: a verificação precisa da credencial de RUNTIME para as"
  echo "   asserções e da de OWNER para montar as fixtures. Só com uma delas o resultado não"
  echo "   tem validade."
  exit 1
fi
# Os VALORES nunca são impressos. Só a forma: quem é quem.
echo "✅ DATABASE_URL            → usuário: $(echo "$DATABASE_URL" | sed -E 's#^[a-z]+://([^:]+):.*#\1#')"
echo "✅ DATABASE_URL_MIGRATIONS → usuário: $(echo "$DATABASE_URL_MIGRATIONS" | sed -E 's#^[a-z]+://([^:]+):.*#\1#')"
if [ "$(echo "$DATABASE_URL" | sed -E 's#^[a-z]+://([^:]+):.*#\1#')" = \
     "$(echo "$DATABASE_URL_MIGRATIONS" | sed -E 's#^[a-z]+://([^:]+):.*#\1#')" ]; then
  echo "❌ As duas apontam para o MESMO usuário. O isolamento depende de serem diferentes:"
  echo "   o dono das tabelas ignora as policies, então uma verificação feita com ele passa"
  echo "   mesmo com o RLS desligado."
  exit 1
fi
record 0

# ── 1. Migrations ─────────────────────────────────────────────────────────────────────────────
# Idempotente. Se o container subiu com AUTO_MIGRATE ligado (padrão), o bootstrap já aplicou no
# start e aqui não há nada pendente — rodar de novo CONFIRMA isso em vez de assumir.
#
# Roda como `veertex_owner`, via DATABASE_URL_MIGRATIONS: `veertex_app` não tem DDL, por desenho da
# F1. Ver "Migration — caminho e usuário" no README.
banner "Migrations (usuário owner, DATABASE_URL_MIGRATIONS)"
npm run --silent migrate:prod
STATUS=$?
record $STATUS
# ABORTIVO (§A1): sem saber qual schema está no banco, toda etapa seguinte reporta sobre um estado
# desconhecido — e um "policy ausente" viraria indistinguível de "tabela ausente".
[ $STATUS -ne 0 ] && abort "A migration falhou. Sem o schema esperado, as verificações seguintes
 reportariam sobre um banco desconhecido: uma policy ausente ficaria indistinguível de uma
 tabela que nunca foi criada. Corrija a migration e rode de novo."

# ── 2. Invariantes de configuração ────────────────────────────────────────────────────────────
banner "Invariantes de isolamento — configuração"
echo "Confere: dono das tabelas, atributos dos papéis, RLS ligado com policy em toda tabela com"
echo "account_id, ausência de DELETE/TRUNCATE no runtime, e a função de auth (SECURITY DEFINER,"
echo "do owner, search_path fixo)."
echo ""
npm run --silent verify:isolation:prod
STATUS=$?
record $STATUS
# ABORTIVO (§A1): a fronteira de isolamento está quebrada. As etapas 4 e 5 ESCREVEM, e gravar dado
# num banco sem fronteira é o único erro desta fila que não se desfaz relendo o log.
[ $STATUS -ne 0 ] && abort "A fronteira de isolamento está quebrada. As etapas seguintes incluem
 escrita (criar conta, seed), e gravar dado num banco sem isolamento entre contas é o único erro
 desta fila que não se corrige depois. Releia a violação nomeada acima e corrija o provisionamento."

# ── 3. Comportamento do RLS (§7.2) ────────────────────────────────────────────────────────────
banner "Isolamento entre contas — comportamento (§7.2)"
echo "Cria duas contas temporárias como owner e faz as asserções como veertex_app."
echo "Cada asserção roda em transação com rollback; as fixtures são removidas no final."
echo ""
npm run --silent verify:rls:prod
record $?

# ── 4. Primeira conta (opcional) ──────────────────────────────────────────────────────────────
# Não roda por padrão: criar conta é ação de negócio, não de verificação, e um script de checagem
# que cria dado é um script que ninguém roda duas vezes com tranquilidade.
banner "Primeira conta"
if [ "$CREATE_ACCOUNT" = "true" ]; then
  if [ -z "$ACCOUNT_ARGS" ]; then
    echo "❌ CREATE_ACCOUNT=true exige ACCOUNT_ARGS com os parâmetros do comando."
    echo "   Ver a seção 'Primeira conta' no deploy/verify/README.md."
    record 1
  else
    # shellcheck disable=SC2086  # a expansão em palavras é intencional: são vários argumentos.
    npm run --silent create:account:prod -- $ACCOUNT_ARGS
    record $?
  fi
else
  echo "⏭️  Pulado (CREATE_ACCOUNT != true)."
  echo "    O smoke da etapa 5 precisa de uma conta existente. Se ainda não houver nenhuma,"
  echo "    rode com CREATE_ACCOUNT=true e ACCOUNT_ARGS=\"...\"."
  STEP=$STEP
fi

# ── 5. Smoke do auth ──────────────────────────────────────────────────────────────────────────
banner "Auth ponta a ponta (somente leitura)"
if [ -z "$SMOKE_EMAIL" ] || [ -z "$SMOKE_PASSWORD" ]; then
  echo "⏭️  Pulado: defina SMOKE_EMAIL e SMOKE_PASSWORD com as credenciais de uma conta existente."
  echo "    O smoke não cria conta e não altera senha — roda contra produção."
else
  echo "Bate em 127.0.0.1 (a aplicação), não no domínio público: uma falha de Traefik ou DNS não"
  echo "deve se disfarçar de falha de autenticação."
  echo ""
  npm run --silent smoke:auth:prod
  record $?
fi

# ── 6. WhatsApp / Evolution ───────────────────────────────────────────────────────────────────
banner "Recuperação de senha por WhatsApp"
if [ -n "$EVOLUTION_SYSTEM_INSTANCE" ] && [ -n "$EVOLUTION_SYSTEM_APIKEY" ]; then
  echo "⚠️  Instância configurada, mas esta etapa continua MANUAL de propósito."
  echo "    O endpoint responde 204 exista ou não a conta — é assim por desenho, para não"
  echo "    entregar quais e-mails estão cadastrados. Logo, um teste automático que só olha o"
  echo "    status passaria sem provar que a mensagem chegou. A verificação é: pedir o código"
  echo "    para uma conta real e confirmar o recebimento no aparelho."
else
  echo "⏭️  Pulado: EVOLUTION_SYSTEM_INSTANCE/EVOLUTION_SYSTEM_APIKEY não configuradas."
fi

# ── Resultado ─────────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then
  echo " ✅ FILA VERDE — nenhuma etapa executada falhou."
  echo ""
  echo " Atenção ao que foi PULADO acima: uma etapa pulada não é uma etapa aprovada."
  echo " A F1 só fecha com as etapas 1, 2, 3 e 5 executadas e verdes."
  exit 0
fi
echo " ❌ $FAILED etapa(s) falharam. A F1 NÃO está verificada."
echo ""
echo " Releia a saída da etapa que falhou: os verificadores nomeiam a violação exata"
echo " (tabela, papel, privilégio ou asserção), em vez de só dizer que algo deu errado."
exit 1
