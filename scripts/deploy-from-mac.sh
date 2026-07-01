#!/usr/bin/env bash
# Run on YOUR Mac (where SSH to 8.222.211.54 works)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="${SERVER:-root@8.222.211.54}"
REMOTE_DIR="${REMOTE_DIR:-/opt/bozorliii}"
SSH_PASS="${SSH_PASS:-Miraziz@2007}"
SSH_OPTS=(-F /dev/null -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)

cd "$ROOT"

bash "$ROOT/scripts/sync-brand-assets.sh"

if ! command -v sshpass >/dev/null 2>&1; then
  echo "Install: brew install hudochenkov/sshpass/sshpass" >&2
  exit 1
fi

ssh_cmd() {
  sshpass -p "$SSH_PASS" ssh "${SSH_OPTS[@]}" "$SERVER" "$@"
}

scp_cmd() {
  sshpass -p "$SSH_PASS" scp "${SSH_OPTS[@]}" "$@"
}

echo "== 1. Test SSH =="
ssh_cmd "echo connected && uname -a"

echo "== 2. Docker =="
ssh_cmd "command -v docker >/dev/null || bash -s" < "$ROOT/deploy/install-docker.sh"

echo "== 3. Production .env =="
if [[ -f "$ROOT/.env.production.ready" ]]; then
  cp "$ROOT/.env.production.ready" "$ROOT/.env"
elif [[ ! -f "$ROOT/.env" ]] || ! grep -qE '^TELEGRAM_BOT_TOKEN=.+' "$ROOT/.env" 2>/dev/null; then
  bash "$ROOT/scripts/generate-production-env.sh" > "$ROOT/.env"
  echo "Generated .env from .env.local-prod / example"
fi

echo "== 4. Sync project =="
ssh_cmd "mkdir -p '$REMOTE_DIR'"
rsync -az \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'frontend/node_modules' \
  --exclude 'merchant-crm/node_modules' \
  --exclude 'frontend/.next' \
  --exclude 'merchant-crm/.next' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '.cursor' \
  -e "sshpass -p '$SSH_PASS' ssh ${SSH_OPTS[*]}" \
  "$ROOT/" "${SERVER}:${REMOTE_DIR}/"

scp_cmd "$ROOT/.env" "${SERVER}:${REMOTE_DIR}/.env"

echo "== 5. SSL =="
ssh_cmd "cd '$REMOTE_DIR' && (test -f deploy/ssl/fullchain.pem && echo 'SSL exists') || (bash deploy/bootstrap-ssl.sh 2>/dev/null || bash deploy/bootstrap-selfsigned-ssl.sh)"

echo "== 6. Deploy stack =="
ssh_cmd "cd '$REMOTE_DIR' && chmod +x scripts/*.sh deploy/*.sh && ./scripts/deploy-prod.sh"

echo ""
echo "DONE — open https://bozorliii.uz"
