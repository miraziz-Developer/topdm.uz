#!/bin/bash
# Bozorliii — off-site backup onto the founder's Mac.
#
# The production servers are a low-trust free tier and can vanish without
# notice, so the authoritative copy of the database, uploaded media and BOTH
# servers' .env files lives here, on this machine.
#
# Runs every 6h via launchd (~/Library/LaunchAgents/uz.bozorliii.backup.plist).
# Deployed copy lives at ~/Backups/bozorliii/backup.sh — this file in the repo
# is the reference / source of truth for the script itself.
#
# Each run:
#   1. rsyncs CORE's server-side staging dir down (catch-up: recovers every
#      6-hourly dump made while this Mac was asleep)
#   2. takes its own fresh, integrity-checked snapshot into a timestamped dir
#   3. pulls CORE .env and WEB .env
#   4. updates the `latest` symlink, prunes old snapshots
#   5. shows a macOS notification on failure

set -uo pipefail

CORE_HOST="152.42.204.27"
WEB_HOST="103.253.145.151"
SSH_KEY="$HOME/.ssh/bozorliii_backup_key"
BACKUP_ROOT="$HOME/Backups/bozorliii"
LOG_FILE="$BACKUP_ROOT/.logs/backup.log"
KEEP_DAYS=30

TS="$(date +%Y%m%d-%H%M%S)"
WORK_DIR="$BACKUP_ROOT/.partial-$TS"
DEST_DIR="$BACKUP_ROOT/$TS"

mkdir -p "$BACKUP_ROOT/.logs" "$BACKUP_ROOT/server-stage"

# single-run lock (mkdir is atomic; break a lock older than 2h)
LOCK_DIR="$BACKUP_ROOT/.lock"
if [ -d "$LOCK_DIR" ] && [ -z "$(find "$LOCK_DIR" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then
  echo "$(date '+%F %T') another backup is running ($LOCK_DIR) — skipping" >> "$LOG_FILE"
  exit 0
fi
rm -rf "$LOCK_DIR"
mkdir "$LOCK_DIR" 2>/dev/null || { echo "$(date '+%F %T') could not take lock — skipping" >> "$LOG_FILE"; exit 0; }
trap 'rm -rf "$LOCK_DIR"' EXIT

mkdir -p "$WORK_DIR"

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -o BatchMode=yes)
ssh_core() { ssh "${SSH_OPTS[@]}" "root@$CORE_HOST" "$@"; }

notify() { /usr/bin/osascript -e "display notification \"$1\" with title \"Bozorliii backup\"" >/dev/null 2>&1 || true; }

fail() {
  echo "!!! $TS: FAILED — $1"
  rm -rf "$WORK_DIR"
  notify "FAILED: $1"
  exit 1
}

retry() { # retry <label> <cmd...>
  local label="$1"; shift
  local n
  for n in 1 2 3; do
    if "$@"; then return 0; fi
    echo "  $label: attempt $n failed"
    [ "$n" -lt 3 ] && sleep 30
  done
  return 1
}

{
  echo "=== $TS: backup start ==="

  # 1. catch-up: pull CORE's staging directory (cheap, incremental)
  retry "rsync server-stage" rsync -az --delete \
    -e "ssh ${SSH_OPTS[*]}" \
    "root@$CORE_HOST:/opt/bozorliii/backups/" "$BACKUP_ROOT/server-stage/" \
    || echo "  (server-stage rsync failed — continuing with fresh snapshot)"

  # 2. fresh snapshot straight from the live DB + volume
  retry "core dump" ssh_core '
    set -e
    DB_USER=$(grep -E "^POSTGRES_USER=" /opt/bozorliii/.env | head -1 | cut -d= -f2-)
    DB_NAME=$(grep -E "^POSTGRES_DB=" /opt/bozorliii/.env | head -1 | cut -d= -f2-)
    rm -rf /tmp/bozorliii-backup && mkdir -p /tmp/bozorliii-backup
    docker exec bozorliii-postgres-1 pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip -9 > /tmp/bozorliii-backup/db.sql.gz
    docker run --rm -v bozorliii_bozor_uploads:/data -v /tmp/bozorliii-backup:/backup alpine \
      tar czf /backup/uploads.tar.gz -C /data .
    cp /opt/bozorliii/.env /tmp/bozorliii-backup/core.env
  ' || fail "CORE dump (3 attempts) — server unreachable?"

  retry "scp core" scp "${SSH_OPTS[@]}" -q \
    "root@$CORE_HOST:/tmp/bozorliii-backup/db.sql.gz" \
    "root@$CORE_HOST:/tmp/bozorliii-backup/uploads.tar.gz" \
    "root@$CORE_HOST:/tmp/bozorliii-backup/core.env" \
    "$WORK_DIR/" || fail "scp snapshot from CORE"
  ssh_core 'rm -rf /tmp/bozorliii-backup' || true

  # 3. WEB .env
  retry "scp web env" scp "${SSH_OPTS[@]}" -q \
    "root@$WEB_HOST:/opt/bozorliii/.env" "$WORK_DIR/web.env" \
    || fail "WEB .env (3 attempts)"

  # 4. integrity
  gunzip -t "$WORK_DIR/db.sql.gz"       || fail "db.sql.gz corrupt"
  gzip   -t "$WORK_DIR/uploads.tar.gz"  || fail "uploads.tar.gz corrupt"
  [ -s "$WORK_DIR/core.env" ]           || fail "core.env empty"
  [ -s "$WORK_DIR/web.env"  ]           || fail "web.env empty"
  grep -q '^POSTGRES_' "$WORK_DIR/core.env" || fail "core.env looks wrong (no POSTGRES_ keys)"

  # 5. commit atomically
  chmod 600 "$WORK_DIR"/*.env
  mv "$WORK_DIR" "$DEST_DIR"
  ln -sfn "$DEST_DIR" "$BACKUP_ROOT/latest"

  echo "OK -> $DEST_DIR"
  echo "   db.sql.gz      $(du -h "$DEST_DIR/db.sql.gz"      | cut -f1)"
  echo "   uploads.tar.gz $(du -h "$DEST_DIR/uploads.tar.gz" | cut -f1)"
  echo "   core.env web.env"
  echo "   server-stage:  $(ls -1 "$BACKUP_ROOT/server-stage"/db-*.sql.gz 2>/dev/null | wc -l | tr -d ' ') dumps held"

  # 6. rotate own snapshots + stale partials
  find "$BACKUP_ROOT" -maxdepth 1 -type d -name '20*'       -mtime +"$KEEP_DAYS" -exec rm -rf {} \; 2>/dev/null || true
  find "$BACKUP_ROOT" -maxdepth 1 -type d -name '.partial-*' -mtime +1           -exec rm -rf {} \; 2>/dev/null || true

  echo "=== $TS: backup done ==="
} >> "$LOG_FILE" 2>&1
