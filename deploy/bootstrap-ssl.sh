#!/usr/bin/env bash
# Let's Encrypt — DNS tayyor domenlar (Google DNS 8.8.8.8 orqali tekshiriladi)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IP="${SERVER_IP:-8.222.211.54}"
EMAIL="${CERTBOT_EMAIL:-admin@bozorliii.online}"
DNS_SERVER="${DNS_SERVER:-8.8.8.8}"
CANDIDATES=(bozorliii.online www.bozorliii.online api.bozorliii.online crm.bozorliii.online)

mkdir -p deploy/ssl deploy/certbot/www

READY=()
for d in "${CANDIDATES[@]}"; do
  a=$(dig +short A "$d" @"$DNS_SERVER" 2>/dev/null | head -1 || true)
  if [[ "$a" == "$IP" ]]; then
    READY+=("$d")
    echo "DNS OK: $d → $a"
  else
    echo "SKIP: $d (kutilgan $IP, topildi: ${a:-NXDOMAIN}) — 5–15 daqiqa kuting"
  fi
done

if [[ ${#READY[@]} -eq 0 ]]; then
  echo "Hech qanday domen tayyor emas." >&2
  exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update && apt-get install -y certbot
fi

docker compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true

DOMAIN_ARGS=()
for d in "${READY[@]}"; do
  DOMAIN_ARGS+=(-d "$d")
done

# Mavjud sertifikatga www/api qo'shish uchun --expand
certbot certonly --standalone --non-interactive --agree-tos --expand \
  -m "$EMAIL" "${DOMAIN_ARGS[@]}" \
  || certbot certonly --standalone --non-interactive --agree-tos --force-renewal \
  -m "$EMAIL" "${DOMAIN_ARGS[@]}"

LIVE="/etc/letsencrypt/live/${READY[0]}"
cp "$LIVE/fullchain.pem" deploy/ssl/fullchain.pem
cp "$LIVE/privkey.pem" deploy/ssl/privkey.pem
chmod 644 deploy/ssl/fullchain.pem
chmod 600 deploy/ssl/privkey.pem

echo "SSL tayyor (${#READY[@]} domen): ${READY[*]}"
