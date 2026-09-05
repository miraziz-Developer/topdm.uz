#!/usr/bin/env bash
# WEB server preflight — split deploy
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ENV_FILE:-.env}"
fail=0

die() { echo "FAIL: $1"; fail=1; }
ok() { echo "OK  $1"; }

echo "== Preflight WEB split ($ENV_FILE) =="

[[ -f "$ENV_FILE" ]] || { die "Missing $ENV_FILE — cp .env.web.example .env"; exit 1; }

val() { grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//' || true; }

required_secret() {
  local name="$1" value
  value="$(val "$name")"
  if [[ -z "$value" || "$value" == CHANGE_ME* || ${#value} -lt 24 ]]; then
    die "$name — kamida 24 belgili kuchli secret kiriting"
  else
    ok "$name"
  fi
}

[[ "$(val APP_ENV)" == "production" ]] || die "APP_ENV=production bo'lishi kerak"
[[ "$(val PRODUCTION)" == "true" ]] || die "PRODUCTION=true bo'lishi kerak"
required_secret ADMIN_API_KEY
required_secret ADMIN_PANEL_PASSWORD
required_secret ADMIN_PANEL_SECRET
required_secret ADMIN_SESSION_SECRET

[[ -n "$(val CORE_BACKEND_HOST)" ]] && [[ "$(val CORE_BACKEND_HOST)" != 10.0.0.2 ]] && ok "CORE_BACKEND_HOST" || die "CORE_BACKEND_HOST — CORE private IP kiriting"
[[ -n "$(val BACKEND_API_URL)" ]] && ok "BACKEND_API_URL" || die "BACKEND_API_URL"

if [[ -s deploy/ssl/fullchain.pem && -s deploy/ssl/privkey.pem ]]; then
  ok "TLS deploy/ssl/"
else
  echo "WARN deploy/ssl/ yo'q — bootstrap-ssl.sh ishga tushiring"
fi

if bash deploy/verify-split.sh 2>/dev/null; then
  ok "CORE API reachable"
else
  die "CORE API ga ulanib bo'lmadi — avval CORE serverni ishga tushiring"
fi

[[ "$fail" -eq 0 ]] && echo "== WEB preflight passed ==" || exit 1
