#!/usr/bin/env bash
# Sync project to server and run deploy-prod.sh
# Usage: SERVER=root@8.222.211.54 REMOTE_DIR=/opt/bozorliii ./scripts/remote-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="${SERVER:-root@8.222.211.54}"
REMOTE_DIR="${REMOTE_DIR:-/opt/bozorliii}"
SSH_OPTS=(-F /dev/null -o StrictHostKeyChecking=accept-new)

cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Run: ./scripts/generate-production-env.sh > .env && edit secrets" >&2
  exit 1
fi

echo "== Sync to ${SERVER}:${REMOTE_DIR} =="
ssh "${SSH_OPTS[@]}" "$SERVER" "mkdir -p '$REMOTE_DIR'"

rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'frontend/node_modules' \
  --exclude 'merchant-crm/node_modules' \
  --exclude 'frontend/.next' \
  --exclude 'merchant-crm/.next' \
  --exclude '.env.local' \
  --exclude '.env.local-prod' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '.cursor' \
  "$ROOT/" "${SERVER}:${REMOTE_DIR}/"

scp "${SSH_OPTS[@]}" "$ROOT/.env" "${SERVER}:${REMOTE_DIR}/.env"

echo "== Remote deploy =="
ssh "${SSH_OPTS[@]}" "$SERVER" "cd '$REMOTE_DIR' && chmod +x scripts/*.sh && ./scripts/deploy-prod.sh"

echo "Done. Open https://bozorliii.uz"
