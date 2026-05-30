#!/usr/bin/env bash
# Topdim.UZ — Docker Compose: postgres, redis, backend (migrate+seed), frontend.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "XATO: Docker daemon ishlamayapti. Docker Desktop ni yoqing va qayta urinib ko'ring."
  exit 1
fi

if [[ ! -f .env ]]; then
  echo ".env topilmadi — .env.example dan nusxa olinmoqda..."
  cp .env.example .env
fi

pick_frontend_port() {
  local port
  for port in "${FRONTEND_PORT:-}" 3002 3003 3004 3005; do
    [[ -z "$port" ]] && continue
    if ! lsof -i ":$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
  done
  echo "XATO: 3002–3005 portlari band. FRONTEND_PORT=3010 ./scripts/docker_up.sh deb ko'ring." >&2
  exit 1
}

export FRONTEND_PORT="${FRONTEND_PORT:-$(pick_frontend_port)}"

free_backend_port() {
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  local pid cmd
  while read -r pid; do
    [[ -z "$pid" ]] && continue
    cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
    if [[ "$cmd" == *uvicorn* ]]; then
      echo "Port 8000 band — mahalliy uvicorn to'xtatiladi (PID $pid)."
      kill "$pid" 2>/dev/null || true
    fi
  done < <(lsof -ti :8000 -sTCP:LISTEN 2>/dev/null || true)
}

free_backend_port

echo "Eski konteynerlarni to'xtatish..."
docker compose down

echo "Build va ishga tushirish (frontend host port: $FRONTEND_PORT)..."
docker compose up -d --build

echo "Backend health kutilmoqda..."
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    echo "Backend tayyor."
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "Backend health vaqtida javob bermadi. Log: docker compose logs backend"
    exit 1
  fi
  sleep 2
done

echo "Frontend kutilmoqda..."
for i in $(seq 1 45); do
  if curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null 2>&1; then
    echo "Frontend tayyor."
    break
  fi
  if [[ "$i" -eq 45 ]]; then
    echo "Frontend vaqtida javob bermadi. Log: docker compose logs frontend"
    exit 1
  fi
  sleep 2
done

echo ""
docker compose ps
echo ""
echo "Frontend:  http://localhost:${FRONTEND_PORT}"
echo "API:       http://localhost:8000"
echo "API docs:  http://localhost:8000/docs"
echo "Health:    http://localhost:8000/health"
echo ""
echo "Smoke test (ixtiyoriy): BASE=http://127.0.0.1:8000 ./scripts/smoke_api.sh"
