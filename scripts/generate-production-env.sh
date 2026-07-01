#!/usr/bin/env bash
# Build production .env from local secrets — NEVER commit output.
# Usage: ./scripts/generate-production-env.sh > .env.production.local
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${1:-}"
if [[ -z "$SRC" ]]; then
  for candidate in .env .env.example; do
    if [[ -f "$ROOT/$candidate" ]] && grep -qE '^(GROQ_API_KEY|TELEGRAM_BOT_TOKEN)=' "$ROOT/$candidate" 2>/dev/null; then
      SRC="$ROOT/$candidate"
      break
    fi
  done
fi
SRC="${SRC:-$ROOT/.env}"

if [[ ! -f "$SRC" ]]; then
  echo "Missing secrets source — cp .env.example .env and fill keys, or pass path" >&2
  exit 1
fi

# shellcheck disable=SC1090
source_env() {
  grep -E "^${1}=" "$SRC" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's/^"//;s/"$//' || true
}

val() { source_env "$1"; }

DB_PASS="${POSTGRES_PASSWORD:-$(openssl rand -hex 16)}"
JWT="${JWT_SECRET:-$(openssl rand -hex 32)}"
ADMIN="${ADMIN_API_KEY:-$(openssl rand -hex 24)}"

cat <<EOF
# Generated for production — $(date -u +%Y-%m-%dT%H:%MZ)
APP_NAME=Bozorliii Engine
APP_ENV=production
PRODUCTION=true
APP_DEBUG=false
ALLOW_DEV_MOCKS=false
RUN_SEED=false
API_PREFIX=/api/v1
UVICORN_WORKERS=1

SITE_DOMAIN=bozorliii.online
API_DOMAIN=api.bozorliii.online
CRM_DOMAIN=crm.bozorliii.online
SITE_URL=https://bozorliii.online
MERCHANT_CRM_WEBAPP_URL=https://crm.bozorliii.online
NEXT_PUBLIC_SITE_URL=https://bozorliii.online
NEXT_PUBLIC_MERCHANT_CRM_URL=https://crm.bozorliii.online
CORS_ORIGINS=https://bozorliii.online,https://www.bozorliii.online,https://crm.bozorliii.online,https://api.bozorliii.online

POSTGRES_DB=bozor_ai
POSTGRES_USER=bozor
POSTGRES_PASSWORD=${DB_PASS}
DATABASE_URL=postgresql://bozor:${DB_PASS}@postgres:5432/bozor_ai
REDIS_URL=redis://redis:6379/0

JWT_SECRET=${JWT}
JWT_ALGORITHM=HS256
JWT_EXP_MINUTES=10080
ADMIN_API_KEY=${ADMIN}

TELEGRAM_BOT_TOKEN=$(val TELEGRAM_BOT_TOKEN)
TELEGRAM_BOT_USERNAME=$(val TELEGRAM_BOT_USERNAME)
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$(val NEXT_PUBLIC_TELEGRAM_BOT_USERNAME)

ESKIZ_EMAIL=$(val ESKIZ_EMAIL)
ESKIZ_PASSWORD=$(val ESKIZ_PASSWORD)
ESKIZ_API_TOKEN=$(val ESKIZ_API_TOKEN)
ESKIZ_FROM=$(val ESKIZ_FROM)

RESEND_API_KEY=$(val RESEND_API_KEY)
RESEND_FROM_EMAIL=$(val RESEND_FROM_EMAIL)

GROQ_API_KEY=$(val GROQ_API_KEY)
GROQ_MODEL=$(val GROQ_MODEL)
GOOGLE_API_KEY=$(val GOOGLE_API_KEY)
GEMINI_MODEL=$(val GEMINI_MODEL)
OPENAI_API_KEY=$(val OPENAI_API_KEY)

NEXT_PUBLIC_API_BASE_URL=/api/v1
BACKEND_API_URL=http://backend:8000
NEXT_PUBLIC_YANDEX_MAPS_API_KEY=$(val NEXT_PUBLIC_YANDEX_MAPS_API_KEY)
NEXT_PUBLIC_MAP_PROVIDER=yandex-maps-api

ENABLE_ONLINE_CHECKOUT=false
NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT=false
PAYMENT_SANDBOX_MODE=false
PAYMENT_CHECKOUT_BASE_URL=https://bozorliii.online

ENABLE_CHINA_MARKET=false
NEXT_PUBLIC_ENABLE_CHINA_MARKET=false
PREMIUM_CHINA_DEMO_MODE=false
TDB_BTS_API_MOCK=false
TDB_P2P_PROVIDER_MOCK=false

MEDIA_STORAGE_BACKEND=local
S3_ENDPOINT_URL=$(val S3_ENDPOINT_URL)
S3_BUCKET=$(val S3_BUCKET)
S3_ACCESS_KEY_ID=$(val S3_ACCESS_KEY_ID)
S3_SECRET_ACCESS_KEY=$(val S3_SECRET_ACCESS_KEY)
S3_PUBLIC_BASE_URL=$(val S3_PUBLIC_BASE_URL)
NEXT_PUBLIC_MEDIA_CDN_URL=$(val NEXT_PUBLIC_MEDIA_CDN_URL)

BTS_API_BASE_URL=$(val BTS_API_BASE_URL)
BTS_API_LOGIN=$(val BTS_API_LOGIN)
BTS_API_PASSWORD=$(val BTS_API_PASSWORD)
BTS_API_TOKEN=$(val BTS_API_TOKEN)
BTS_API_MOCK=false
BTS_DEFAULT_CITY_CODE=$(val BTS_DEFAULT_CITY_CODE)
ENABLE_ONLINE_CHECKOUT=$(val ENABLE_ONLINE_CHECKOUT)
NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT=$(val NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT)

HTTP_PORT=80
HTTPS_PORT=443
FRONTEND_PORT=3002
MERCHANT_CRM_PORT=3003
EOF
