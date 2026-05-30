#!/bin/sh
set -eu

cd /app
export PYTHONPATH=/app

echo "Running database migrations..."
alembic -c alembic.ini upgrade head

if [ "${RUN_SEED:-false}" = "true" ]; then
  if [ -f /app/scripts/seed.py ]; then
    echo "Seeding demo data (RUN_SEED=true)..."
    python /app/scripts/seed.py || true
  fi
fi

if [ "$#" -gt 0 ]; then
  echo "Starting API server: $*"
  exec "$@"
fi

WORKERS="${UVICORN_WORKERS:-4}"
echo "Starting API server (workers=$WORKERS, env=${APP_ENV:-production})..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers "$WORKERS"
