#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[[ -f .env ]] || { echo "cp .env.core.example .env"; exit 1; }
bash "$ROOT/scripts/preflight-deploy.sh"
bash "$ROOT/deploy/setup-swap.sh" 2 || true
docker compose -f docker-compose.core.yml up -d --build
echo ""
echo "CORE tayyor. DO paneldan CORE VPC private IP ni oling — WEB .env da CORE_BACKEND_HOST bo'ladi."
