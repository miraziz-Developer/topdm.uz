#!/usr/bin/env bash
set -euo pipefail

# ─── Bozorliii Admin Diagnostics ─────────────────────────────────────
# Barcha admin endpointlarini tekshiradi
# Foydalanish: scripts/diagnose-admin.sh

BASE_URL="https://admin.bozorliii.online"
COOKIE_FILE=$(mktemp)
PASS="mirR@2007aziz"
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

print_header() { echo -e "${BLUE}==> $1${NC}"; }
print_ok()   { echo -e "${GREEN}   ✓ $1${NC}"; }
print_err()  { echo -e "${RED}   ✗ $1${NC}"; }

# ─── 1. Login ────────────────────────────────────────────────────────
print_header "1. Login (cookie)"
LOGIN_STATUS=$(curl -sS -w "%{http_code}" \
  -c "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"'$PASS'"}' \
  -o /tmp/login.json 2>/dev/null)
if [[ "$LOGIN_STATUS" == "200" ]]; then
  print_ok "Login OK"
  cat /tmp/login.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   username: {d.get(\"username\",\"?\")}, status: {d.get(\"status\",\"?\")}')" 2>/dev/null || true
else
  print_err "Login failed (HTTP $LOGIN_STATUS)"
fi

# ─── 2. Dashboard API ──────────────────────────────────────────────
print_header "2. GET /api/v1/admin/dashboard"
DASH_STATUS=$(curl -sS -w "%{http_code}" \
  -b "$COOKIE_FILE" "$BASE_URL/api/v1/admin/dashboard" \
  -o /tmp/dashboard.json 2>/dev/null)
if [[ "$DASH_STATUS" == "200" ]]; then
  print_ok "Dashboard JSON OK"
  python3 -c "
import sys,json
d=json.load(sys.stdin)
c=d.get('counts',{})
t=d.get('totals',{})
print(f'   pending_shops={c.get(\"pending_shops\",0)}, orders={t.get(\"orders\",0)}, users={t.get(\"users\",0)}')
" < /tmp/dashboard.json 2>/dev/null || true
else
  print_err "Dashboard failed (HTTP $DASH_STATUS)"
fi

# ─── 3. Analytics API ─────────────────────────────────────────────
print_header "3. GET /api/v1/admin/dashboard/analytics"
ANALYTICS_STATUS=$(curl -sS -w "%{http_code}" \
  -b "$COOKIE_FILE" "$BASE_URL/api/v1/admin/dashboard/analytics?days=7" \
  -o /tmp/analytics.json 2>/dev/null)
if [[ "$ANALYTICS_STATUS" == "200" ]]; then
  print_ok "Analytics JSON OK"
  python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'   days={d.get(\"days\",0)}, series={len(d.get(\"orders_series\",[]))} points')
" < /tmp/analytics.json 2>/dev/null || true
else
  print_err "Analytics failed (HTTP $ANALYTICS_STATUS)"
  python3 -m json.tool < /tmp/analytics.json 2>/dev/null || cat /tmp/analytics.json | head -5
fi

# ─── 4. Summary ─────────────────────────────────────────────────────
echo ""
print_header "Summary"
if [[ "$DASH_STATUS" == "200" && "$ANALYTICS_STATUS" == "200" ]]; then
  print_ok "Server API is healthy. Issue is likely in browser/frontend."
else
  print_err "Server API has issues."
fi

# Cleanup
rm -f "$COOKIE_FILE" /tmp/login.json /tmp/dashboard.json /tmp/analytics.json
