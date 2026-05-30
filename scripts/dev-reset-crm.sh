#!/usr/bin/env bash
# CRM Next.js dev cache tozalash (MODULE_NOT_FOUND / proxy 500)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
docker compose exec -T merchant-crm rm -rf /app/.next 2>/dev/null || true
docker compose restart merchant-crm
echo "CRM qayta ishga tushmoqda — 15s kuting..."
sleep 15
curl -sf -o /dev/null -w "login: %{http_code}\n" http://127.0.0.1:3003/login
curl -sf -o /dev/null -w "proxy health: %{http_code}\n" http://127.0.0.1:3003/api/v1/health
