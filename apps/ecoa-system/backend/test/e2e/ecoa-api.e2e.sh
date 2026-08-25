#!/usr/bin/env bash
# Live end-to-end API tests for Ecoa (auth + tenant isolation + guards).
# PREREQUISITES: backend running on :3001 with a REAL DATABASE_URL, tables created
#   (node scripts/db-schema.js). Run:  bash test/e2e/ecoa-api.e2e.sh
set -u
BASE="${BASE:-http://localhost:3001/api}"
pass=0; fail=0
check() { # desc expected actual
  if [ "$2" = "$3" ]; then echo "  PASS  $1 ($3)"; pass=$((pass+1));
  else echo "  FAIL  $1 (esperado $2, obtido $3)"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
json() { curl -s "$@"; }
field() { sed -n "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p" <<<"$1"; }

STAMP=$(date +%s 2>/dev/null || echo 0)
EA="a_${STAMP}@ecoa.test"; EB="b_${STAMP}@ecoa.test"; PW="senha12345"

echo "== Auth =="
check "registro A" 201 "$(code -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"Alice\",\"email\":\"$EA\",\"password\":\"$PW\"}")"
check "registro duplicado A" 400 "$(code -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"Alice\",\"email\":\"$EA\",\"password\":\"$PW\"}")"
check "login senha errada" 401 "$(code -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EA\",\"password\":\"errada\"}")"

TOKA=$(field "$(json -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EA\",\"password\":\"$PW\"}")" accessToken)
check "me sem token" 401 "$(code "$BASE/auth/me")"
check "me com token A" 200 "$(code "$BASE/auth/me" -H "Authorization: Bearer $TOKA")"

echo "== Conexão / watchlist (tenant A) =="
check "connection status A" 200 "$(code "$BASE/connection" -H "Authorization: Bearer $TOKA")"
ADD=$(json -X POST "$BASE/watchlist" -H "Authorization: Bearer $TOKA" -H 'Content-Type: application/json' -d '{"handle":"anamaria"}')
WID=$(field "$ADD" id)
check "add watchlist A" 201 "$(code -X POST "$BASE/watchlist" -H "Authorization: Bearer $TOKA" -H 'Content-Type: application/json' -d '{"handle":"josepereira"}')"
LISTA=$(json "$BASE/watchlist" -H "Authorization: Bearer $TOKA")
if grep -q "anamaria" <<<"$LISTA"; then echo "  PASS  lista A contém anamaria"; pass=$((pass+1)); else echo "  FAIL  lista A não contém anamaria"; fail=$((fail+1)); fi

echo "== Isolamento de tenant (A x B) =="
curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"Bob\",\"email\":\"$EB\",\"password\":\"$PW\"}" >/dev/null
TOKB=$(field "$(json -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EB\",\"password\":\"$PW\"}")" accessToken)
LISTB=$(json "$BASE/watchlist" -H "Authorization: Bearer $TOKB")
if grep -q "anamaria" <<<"$LISTB"; then echo "  FAIL  VAZAMENTO: B vê a lista de A"; fail=$((fail+1)); else echo "  PASS  B não vê a lista de A"; pass=$((pass+1)); fi
check "B não deleta item de A (404)" 404 "$(code -X DELETE "$BASE/watchlist/$WID" -H "Authorization: Bearer $TOKB")"

echo "== Detecções (A) =="
check "detections summary A" 200 "$(code "$BASE/detections/summary" -H "Authorization: Bearer $TOKA")"

echo "== Webhook (público, verificado) =="
check "webhook verify token errado" 403 "$(code "$BASE/webhooks/instagram?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1")"
check "webhook POST sem assinatura" 403 "$(code -X POST "$BASE/webhooks/instagram" -H 'Content-Type: application/json' -d '{"object":"instagram","entry":[]}')"

echo ""
echo "RESUMO: $pass passaram, $fail falharam"
[ "$fail" -eq 0 ]
