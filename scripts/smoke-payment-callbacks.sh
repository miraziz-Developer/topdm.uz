#!/usr/bin/env bash
# Callback security smoke for Click/Payme endpoints.
# This validates hardening behavior (reject invalid/stale/unauthorized requests).
set -euo pipefail

BASE="${1:-http://127.0.0.1:8000}"
API="${BASE%/}/api/v1/payments"

ok() { echo "OK   $*"; }
warn() { echo "WARN $*"; }
fail() { echo "FAIL $*" >&2; exit 1; }

echo "=== Payment callback smoke ==="
echo "API=$API"

click_code=$(curl -sS -o /tmp/click_invalid.json -w "%{http_code}" \
  -X POST "$API/callback/click" \
  -H "Content-Type: application/json" \
  -d '{"merchant_trans_id":"00000000-0000-0000-0000-000000000000","click_trans_id":"smoke","amount":"1000","action":"1","error":"0","sign_time":"1","sign_string":"bad"}' || echo "000")
if [[ "$click_code" == "403" || "$click_code" == "408" ]]; then
  ok "Click invalid/stale callback rejected ($click_code)"
elif [[ "$click_code" == "200" ]] && grep -q '"error":[[:space:]]*-[0-9]\+' /tmp/click_invalid.json; then
  warn "Click callback accepted in debug mode (likely CLICK_* secret not configured)"
else
  fail "Click callback must reject invalid signature/time, got HTTP $click_code"
fi

payme_code=$(curl -sS -o /tmp/payme_invalid.json -w "%{http_code}" \
  -X POST "$API/callback/payme" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"smoke-1","method":"CheckPerformTransaction","params":{"amount":1000,"time":1,"account":{"checkout_id":"00000000-0000-0000-0000-000000000000"}}}' || echo "000")
if [[ "$payme_code" == "403" || "$payme_code" == "408" ]]; then
  ok "Payme unauthorized/stale callback rejected ($payme_code)"
elif [[ "$payme_code" == "200" ]] && grep -q '"error"' /tmp/payme_invalid.json; then
  warn "Payme returned JSON-RPC error in debug mode ($payme_code)"
else
  fail "Payme callback must reject unauthorized/stale requests, got HTTP $payme_code"
fi

live_opts=$(curl -sS "${BASE%/}/api/v1/platform/checkout-payment-options" || echo "{}")
if echo "$live_opts" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok" if isinstance(d,dict) else "bad")' >/dev/null 2>&1; then
  ok "Checkout payment options endpoint reachable"
else
  warn "Checkout options response parse issue"
fi

echo "=== Payment callback smoke passed ==="
