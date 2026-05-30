#!/usr/bin/env bash
# Topdim.UZ — brend SVG manbasini frontend va CRM ga nusxalaydi
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/brand/assets"
for dest in "$ROOT/frontend/public/brand" "$ROOT/merchant-crm/public/brand"; do
  mkdir -p "$dest"
  cp "$SRC"/*.svg "$dest/"
done
cp "$SRC/favicon.svg" "$ROOT/frontend/public/favicon.svg"
cp "$SRC/favicon.svg" "$ROOT/merchant-crm/public/favicon.svg"
cp "$SRC/topdim-product-placeholder.svg" "$ROOT/frontend/public/brand/"
cp "$SRC/topdim-product-placeholder.svg" "$ROOT/merchant-crm/public/brand/"
echo "Brand assets synced to frontend + merchant-crm"
