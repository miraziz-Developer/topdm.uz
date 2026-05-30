#!/usr/bin/env bash
# Merchant chat smoke (requires MERCHANT_JWT from CRM login).
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:8000}"
API="${BASE}/api/v1"
TOKEN="${MERCHANT_JWT:-}"

if [[ -z "$TOKEN" ]]; then
  echo "Skip: set MERCHANT_JWT to a merchant access token (login via merchant-crm)." >&2
  exit 0
fi

code=$(curl -sS -o /tmp/m_threads.json -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API/merchant/chat/threads" || echo "000")
[[ "$code" == "200" ]] || { echo "FAIL GET /merchant/chat/threads → $code" >&2; exit 1; }
echo "OK merchant chat threads ($code)"
python3 -c "import json;d=json.load(open('/tmp/m_threads.json'));print(' threads:', len(d.get('items') or []))"
