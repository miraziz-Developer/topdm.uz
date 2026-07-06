#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
bash "$ROOT/scripts/preflight-deploy.sh"
bash "$ROOT/deploy/setup-swap.sh" 2 || true
docker compose -f docker-compose.core.yml up -d --build
echo "CORE up — API :8000 (VPC dan oching)"
