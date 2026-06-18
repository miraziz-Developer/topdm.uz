#!/usr/bin/env bash
# Cloudflare R2 ni yoqish + mavjud local fayllarni ko'chirish.
#
# .env da to'ldiring:
#   S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
#   S3_BUCKET=bozorliii-media
#   S3_ACCESS_KEY_ID=...
#   S3_SECRET_ACCESS_KEY=...
#   S3_PUBLIC_BASE_URL=https://media.bozorliii.online
#   NEXT_PUBLIC_MEDIA_CDN_URL=https://media.bozorliii.online
#
# Ishga tushirish (serverda):
#   cd /opt/bozorliii && bash scripts/enable_r2_media.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ENV_FILE:-.env}"
COMPOSE="docker compose -f docker-compose.prod.yml"

require_var() {
  local key="$1"
  local val
  val="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"
  if [[ -z "$val" ]]; then
    echo "FAIL: ${key} bo'sh — Cloudflare R2 kalitlarini .env ga qo'shing" >&2
    exit 1
  fi
}

for key in S3_ENDPOINT_URL S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_PUBLIC_BASE_URL; do
  require_var "$key"
done

bash scripts/configure_production_integrations.sh "$ENV_FILE"

echo "== Backend qayta ishga tushirish (s3 rejimi) =="
$COMPOSE up -d --build backend merchant-bot celery-worker celery-beat

for i in $(seq 1 40); do
  if $COMPOSE exec -T backend curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "OK backend healthy"
    break
  fi
  sleep 3
done

echo "== Local → R2 migratsiya (dry-run) =="
$COMPOSE exec -T backend python /app/scripts/migrate_local_uploads_to_s3.py --dry-run

read -r -p "Migratsiyani davom ettirasizmi? [y/N] " ans
if [[ "${ans,,}" == "y" ]]; then
  $COMPOSE exec -T backend python /app/scripts/migrate_local_uploads_to_s3.py
fi

echo "== Frontend rebuild (CDN URL) =="
$COMPOSE up -d --build frontend merchant-crm nginx

echo "DONE — media R2 yoqildi. Tekshiring: bash scripts/smoke-prod.sh"
