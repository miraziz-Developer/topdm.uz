#!/usr/bin/env bash
# Local / CI gate: config + static checks + optional live smoke.
# Usage:
#   ./scripts/world-class-verify.sh
#   API=http://127.0.0.1:8000 ./scripts/world-class-verify.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API="${API:-http://127.0.0.1:8000}"
FRONTEND="${FRONTEND:-http://127.0.0.1:3002}"

echo "========================================"
echo " Topdim.UZ world-class verify"
echo "========================================"

bash "$ROOT/scripts/preflight-deploy.sh"

echo ""
echo "-- Backend static verify --"
python3 "$ROOT/scripts/verify_backend_core.py"
python3 "$ROOT/scripts/verify_frontend_api_contract.py"

echo ""
echo "-- Frontend production build --"
(
  cd "$ROOT/frontend"
  if [[ ! -d node_modules ]]; then npm ci --prefer-offline --no-audit --no-fund; fi
  npm run build
)

if curl -sf "${API}/health" >/dev/null 2>&1; then
  echo ""
  echo "-- API health --"
  curl -sS "${API}/health" | head -c 400
  echo ""
  if curl -sf "${API}/api/v1/health" >/dev/null 2>&1; then
    echo "OK  /api/v1/health"
  fi
  echo ""
  echo "-- Stylist smoke --"
  bash "$ROOT/scripts/smoke-stylist-chat.sh" "${API}/api/v1" || true
  echo ""
  echo "-- Image search smoke --"
  bash "$ROOT/scripts/smoke-image-search.sh" "${API}/api/v1" || true
else
  echo ""
  echo "SKIP live API smoke (start: docker compose up -d)"
fi

if curl -sf "${FRONTEND}/api/v1/health" >/dev/null 2>&1; then
  echo "OK  frontend proxy → backend (${FRONTEND})"
fi

CRM="${CRM:-http://127.0.0.1:3003}"
if curl -sf "${CRM}/login" >/dev/null 2>&1; then
  echo ""
  echo "-- Merchant CRM smoke --"
  bash "$ROOT/scripts/smoke-merchant-crm.sh" "${CRM}" "${API}/api/v1" || true
fi

echo ""
echo "WORLD-CLASS VERIFY PASSED (static + build)"
echo "Deploy: docker compose -f docker-compose.prod.yml up -d --build"
echo "Prod smoke: ./scripts/smoke-all.sh https://topdim.uz https://crm.topdim.uz https://api.topdim.uz"
