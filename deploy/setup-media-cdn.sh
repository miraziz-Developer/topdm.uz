#!/usr/bin/env bash
# media.bozorliii.online — DNS + SSL expand + CDN URL (WEB serverda)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IP="${SERVER_IP:-$(curl -fsS ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')}"
MEDIA_HOST="${MEDIA_HOST:-media.bozorliii.online}"
CDN_URL="https://${MEDIA_HOST}"

echo "== Media CDN: ${MEDIA_HOST} → ${IP} =="

a=$(dig +short A "$MEDIA_HOST" @8.8.8.8 2>/dev/null | head -1 || true)
if [[ "$a" != "$IP" ]]; then
  echo "DNS kerak: ${MEDIA_HOST} A → ${IP}" >&2
  exit 1
fi
echo "DNS OK: ${MEDIA_HOST} → ${a}"

docker compose -f docker-compose.web.yml stop nginx 2>/dev/null || true

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot
fi

mkdir -p deploy/ssl deploy/certbot/www
certbot certonly --standalone --non-interactive --agree-tos --expand \
  -m "${CERTBOT_EMAIL:-admin@bozorliii.online}" \
  -d bozorliii.online -d www.bozorliii.online \
  -d api.bozorliii.online -d crm.bozorliii.online -d "$MEDIA_HOST"

LIVE="/etc/letsencrypt/live/bozorliii.online"
cp "$LIVE/fullchain.pem" deploy/ssl/fullchain.pem
cp "$LIVE/privkey.pem" deploy/ssl/privkey.pem
chmod 644 deploy/ssl/fullchain.pem
chmod 600 deploy/ssl/privkey.pem
echo "SSL expanded with ${MEDIA_HOST}"

key=NEXT_PUBLIC_MEDIA_CDN_URL
if [[ -f .env ]]; then
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${CDN_URL}|" .env
  else
    echo "${key}=${CDN_URL}" >> .env
  fi
fi

docker compose -f docker-compose.web.yml up -d --build frontend merchant-crm nginx
echo ""
echo "OK — ${CDN_URL} tayyor"
curl -fsS -o /dev/null -w "media HTTPS: %{http_code}\n" "https://${MEDIA_HOST}/" || true
