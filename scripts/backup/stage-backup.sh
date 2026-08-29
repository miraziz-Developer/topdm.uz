#!/bin/bash
# Bozorliii CORE — server-side staging backup.
#
# Runs every 6h via root cron on the CORE server. Dumps the database and the
# uploads volume into /opt/bozorliii/backups/ and keeps a few days of history.
# This is the always-on safety net: the founder's laptop pulls this directory
# down (scripts/backup/local-pull.sh) whenever it is online, so a laptop that
# was asleep for days still recovers every 6-hourly dump it missed.
#
# cron line (installed once, see RESTORE.md):
#   20 */6 * * * /opt/bozorliii/scripts/backup/stage-backup.sh >> /opt/bozorliii/.logs/stage-backup.log 2>&1

set -uo pipefail

APP_DIR="/opt/bozorliii"
STAGE_DIR="$APP_DIR/backups"
KEEP_DAYS=4
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$STAGE_DIR" "$APP_DIR/.logs"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

DB_USER="$(grep -E '^POSTGRES_USER=' "$APP_DIR/.env" | head -1 | cut -d= -f2-)"
DB_NAME="$(grep -E '^POSTGRES_DB=' "$APP_DIR/.env" | head -1 | cut -d= -f2-)"
if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
  log "!!! cannot read POSTGRES_USER / POSTGRES_DB from $APP_DIR/.env — aborting"
  exit 1
fi

log "=== stage backup $TS start (db=$DB_NAME) ==="

# --- database: dump to a .tmp then atomically rename ---
if docker exec bozorliii-postgres-1 pg_dump -U "$DB_USER" -d "$DB_NAME" \
     | gzip -9 > "$STAGE_DIR/db-$TS.sql.gz.tmp"; then
  if gzip -t "$STAGE_DIR/db-$TS.sql.gz.tmp"; then
    mv "$STAGE_DIR/db-$TS.sql.gz.tmp" "$STAGE_DIR/db-$TS.sql.gz"
    log "OK db-$TS.sql.gz ($(du -h "$STAGE_DIR/db-$TS.sql.gz" | cut -f1))"
  else
    rm -f "$STAGE_DIR/db-$TS.sql.gz.tmp"
    log "!!! db dump failed gzip integrity check"
    exit 1
  fi
else
  rm -f "$STAGE_DIR/db-$TS.sql.gz.tmp"
  log "!!! pg_dump failed"
  exit 1
fi

# --- uploads volume ---
if docker run --rm -v bozorliii_bozor_uploads:/data -v "$STAGE_DIR":/backup alpine \
     tar czf "/backup/uploads-$TS.tar.gz.tmp" -C /data . ; then
  mv "$STAGE_DIR/uploads-$TS.tar.gz.tmp" "$STAGE_DIR/uploads-$TS.tar.gz"
  log "OK uploads-$TS.tar.gz ($(du -h "$STAGE_DIR/uploads-$TS.tar.gz" | cut -f1))"
else
  rm -f "$STAGE_DIR/uploads-$TS.tar.gz.tmp"
  log "!!! uploads tar failed"
fi

# --- env (single rolling copy; secrets, so lock it down) ---
cp "$APP_DIR/.env" "$STAGE_DIR/core.env"
chmod 600 "$STAGE_DIR/core.env"

# --- rotate ---
find "$STAGE_DIR" -maxdepth 1 -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
find "$STAGE_DIR" -maxdepth 1 -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
find "$STAGE_DIR" -maxdepth 1 -name '*.tmp' -mtime +1 -delete 2>/dev/null || true

log "=== stage backup $TS done ==="
