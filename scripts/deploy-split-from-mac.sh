#!/usr/bin/env bash
# 2×4GB split deploy — Mac dan CORE + WEB serverlarga rsync va rebuild.
#
# split-hosts.env yarating (repo root):
#   WEB_PUBLIC_IP=103.253.145.151
#   CORE_PUBLIC_IP=152.42.204.27
#
# SSH kalit yoki: SSH_PASS=... ./scripts/deploy-split-from-mac.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

HOSTS_FILE="${HOSTS_FILE:-$ROOT/split-hosts.env}"
if [[ -f "$HOSTS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$HOSTS_FILE"
fi

WEB_IP="${WEB_PUBLIC_IP:-}"
CORE_IP="${CORE_PUBLIC_IP:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/bozorliii}"
SSH_OPTS=(-F /dev/null -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)

if [[ -z "$WEB_IP" || -z "$CORE_IP" ]]; then
  echo "WEB_PUBLIC_IP va CORE_PUBLIC_IP kerak ($HOSTS_FILE)" >&2
  exit 1
fi

if [[ -n "${SSH_PASS:-}" ]]; then
  command -v sshpass >/dev/null || { echo "sshpass kerak: brew install hudochenkov/sshpass/sshpass" >&2; exit 1; }
  RSYNC_SSH="sshpass -p '$SSH_PASS' ssh ${SSH_OPTS[*]}"
  ssh_cmd() { sshpass -p "$SSH_PASS" ssh "${SSH_OPTS[@]}" "$@"; }
else
  RSYNC_SSH="ssh ${SSH_OPTS[*]}"
  ssh_cmd() { ssh "${SSH_OPTS[@]}" "$@"; }
fi

RSYNC_EXCLUDES=(
  --exclude '.git'
  --exclude '.env'
  --exclude 'backend/.env'
  --exclude 'node_modules'
  --exclude 'frontend/node_modules'
  --exclude 'merchant-crm/node_modules'
  --exclude 'platform-admin/node_modules'
  --exclude 'frontend/.next'
  --exclude 'merchant-crm/.next'
  --exclude 'platform-admin/.next'
  --exclude '.venv'
  --exclude '__pycache__'
  --exclude '.cursor'
)

sync_to() {
  local server="$1"
  echo "== Sync → $server:$REMOTE_DIR =="
  ssh_cmd "root@$server" "mkdir -p '$REMOTE_DIR'"
  rsync -az "${RSYNC_EXCLUDES[@]}" -e "$RSYNC_SSH" "$ROOT/" "root@${server}:${REMOTE_DIR}/"
}

echo "== 1. CORE ($CORE_IP) =="
sync_to "$CORE_IP"
ssh_cmd "root@$CORE_IP" "cd '$REMOTE_DIR' && docker compose -f docker-compose.core.yml up -d --build"
ssh_cmd "root@$CORE_IP" "cd '$REMOTE_DIR' && for i in \$(seq 1 40); do curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 && echo OK CORE && exit 0; sleep 3; done; exit 1"

echo ""
echo "== 2. WEB ($WEB_IP) =="
sync_to "$WEB_IP"
ssh_cmd "root@$WEB_IP" "cd '$REMOTE_DIR' && docker compose -f docker-compose.web.yml up -d --build"
ssh_cmd "root@$WEB_IP" "cd '$REMOTE_DIR' && for i in \$(seq 1 40); do curl -fsS http://127.0.0.1/health >/dev/null 2>&1 && echo OK WEB && exit 0; sleep 3; done; exit 1"

echo ""
echo "== 3. Smoke =="
bash "$ROOT/scripts/smoke-prod.sh"

echo ""
echo "DONE — https://bozorliii.online"
