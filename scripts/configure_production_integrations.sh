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

# Media: local volume (R2 kalitlari bo'lsa MEDIA_STORAGE_BACKEND=s3 qo'lda yoqing)
if ! grep -q "^MEDIA_STORAGE_BACKEND=" "$ENV_FILE"; then
  patch_var "MEDIA_STORAGE_BACKEND" "local"
fi

rm -f "${ENV_FILE}.bak"
echo "OK — onlayn checkout sandbox yoqildi."
echo "Haqiqiy Click/Payme: CLICK_* / PAYME_* to'ldiring va PAYMENT_SANDBOX_MODE=false"
echo "Eskiz SMS: ESKIZ_EMAIL + ESKIZ_PASSWORD yoki ESKIZ_API_TOKEN"
