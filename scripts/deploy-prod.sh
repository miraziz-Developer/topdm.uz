#!/usr/bin/env bash
# Production deploy — preflight, build, up, health check
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env}"
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "== Bozorliii production deploy =="
bash "$ROOT/scripts/preflight-deploy.sh"

echo ""
echo "== Building and starting stack =="
$COMPOSE up -d --build

echo ""
echo "== Waiting for backend health =="
for i in $(seq 1 60); do
  if $COMPOSE exec -T backend curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "OK  backend healthy (${i}s)"
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "FAIL backend did not become healthy in time"
    $COMPOSE logs --tail=40 backend
    exit 1
  fi
  sleep 3
done

$COMPOSE ps

SITE="${SITE_URL:-https://bozorliii.uz}"
SITE="${SITE%/}"

echo ""
echo "== Edge health (if DNS + TLS ready) =="
if curl -fsS --max-time 8 "${SITE}/health" >/dev/null 2>&1; then
  echo "OK  ${SITE}/health"
elif curl -fsS --max-time 8 "http://127.0.0.1/health" -H "Host: bozorliii.uz" >/dev/null 2>&1; then
  echo "OK  local nginx /health"
else
  echo "WARN public health not reachable yet — check DNS, deploy/ssl, firewall 80/443"
fi

echo ""
echo "Deploy finished. Logs: $COMPOSE logs -f --tail=100"
