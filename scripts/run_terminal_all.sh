#!/usr/bin/env bash
# Topdim.UZ — barcha ishga tushirish + tekshiruv (terminalda bitta skript).
# Talab: Docker Desktop yoqilgan (postgres + redis), keyin .env mos.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=========================================="
echo "1) Docker: Postgres + Redis"
echo "=========================================="
if docker info >/dev/null 2>&1; then
  docker compose up -d postgres redis
  docker compose ps
else
  echo "XATO: Docker daemon ishlamayapti. Docker Desktop ni yoqing."
  exit 1
fi

echo ""
echo "=========================================="
echo "2) Python venv + backend o'rnatish"
echo "=========================================="
if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
# shellcheck source=/dev/null
source .venv/bin/activate
pip install -q -e ./backend

echo ""
echo "=========================================="
echo "3) Alembic migrate"
echo "=========================================="
(cd backend && alembic -c alembic.ini upgrade head)

echo ""
echo "=========================================="
echo "4) Seed"
echo "=========================================="
python scripts/seed.py

echo ""
echo "=========================================="
echo "5) Backend compileall"
echo "=========================================="
python3 -m compileall -q backend/app && echo "OK: compileall"

echo ""
echo "=========================================="
echo "6) Frontend production build"
echo "=========================================="
(cd frontend && npm run build)

echo ""
echo "=========================================="
echo "7) Backend uvicorn (port 8000 tozalab, keyin smoke)"
echo "=========================================="
# Eski uvicorn ishlayotgan bo'lsa, u eski .py kodini ushlab turadi — yangi tuzatishlar ishlamaydi.
if command -v lsof >/dev/null 2>&1; then
  OLD_PIDS=$(lsof -ti :8000 -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${OLD_PIDS:-}" ]]; then
    echo "Port 8000 band — eski jarayon(lar)ni to'xtatamiz: $OLD_PIDS"
    kill $OLD_PIDS 2>/dev/null || true
    sleep 1
  fi
fi
(cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000) &
UV_PID=$!
sleep 4

echo ""
echo "=========================================="
echo "8) API smoke"
echo "=========================================="
chmod +x scripts/smoke_api.sh
BASE=http://127.0.0.1:8000 ./scripts/smoke_api.sh

kill "$UV_PID" 2>/dev/null || true
wait "$UV_PID" 2>/dev/null || true

echo ""
echo "==== Hammasi muvaffaqiyatli yakunlandi ===="
echo "Frontend dev (ixtiyoriy):"
echo "  cd $ROOT/frontend && npm run dev -- --port 3002"
