#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -z "${CORE_BACKEND_HOST:-}" ]] && ! grep -qE '^CORE_BACKEND_HOST=.+' .env 2>/dev/null; then
  echo "Set CORE_BACKEND_HOST in .env (core server VPC private IP)" >&2
  exit 1
fi

bash "$ROOT/deploy/setup-swap.sh" 2 || true
docker compose -f docker-compose.web.yml up -d --build
echo "WEB up — https://bozorliii.online"
