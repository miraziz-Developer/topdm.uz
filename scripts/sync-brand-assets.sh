#!/usr/bin/env bash
# Bozorliii.uz — brend aktivlarini frontend va CRM ga nusxalaydi
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/brand/assets"

python3 "$ROOT/scripts/generate-brand-assets.py"

for dest in "$ROOT/frontend/public/brand" "$ROOT/merchant-crm/public/brand"; do
  mkdir -p "$dest"
  cp "$SRC"/bozorliii-*.png "$dest/"
  cp "$SRC"/bozorliii-product-placeholder.svg "$dest/" 2>/dev/null || true
done
cp "$SRC/favicon.svg" "$ROOT/frontend/public/favicon.svg"
cp "$SRC/favicon.svg" "$ROOT/merchant-crm/public/favicon.svg"
if [[ -f "$SRC/favicon.png" ]]; then
  cp "$SRC/favicon.png" "$ROOT/frontend/public/favicon.png"
  cp "$SRC/favicon.png" "$ROOT/merchant-crm/public/favicon.png"
fi
if [[ -f "$SRC/bozorliii-icon.png" ]]; then
  cp "$SRC/bozorliii-icon.png" "$ROOT/frontend/public/apple-touch-icon.png"
  cp "$SRC/bozorliii-icon.png" "$ROOT/merchant-crm/public/apple-touch-icon.png"
fi
echo "Brand assets synced (SVG + PNG) to frontend + merchant-crm"
