#!/usr/bin/env bash
set -euo pipefail

CRM_URL="${1:-http://localhost:3003}"
API_BASE="${2:-http://localhost:8000/api/v1}"

CRM_URL="${CRM_URL%/}"
API_BASE="${API_BASE%/}"

echo "== Merchant CRM smoke =="
echo "CRM: $CRM_URL"
echo "API: $API_BASE"

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

# Backend health (direct or via /api/v1)
health_url="$API_BASE/health"
check "API health" "$health_url"
check "CRM proxy health" "$CRM_URL/api/v1/health"
check "CRM login page" "$CRM_URL/login"
check "CRM dashboard shell" "$CRM_URL/dashboard" "200"

if [[ "$fail" -eq 1 ]]; then
  echo "FAIL merchant CRM smoke"
  exit 1
fi
echo "PASS merchant CRM smoke"
