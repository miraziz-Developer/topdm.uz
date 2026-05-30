#!/usr/bin/env bash
# Rasm qidiruv smoke — parallel DB sessiya xatolarini ushlaydi.
# Usage: ./scripts/smoke-image-search.sh [API_ORIGIN] [IMAGE_PATH]
set -euo pipefail

API="${1:-http://localhost:8000/api/v1}"
API="${API%/}"
IMAGE="${2:-}"

if [[ -z "$IMAGE" ]]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  for candidate in \
    "$ROOT/frontend/public/smoke-test-product.jpg" \
    "$ROOT/frontend/public/placeholder-product.jpg" \
    "$ROOT/frontend/public/icon.png"; do
    if [[ -f "$candidate" ]]; then
      IMAGE="$candidate"
      break
    fi
  done
fi

if [[ -z "$IMAGE" || ! -f "$IMAGE" ]]; then
  echo "FAIL — test rasm topilmadi. IMAGE_PATH bering."
  exit 1
fi

echo "== Image search smoke: $API =="
echo "   file: $IMAGE"

code=$(curl -sS -o /tmp/smoke-image-search.json -w "%{http_code}" \
  -X POST "$API/products/search-by-image?fast=true&limit=8" \
  -F "file=@$IMAGE")

if [[ "$code" != "200" ]]; then
  echo "FAIL search-by-image -> $code"
  head -c 400 /tmp/smoke-image-search.json 2>/dev/null || true
  echo ""
  exit 1
fi

if grep -q '"database_error"' /tmp/smoke-image-search.json 2>/dev/null; then
  echo "FAIL response contains database_error"
  exit 1
fi

items=$(python3 -c "import json; d=json.load(open('/tmp/smoke-image-search.json')); print(len(d.get('detected_items') or []))" 2>/dev/null || echo "0")
echo "OK  search-by-image -> 200 (detected_items=$items)"
echo "PASS image search smoke"
