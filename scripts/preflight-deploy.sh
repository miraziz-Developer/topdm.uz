#!/usr/bin/env bash
# Pre-deploy checks — run on server before `docker compose ... up -d --build`
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env}"
fail=0
warn=0

die() { echo "FAIL: $1"; fail=1; }
warn_msg() { echo "WARN: $1"; warn=1; }
ok() { echo "OK  $1"; }

echo "== Preflight deploy ($ENV_FILE) =="

if [[ ! -f "$ENV_FILE" ]]; then
  die "Missing $ENV_FILE — cp .env.production.example .env"
  echo ""
  exit 1
fi

env_val() {
  grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's/^"//;s/"$//;s/^'"'"'//;s/'"'"'$//' || true
}

check_not_placeholder() {
  local name="$1"
  local val
  val="$(env_val "$name")"
  if [[ -z "$val" ]] || [[ "$val" == CHANGE_ME* ]]; then
    die "$name is empty or placeholder"
  else
    ok "$name"
  fi
}

check_not_placeholder POSTGRES_PASSWORD
check_not_placeholder JWT_SECRET
check_not_placeholder ADMIN_API_KEY

if [[ -z "$(env_val TELEGRAM_BOT_TOKEN)" ]]; then
  die "TELEGRAM_BOT_TOKEN (merchant OTP + bot)"
else
  ok "TELEGRAM_BOT_TOKEN"
fi

check_not_placeholder GROQ_API_KEY

groq="$(env_val GROQ_API_KEY)"
google="$(env_val GOOGLE_API_KEY)"
openai="$(env_val OPENAI_API_KEY)"
if [[ -z "$google" && -z "$openai" ]]; then
  die "GOOGLE_API_KEY or OPENAI_API_KEY — katalog embedding (1536-d) uchun kerak"
else
  ok "Embedding keys (GOOGLE and/or OPENAI)"
fi

if [[ -z "$google" ]]; then
  warn_msg "GOOGLE_API_KEY yo'q — rasm qidiruv sifati past (Groq vision fallback)"
else
  ok "GOOGLE_API_KEY"
fi

crm_url="$(env_val MERCHANT_CRM_WEBAPP_URL)"
if [[ -z "$crm_url" ]] || [[ "$crm_url" == http://localhost* ]]; then
  warn_msg "MERCHANT_CRM_WEBAPP_URL — productionda https://crm.bozorliii.uz bo'lishi kerak"
else
  ok "MERCHANT_CRM_WEBAPP_URL"
fi

site_url="$(env_val SITE_URL)"
if [[ -z "$site_url" ]] || [[ "$site_url" == http://localhost* ]]; then
  warn_msg "SITE_URL — productionda https://bozorliii.uz"
else
  ok "SITE_URL"
fi

yandex_maps="$(env_val NEXT_PUBLIC_YANDEX_MAPS_API_KEY)"
if [[ -z "$yandex_maps" ]] || [[ "$yandex_maps" == your-yandex* ]]; then
  warn_msg "NEXT_PUBLIC_YANDEX_MAPS_API_KEY — CRM xarita uchun kerak; merchant-crm rebuild qiling"
else
  ok "NEXT_PUBLIC_YANDEX_MAPS_API_KEY (CRM xarita)"
fi

if [[ -z "$(env_val RESEND_API_KEY)" ]]; then
  warn_msg "RESEND_API_KEY — email OTP ishlamaydi"
else
  ok "RESEND_API_KEY"
fi

if [[ "$(env_val ENABLE_ONLINE_CHECKOUT)" == "true" ]]; then
  warn_msg "ENABLE_ONLINE_CHECKOUT=true — Click/Payme account kerak"
else
  ok "Online checkout OFF (cash/terminal only)"
fi

if [[ "$(env_val NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT)" == "true" ]]; then
  warn_msg "NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT=true — mijoz UI da Click/Payme chiqadi"
fi

media_backend="$(env_val MEDIA_STORAGE_BACKEND)"
media_backend="${media_backend:-local}"
if [[ "$media_backend" == "s3" ]]; then
  check_not_placeholder S3_BUCKET
  check_not_placeholder S3_ACCESS_KEY_ID
  check_not_placeholder S3_SECRET_ACCESS_KEY
  s3_public="$(env_val S3_PUBLIC_BASE_URL)"
  if [[ -z "$s3_public" ]] || [[ "$s3_public" != https://* ]]; then
    die "S3_PUBLIC_BASE_URL — https://media.bozorliii.uz (CDN) majburiy"
  else
    ok "S3_PUBLIC_BASE_URL (CDN)"
  fi
  cdn_fe="$(env_val NEXT_PUBLIC_MEDIA_CDN_URL)"
  if [[ -z "$cdn_fe" ]]; then
    warn_msg "NEXT_PUBLIC_MEDIA_CDN_URL — frontend build uchun S3_PUBLIC_BASE_URL bilan bir xil qiling"
  else
    ok "NEXT_PUBLIC_MEDIA_CDN_URL"
  fi
elif [[ "$media_backend" == "supabase" ]]; then
  check_not_placeholder SUPABASE_URL
  check_not_placeholder SUPABASE_SERVICE_ROLE_KEY
else
  warn_msg "MEDIA_STORAGE_BACKEND=local — productionda s3 yoki supabase tavsiya"
fi

if [[ -f deploy/ssl/fullchain.pem && -f deploy/ssl/privkey.pem ]]; then
  ok "TLS certs in deploy/ssl/"
else
  warn_msg "deploy/ssl/fullchain.pem yoki privkey.pem yo'q — HTTPS ishlamaydi"
fi

if command -v docker >/dev/null 2>&1; then
  ok "docker installed"
else
  die "docker not found"
fi

if docker compose version >/dev/null 2>&1; then
  ok "docker compose"
else
  die "docker compose plugin not found"
fi

echo ""
if [[ "$fail" -eq 1 ]]; then
  echo "Preflight FAILED — .env ni to'ldiring"
  exit 1
fi
if [[ "$warn" -eq 1 ]]; then
  echo "Preflight OK with warnings — deploy mumkin"
  exit 0
fi
echo "Preflight PASSED — deploy qiling:"
echo "  docker compose -f docker-compose.prod.yml up -d --build"
exit 0
