#!/usr/bin/env bash
# Backend + bot + CRM + frontend deploy
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="${SERVER:-root@8.222.211.54}"
REMOTE_DIR="${REMOTE_DIR:-/opt/bozorliii}"
SSH_OPTS=(-F /dev/null -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)

if [[ -z "${SSH_PASS:-}" ]]; then
  RSYNC_SSH=(ssh "${SSH_OPTS[@]}")
  SSH_CMD=(ssh "${SSH_OPTS[@]}")
  SCP_CMD=(scp "${SSH_OPTS[@]}")
else
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "sshpass topilmadi. SSH kalit bilan kirish uchun SSH_PASS o'rniga ssh-agent ishlating." >&2
    exit 1
  fi
  RSYNC_SSH=(sshpass -p "$SSH_PASS" ssh "${SSH_OPTS[@]}")
  SSH_CMD=(sshpass -p "$SSH_PASS" ssh "${SSH_OPTS[@]}")
  SCP_CMD=(sshpass -p "$SSH_PASS" scp "${SSH_OPTS[@]}")
fi

cd "$ROOT"

rsync -az \
  --exclude '.git' --exclude 'node_modules' --exclude 'frontend/node_modules' \
  --exclude 'merchant-crm/node_modules' --exclude 'frontend/.next' \
  --exclude 'merchant-crm/.next' --exclude '.venv' --exclude '__pycache__' \
  -e "${RSYNC_SSH[*]}" \
  "$ROOT/" "${SERVER}:${REMOTE_DIR}/"

"${SCP_CMD[@]}" "$ROOT/.env" "${SERVER}:${REMOTE_DIR}/.env"

"${SSH_CMD[@]}" "$SERVER" \
  "cd '$REMOTE_DIR' && bash scripts/configure_production_integrations.sh .env"

"${SSH_CMD[@]}" "$SERVER" \
  "cd '$REMOTE_DIR' && docker compose -f docker-compose.prod.yml up -d --build backend merchant-bot celery-worker celery-beat merchant-crm frontend nginx"

"${SSH_CMD[@]}" "$SERVER" \
  "cd '$REMOTE_DIR' && for i in \$(seq 1 40); do docker compose -f docker-compose.prod.yml exec -T backend curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 && echo OK backend && exit 0; sleep 3; done; exit 1"

"${SSH_CMD[@]}" "$SERVER" \
  "cd '$REMOTE_DIR' && docker compose -f docker-compose.prod.yml exec -T backend python /app/scripts/ensure_production_catalog.py"

"${SSH_CMD[@]}" "$SERVER" \
  "cd '$REMOTE_DIR' && docker compose -f docker-compose.prod.yml exec -T -e API_BASE_URL=http://127.0.0.1:8000/api/v1 backend python /app/scripts/verify_integrations.py"

"${SSH_CMD[@]}" "$SERVER" \
  "cd '$REMOTE_DIR' && chmod +x scripts/reembed_visual_batches.sh && REEMBED_BATCH=40 REEMBED_MAX_BATCHES=3 bash scripts/reembed_visual_batches.sh || true"

"${SSH_CMD[@]}" "$SERVER" \
  "cd '$REMOTE_DIR' && docker compose -f docker-compose.prod.yml exec -T backend python /app/scripts/verify_backend_core.py || true"

CRON_LINE='0 4 * * * cd /opt/bozorliii && REEMBED_BATCH=40 REEMBED_MAX_BATCHES=100 /bin/bash scripts/reembed_visual_batches.sh >> /var/log/bozorliii-reembed.log 2>&1'
"${SSH_CMD[@]}" "$SERVER" \
  "(crontab -l 2>/dev/null | grep -v reembed_visual_batches; echo '$CRON_LINE') | crontab -"

echo "DONE"
