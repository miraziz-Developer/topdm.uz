#!/usr/bin/env bash
# 4GB VPS uchun swap (OOM dan himoya). Root sifatida ishga tushiring.
set -euo pipefail

SWAP_GB="${1:-2}"
SWAP_FILE="/swapfile"

if swapon --show | grep -q "$SWAP_FILE"; then
  echo "Swap allaqachon yoqilgan"
  swapon --show
  exit 0
fi

if [[ -f "$SWAP_FILE" ]]; then
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE" >/dev/null
else
  fallocate -l "${SWAP_GB}G" "$SWAP_FILE" 2>/dev/null || dd if=/dev/zero of="$SWAP_FILE" bs=1M count=$((SWAP_GB * 1024)) status=progress
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE" >/dev/null
fi

swapon "$SWAP_FILE"

if ! grep -q "$SWAP_FILE" /etc/fstab 2>/dev/null; then
  echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
fi

echo "OK — ${SWAP_GB}GB swap yoqildi"
free -h
