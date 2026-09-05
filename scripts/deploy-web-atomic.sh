#!/usr/bin/env bash
# Frontend-only production deploy with health verification and automatic rollback.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.web.yml}"
DEPLOY_SHA="${DEPLOY_SHA:-$(git rev-parse --short=12 HEAD)}"
SITE="${SITE:-https://bozorliii.online}"
FRONTEND_IMAGE="bozorliii-frontend:${DEPLOY_SHA}"
ROLLBACK_IMAGE="bozorliii-frontend:rollback-${DEPLOY_SHA}"

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

previous_image="$(compose images -q frontend 2>/dev/null | head -1)"
if [[ -n "$previous_image" ]]; then
  docker image tag "$previous_image" "$ROLLBACK_IMAGE"
  echo "Rollback image: $ROLLBACK_IMAGE"
fi

rollback() {
  local exit_code=$?
  trap - ERR
  echo "Deploy failed (exit $exit_code). Rolling frontend back..." >&2
  if [[ -n "$previous_image" ]] && docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1; then
    docker image tag "$ROLLBACK_IMAGE" "$FRONTEND_IMAGE"
    compose up -d --no-deps --force-recreate --no-build frontend
    compose up -d --no-deps nginx
    echo "Rollback completed: $ROLLBACK_IMAGE" >&2
  else
    echo "Rollback image unavailable; existing container was left untouched where possible." >&2
  fi
  exit "$exit_code"
}
trap rollback ERR

export DEPLOY_SHA
bash "$ROOT/scripts/preflight-split-web.sh"
compose build frontend
compose up -d --no-deps --wait --wait-timeout 180 frontend
compose up -d --no-deps nginx

for attempt in $(seq 1 12); do
  if curl -fsS --max-time 15 --retry 2 --retry-delay 2 "$SITE/" -o /dev/null; then
    trap - ERR
    echo "Frontend deploy verified: ${DEPLOY_SHA}"
    exit 0
  fi
  sleep 5
done

echo "Public smoke test failed: $SITE" >&2
false