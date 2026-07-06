#!/usr/bin/env bash
# 2×4GB split — server bootstrap. Root yoki sudo bilan ishga tushiring.
#
# CORE serverda:
#   git clone https://github.com/miraziz-Developer/topdm.uz.git /opt/bozorliii
#   cd /opt/bozorliii
#   bash scripts/split-bootstrap.sh core
#
# WEB serverda (CORE private IP ni bilganingizdan keyin):
#   bash scripts/split-bootstrap.sh web --core-ip 10.x.x.x --web-private-ip 10.y.y.y
#
set -euo pipefail

ROLE="${1:-}"
shift || true

CORE_IP=""
WEB_PRIVATE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --core-ip) CORE_IP="${2:-}"; shift 2 ;;
    --web-private-ip) WEB_PRIVATE="${2:-}"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$ROLE" != "core" && "$ROLE" != "web" ]]; then
  echo "Usage: $0 core|web [--core-ip IP] [--web-private-ip IP]" >&2
  exit 1
fi

echo "== Bozorliii split bootstrap: $ROLE =="

if [[ -f deploy/install-docker.sh ]]; then
  bash deploy/install-docker.sh
fi

bash deploy/setup-swap.sh 2

if [[ "$ROLE" == "core" ]]; then
  if [[ ! -f .env ]]; then
    cp .env.core.example .env
    echo "Yaratildi: .env — kalitlarni to'ldiring (nano .env)"
  fi
  if [[ -n "$WEB_PRIVATE" ]]; then
    if grep -q '^WEB_PRIVATE_IP=' .env; then
      sed -i.bak "s|^WEB_PRIVATE_IP=.*|WEB_PRIVATE_IP=${WEB_PRIVATE}|" .env
    else
      echo "WEB_PRIVATE_IP=${WEB_PRIVATE}" >> .env
    fi
  fi
  echo ""
  echo "Keyingi qadamlar (CORE):"
  echo "  1) nano .env  — POSTGRES_PASSWORD, JWT, GROQ, TELEGRAM..."
  echo "  2) bash scripts/preflight-deploy.sh"
  echo "  3) bash deploy/ufw-core.sh   # WEB_PRIVATE_IP .env da bo'lishi kerak"
  echo "  4) bash scripts/deploy-core-only.sh"
  exit 0
fi

# WEB
if [[ ! -f .env ]]; then
  cp .env.web.example .env
fi
if [[ -n "$CORE_IP" ]]; then
  sed -i.bak "s|^CORE_BACKEND_HOST=.*|CORE_BACKEND_HOST=${CORE_IP}|" .env
  sed -i.bak "s|^BACKEND_API_URL=.*|BACKEND_API_URL=http://${CORE_IP}:8000|" .env
fi

echo ""
echo "Keyingi qadamlar (WEB):"
echo "  1) nano .env — CORE_BACKEND_HOST to'g'ri ekanini tekshiring"
echo "  2) DNS: bozorliii.online, api, crm → shu server PUBLIC IP"
echo "  3) bash deploy/ufw-web.sh"
echo "  4) bash deploy/bootstrap-ssl.sh  (yoki bootstrap-selfsigned-ssl.sh)"
echo "  5) bash deploy/verify-split.sh   — CORE ga ulanish"
echo "  6) bash scripts/deploy-web-only.sh"
