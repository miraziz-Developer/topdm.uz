#!/usr/bin/env bash
# CORE server firewall — faqat SSH + WEB dan API :8000
set -euo pipefail

WEB_IP="${WEB_PRIVATE_IP:-}"
if [[ -z "$WEB_IP" ]] && [[ -f .env ]]; then
  WEB_IP="$(grep -E '^WEB_PRIVATE_IP=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' "')"
fi

if [[ -z "$WEB_IP" ]]; then
  echo "WEB_PRIVATE_IP kerak (WEB server VPC IP)." >&2
  echo "  export WEB_PRIVATE_IP=10.x.x.x" >&2
  echo "  yoki .env da WEB_PRIVATE_IP=..." >&2
  exit 1
fi

if ! command -v ufw >/dev/null 2>&1; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ufw
fi

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow from "$WEB_IP" to any port 8000 proto tcp comment 'Bozorliii API from WEB'
ufw --force enable
ufw status verbose
echo "OK — CORE: 8000 faqat $WEB_IP dan ochiq"
