#!/usr/bin/env bash
# WEB serverdan CORE API ga ulanishni tekshirish
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CORE_HOST="${CORE_BACKEND_HOST:-}"
if [[ -z "$CORE_HOST" ]] && [[ -f .env ]]; then
  CORE_HOST="$(grep -E '^CORE_BACKEND_HOST=' .env | head -1 | cut -d= -f2- | tr -d ' "')"
fi

if [[ -z "$CORE_HOST" ]]; then
  echo "CORE_BACKEND_HOST topilmadi (.env)" >&2
  exit 1
fi

echo "== Ping CORE API at ${CORE_HOST}:8000 =="
if curl -fsS --max-time 10 "http://${CORE_HOST}:8000/health" >/dev/null; then
  echo "OK  http://${CORE_HOST}:8000/health"
else
  echo "FAIL — CORE ga ulanib bo'lmadi" >&2
  echo "  1) CORE_PRIVATE IP to'g'rimi?" >&2
  echo "  2) CORE da: docker compose -f docker-compose.core.yml ps" >&2
  echo "  3) CORE da: bash deploy/ufw-core.sh (WEB_PRIVATE_IP)" >&2
  exit 1
fi

if curl -fsS --max-time 10 "http://${CORE_HOST}:8000/api/v1/health/live" >/dev/null; then
  echo "OK  /api/v1/health/live"
else
  echo "WARN /api/v1/health/live"
fi
