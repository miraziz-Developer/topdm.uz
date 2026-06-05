#!/usr/bin/env bash
# Production smoke — https://bozorliii.online
set -euo pipefail

SITE="${SITE:-https://bozorliii.online}"
CRM="${CRM:-https://crm.bozorliii.online}"
API="${API:-https://api.bozorliii.online}"

fail=0
ok() { echo "OK  $1"; }
bad() { echo "FAIL $1"; fail=1; }

check() {
  local name="$1"
  local url="$2"
  local code
  code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 15 "$url" || echo "000")
  if [[ "$code" =~ ^(200|301|302|307)$ ]]; then
    ok "$name ($code) $url"
  else
    bad "$name ($code) $url"
  fi
}

check_json() {
  local name="$1"
  local url="$2"
  if curl -fsSk --max-time 15 "$url" | grep -q '"status":"ok"'; then
    ok "$name"
  else
    bad "$name"
  fi
}

echo "== Smoke: $SITE =="
check_json "API health" "$API/health"
check_json "Site health" "$SITE/health"
check "Site home" "$SITE/"
check "CRM login" "$CRM/login"
check "www" "https://www.bozorliii.online/"
check_json "API health (direct)" "$API/health"

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "SMOKE PASSED"
  exit 0
fi
echo "SMOKE FAILED"
exit 1
