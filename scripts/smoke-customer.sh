#!/usr/bin/env bash
# Customer site smoke checks. Usage: ./scripts/smoke-customer.sh https://topdim.uz
set -euo pipefail

BASE="${1:-http://localhost:3002}"
BASE="${BASE%/}"

echo "== Smoke: $BASE =="

fail=0

check() {
  local name="$1"
  local url="$2"
  local expect="${3:-200}"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "OK  $name -> $code"
  else
    echo "FAIL $name -> $code (expected $expect)"
    fail=1
  fi
}

check "Home" "$BASE/"
check "Search" "$BASE/search"
check "Map" "$BASE/map"
check "Checkout" "$BASE/checkout"
check "Auth" "$BASE/auth"
check "Orders" "$BASE/orders"
check "Robots" "$BASE/robots.txt"
check "Sitemap" "$BASE/sitemap.xml"

check "API health" "$BASE/api/v1/health" "200"

# Public map stores
code_stores=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/v1/map/stores?market_slug=ippodrom" 2>/dev/null || echo "000")
if [[ "$code_stores" == "200" ]]; then
  echo "OK  Map stores API -> 200"
else
  echo "WARN Map stores API -> $code_stores"
fi

# Payment options (no auth)
code_pay=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/v1/platform/checkout-payment-options" 2>/dev/null || echo "000")
if [[ "$code_pay" == "200" ]]; then
  echo "OK  Payment options API -> 200"
else
  echo "WARN Payment options -> $code_pay"
fi

if [[ "$fail" -eq 1 ]]; then
  echo "FAIL — critical pages"
  exit 1
fi

echo "PASS customer smoke"
