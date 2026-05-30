#!/usr/bin/env bash
set -euo pipefail

SITE="${1:-http://localhost:3002}"
CRM="${2:-http://localhost:3003}"
API="${3:-http://localhost:8000}"

SITE="${SITE%/}"
CRM="${CRM%/}"
API="${API%/}"

echo "Waiting for local-prod readiness…"
echo "  SITE=$SITE"
echo "  CRM =$CRM"
echo "  API =$API"

deadline=$((SECONDS + 90))

check() {
  local name="$1"
  local url="$2"
  if curl -fsS --max-time 2 "$url" >/dev/null; then
    echo "OK  $name"
    return 0
  fi
  return 1
}

while (( SECONDS < deadline )); do
  ok=1
  check "API /health" "$API/health" || ok=0
  check "SITE /" "$SITE/" || ok=0
  check "CRM /login" "$CRM/login" || ok=0
  if [[ "$ok" == "1" ]]; then
    echo "Ready."
    exit 0
  fi
  sleep 2
done

echo "FAIL: local-prod not ready after 90s"
exit 1

