#!/usr/bin/env bash
# One command: CRM mobile wrapper + stack smoke (everything automatable on this Mac).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=========================================="
echo " Topdim — merchant mobile full bootstrap"
echo "=========================================="

echo ""
echo "[1/5] Docker stack (backend + merchant-crm + frontend)"
if command -v docker >/dev/null 2>&1; then
  docker compose up -d postgres redis backend merchant-crm frontend 2>&1 | tail -20
  sleep 3
else
  echo "WARN docker not found — skip containers"
fi

echo ""
echo "[2/5] DB migrations"
if docker compose ps backend 2>/dev/null | grep -q Up; then
  docker compose exec -T backend alembic upgrade head 2>&1 | tail -5
else
  echo "WARN backend container not up"
fi

echo ""
echo "[3/5] Merchant CRM build"
(cd merchant-crm && npm run build) 2>&1 | tail -8

echo ""
echo "[4/5] Native wrapper (Capacitor)"
export MERCHANT_CRM_URL="${MERCHANT_CRM_URL:-http://localhost:3003}"
export CAPACITOR_DISABLE_TELEMETRY=1
bash "$ROOT/scripts/setup-merchant-mobile.sh" || true

echo ""
echo "[5/5] Smoke tests"
if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
  bash "$ROOT/scripts/smoke-all.sh" http://localhost:3002 http://localhost:3003 http://localhost:8000 || true
else
  echo "WARN API not on :8000 — start: docker compose up -d"
fi

echo ""
echo "=========================================="
echo " DONE — what works now"
echo "=========================================="
echo "• Merchant CRM web:  http://localhost:3003"
echo "• Orders + Yandex:   http://localhost:3003/dashboard/orders"
echo "• PWA install:       open CRM in phone browser → install banner"
echo "• Android project:   merchant-crm-mobile/android (open in Android Studio)"
echo "• iOS project:       merchant-crm-mobile/ios (needs Xcode + pod install)"
echo ""
echo "Native store build requires on Mac:"
echo "  Xcode (App Store), CocoaPods, Android Studio"
echo "  See: docs/MERCHANT_MOBILE_MAC_SETUP.md"
echo "=========================================="
