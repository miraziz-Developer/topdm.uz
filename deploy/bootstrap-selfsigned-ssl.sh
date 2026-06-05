#!/usr/bin/env bash
# Temporary TLS until DNS + Let's Encrypt (nginx requires deploy/ssl/*)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/deploy/ssl"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$ROOT/deploy/ssl/privkey.pem" \
  -out "$ROOT/deploy/ssl/fullchain.pem" \
  -subj "/CN=bozorliii.uz/O=Bozorliii"
chmod 600 "$ROOT/deploy/ssl/privkey.pem"
echo "Self-signed cert in deploy/ssl/ (replace with certbot when DNS is live)"
