#!/usr/bin/env bash
set -euo pipefail

# Bozorliii Admin Diagnostics
# Barcha admin endpointlarini tekshiradi
# Foydalanish:
#   ADMIN_BASE_URL=https://admin.example.com \
#   ADMIN_PANEL_USERNAME=admin \
#   ADMIN_PANEL_PASSWORD='***' \
#   scripts/diagnose-admin.sh

BASE_URL="${ADMIN_BASE_URL:-https://admin.bozorliii.online}"
USERNAME="${ADMIN_PANEL_USERNAME:-admin}"
PASS="${ADMIN_PANEL_PASSWORD:-}"
COOKIE_FILE=$(mktemp)
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

print_header() { echo -e "${BLUE}==> $1${NC}"; }
print_ok()   { echo -e "${GREEN}   ✓ $1${NC}"; }
print_err()  { echo -e "${RED}   ✗ $1${NC}"; }

if [[ -z "$PASS" ]]; then
  print_err "ADMIN_PANEL_PASSWORD berilmagan. Uni env orqali uzating."
  exit 1
fi

# 1. Login
print_header "1. Login (cookie)"
LOGIN_STATUS=$(curl -sS -w "%{http_code}" \
  -c "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"'"$USERNAME"'","password":"'"$PASS"'"}' \
  -o /tmp/login.json 2>/dev/null)
if [[ "$LOGIN_STATUS" == "200" ]]; then
  print_ok "Login OK"
  cat /tmp/login.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   username: {d.get(\"username\",\"?\")}, status: {d.get(\"status\",\"?\")}')" 2>/dev/null || true
else
  print_err "Login failed (HTTP $LOGIN_STATUS)"
fi

# 2. Dashboard API
print_header "2. GET /api/v1/admin/dashboard"
DASH_STATUS=$(curl -sS -w "%{http_code}" \
  -b "$COOKIE_FILE" "$BASE_URL/api/v1/admin/dashboard" \
  -o /tmp/dashboard.json 2>/dev/null)
if [[ "$DASH_STATUS" == "200" ]]; then
  print_ok "Dashboard JSON OK"
  python3 -c '
import sys,json
try:
    d=json.load(sys.stdin)
    print("   dashboard response received")
except Exception:
    pass
' < /tmp/dashboard.json 2>/dev/null || true
else
  print_err "Dashboard failed (HTTP $DASH_STATUS)"
fi

# 3. Analytics API
print_header "3. GET /api/v1/admin/dashboard/analytics"
ANALYTICS_STATUS=$(curl -sS -w "%{http_code}" \
  -b "$COOKIE_FILE" "$BASE_URL/api/v1/admin/dashboard/analytics?days=7" \
  -o /tmp/analytics.json 2>/dev/null)
if [[ "$ANALYTICS_STATUS" == "200" ]]; then
  print_ok "Analytics JSON OK"
else
  print_err "Analytics failed (HTTP $ANALYTICS_STATUS)"
  python3 -m json.tool < /tmp/analytics.json 2>/dev/null || cat /tmp/analytics.json | head -5
fi

echo ""
print_header "Summary"
if [[ "$DASH_STATUS" == "200" && "$ANALYTICS_STATUS" == "200" ]]; then
  print_ok "Server API is healthy."
else
  print_err "Server API has issues."
fi

rm -f "$COOKIE_FILE" /tmp/login.json /tmp/dashboard.json /tmp/analytics.json
