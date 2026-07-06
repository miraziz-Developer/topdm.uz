#!/usr/bin/env bash
# WEB server firewall — SSH + HTTP/HTTPS
set -euo pipefail

if ! command -v ufw >/dev/null 2>&1; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ufw
fi

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
ufw status verbose
echo "OK — WEB: 80/443 ochiq"
