#!/usr/bin/env bash
# Full stack smoke after deploy.
# Usage: ./scripts/smoke-all.sh [SITE] [CRM] [API_ORIGIN]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE="${1:-https://topdim.uz}"
CRM="${2:-https://crm.topdim.uz}"
API="${3:-https://api.topdim.uz}"

SITE="${SITE%/}"
CRM="${CRM%/}"
API="${API%/}"

echo "========================================"
echo " Topdim.UZ full smoke"
echo " Site: $SITE"
echo " CRM:  $CRM"
echo " API:  $API"
echo "========================================"

fail=0

if ! bash "$ROOT/scripts/smoke-customer.sh" "$SITE"; then
  fail=1
fi

echo ""
if ! bash "$ROOT/scripts/smoke-merchant-crm.sh" "$CRM" "$API/api/v1"; then
  fail=1
fi

echo ""
echo "-- Payment (Click/Payme muzlatilgan) --"
pay_json=$(curl -sS "$SITE/api/v1/platform/checkout-payment-options" 2>/dev/null || echo "{}")
if echo "$pay_json" | grep -qE '"bridge"\s*:\s*false'; then
  echo "OK  online.bridge = false"
else
  echo "WARN checkout-payment-options: $pay_json"
fi

echo ""
if [[ "$fail" -eq 1 ]]; then
  echo "SMOKE FAILED"
  exit 1
fi

echo ""
echo "-- Image search (local API only) --"
if [[ "$API" == *"localhost"* || "$API" == *"127.0.0.1"* ]]; then
  if bash "$ROOT/scripts/smoke-image-search.sh" "$API/api/v1"; then
    echo "OK  image search smoke"
  else
    fail=1
  fi
else
  echo "SKIP image search (set API to localhost to run)"
fi

echo ""
if [[ "$fail" -eq 1 ]]; then
  echo "SMOKE FAILED"
  exit 1
fi
echo "SMOKE PASSED"
