#!/bin/bash
# Server 2 security fix — close Postgres/Redis public ports, switch to core-only
set -euo pipefail

cd /opt/bozorliii

# Backup current
cp docker-compose.yml docker-compose.yml.$(date +%Y%m%d_%H%M%S).bak

# Switch to core-only compose
cp docker-compose.core.yml docker-compose.yml

# Bind backend API to VPC IP only (not 0.0.0.0)
sed -i 's|"${CORE_API_PORT:-8000}:8000"|"10.104.0.2:8000:8000"|' docker-compose.yml

# Verify
grep -A2 '8000' docker-compose.yml | head -6

echo "=== docker-compose.yml updated ==="
