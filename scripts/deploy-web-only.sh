#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[[ -f .env ]] || { echo "cp .env.web.example .env && nano .env"; exit 1; }
bash "$ROOT/deploy/setup-swap.sh" 2 || true
bash "$ROOT/scripts/deploy-web-atomic.sh"
echo ""
echo "WEB tayyor — https://bozorliii.online"
