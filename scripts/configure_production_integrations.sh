#!/usr/bin/env bash
# Production .env — onlayn checkout (sandbox) va integratsiya flaglari.
set -euo pipefail

ENV_FILE="${1:-.env}"

patch_var() {
  local key="$1"
  local val="$2"
  # Oxirida newline bo'lmasa keyingi patch bir qatorga yopishib qoladi.
  if [[ -s "$ENV_FILE" ]] && [[ "$(tail -c 1 "$ENV_FILE")" != $'\n' ]]; then
    echo "" >>"$ENV_FILE"
  fi
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >>"$ENV_FILE"
  fi
}

echo "Patching $ENV_FILE …"

patch_var "ENABLE_ONLINE_CHECKOUT" "true"
patch_var "NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT" "true"
patch_var "PAYMENT_SANDBOX_MODE" "true"
patch_var "ALLOW_PAYMENT_SANDBOX_IN_PRODUCTION" "true"
patch_var "PAYMENT_CHECKOUT_BASE_URL" "https://bozorliii.online"

# Media: local volume + nginx edge cache; R2 kalitlari bo'lsa enable_r2_media.sh
if ! grep -q "^MEDIA_STORAGE_BACKEND=" "$ENV_FILE" 2>/dev/null; then
  patch_var "MEDIA_STORAGE_BACKEND" "local"
fi

cdn_base="$(grep -E '^S3_PUBLIC_BASE_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r')"
if [[ -z "$cdn_base" ]]; then
  patch_var "S3_PUBLIC_BASE_URL" "https://media.bozorliii.online"
  cdn_base="https://media.bozorliii.online"
fi

# Frontend CDN: media subdomain DNS bo'lmasa api orqali (nginx edge cache).
api_media="https://api.bozorliii.online/api/v1/media"
if command -v dig >/dev/null 2>&1 && dig +short A media.bozorliii.online @8.8.8.8 2>/dev/null | grep -q .; then
  patch_var "NEXT_PUBLIC_MEDIA_CDN_URL" "$cdn_base"
else
  patch_var "NEXT_PUBLIC_MEDIA_CDN_URL" "$api_media"
  echo "INFO: media.bozorliii.online DNS yo'q — CDN vaqtincha $api_media"
fi

# R2 kalitlari to'ldirilgan bo'lsa avtomatik s3
if grep -qE '^S3_ACCESS_KEY_ID=.+' "$ENV_FILE" 2>/dev/null \
  && grep -qE '^S3_SECRET_ACCESS_KEY=.+' "$ENV_FILE" 2>/dev/null \
  && grep -qE '^S3_BUCKET=.+' "$ENV_FILE" 2>/dev/null \
  && grep -qE '^S3_ENDPOINT_URL=.+' "$ENV_FILE" 2>/dev/null; then
  patch_var "MEDIA_STORAGE_BACKEND" "s3"
  echo "OK — R2/S3 kalitlari topildi, MEDIA_STORAGE_BACKEND=s3"
fi

rm -f "${ENV_FILE}.bak"
echo "OK — onlayn checkout sandbox yoqildi."
echo "Haqiqiy Click/Payme: CLICK_* / PAYME_* to'ldiring va PAYMENT_SANDBOX_MODE=false"
echo "Eskiz SMS: ESKIZ_EMAIL + ESKIZ_PASSWORD yoki ESKIZ_API_TOKEN"
