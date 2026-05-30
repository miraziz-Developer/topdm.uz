#!/usr/bin/env bash
# Smoke: merchant login + create product with color/size variants + verify GET.
set -euo pipefail

API="${API_BASE:-http://localhost:8000/api/v1}"
LOGIN_CODE="${MERCHANT_LOGIN:-ANOR-DEMO}"
PASSWORD="${MERCHANT_PASSWORD:-Topdim2024!}"

API="${API%/}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "== Merchant product variants smoke =="
echo "API: $API"
echo "Login: $LOGIN_CODE"

login_json="$TMP/login.json"
code=$(curl -sS -o "$login_json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"login_code\":\"$LOGIN_CODE\",\"password\":\"$PASSWORD\"}" \
  "$API/auth/merchant/login" || echo "000")

if [[ "$code" != "200" ]]; then
  echo "FAIL login HTTP $code"
  cat "$login_json" 2>/dev/null || true
  exit 1
fi

TOKEN=$(python3 -c "import json; d=json.load(open('$login_json')); print(d.get('access_token') or d.get('token') or '')")
if [[ -z "$TOKEN" ]]; then
  echo "FAIL: no access_token in login response"
  cat "$login_json"
  exit 1
fi
echo "OK  login"

# 1x1 PNG
IMG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
echo "$IMG_B64" | base64 -d > "$TMP/test.png"

VARIANT_JSON='{"all_sizes":["S","M","L"],"colors":[{"name":"Qora","sizes":["S","M"],"image_urls":[]},{"name":"Oq","sizes":["L"],"image_urls":[]}],"sku_stock":{"qora|s":3,"qora|m":1,"oq|l":5}}'
IMAGE_META='[null,"Qora","Oq"]'

create_out="$TMP/create.json"
code=$(curl -sS -o "$create_out" -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@$TMP/test.png;type=image/png" \
  -F "files=@$TMP/test.png;type=image/png" \
  -F "files=@$TMP/test.png;type=image/png" \
  -F "name=Smoke variant test $(date +%H%M%S)" \
  -F "price=199000" \
  -F "description=API smoke variant" \
  -F "stock_count=0" \
  -F "is_featured=false" \
  -F "variant_json=$VARIANT_JSON" \
  -F "image_meta=$IMAGE_META" \
  "$API/merchant/products" || echo "000")

if [[ "$code" != "200" ]]; then
  echo "FAIL create HTTP $code"
  cat "$create_out"
  exit 1
fi

PRODUCT_ID=$(python3 -c "import json; print(json.load(open('$create_out'))['item']['id'])")
STOCK=$(python3 -c "import json; print(json.load(open('$create_out'))['item']['stock_count'])")
echo "OK  create product id=$PRODUCT_ID stock=$STOCK"

if [[ "$STOCK" != "9" ]]; then
  echo "FAIL expected stock_count=9 got $STOCK"
  exit 1
fi

get_out="$TMP/get.json"
code=$(curl -sS -o "$get_out" -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API/merchant/products/$PRODUCT_ID" || echo "000")

if [[ "$code" != "200" ]]; then
  echo "FAIL get HTTP $code"
  cat "$get_out"
  exit 1
fi

python3 <<PY
import json, sys
data = json.load(open("$get_out"))["item"]
vc = data.get("variant_catalog") or {}
matrix = vc.get("size_matrix") or {}
sku = vc.get("sku_stock") or {}
errors = []
if matrix.get("Qora") != ["S", "M"]:
    errors.append(f"Qora sizes: {matrix.get('Qora')}")
if matrix.get("Oq") != ["L"]:
    errors.append(f"Oq sizes: {matrix.get('Oq')}")
if sku.get("qora|s") != 3:
    errors.append(f"qora|s stock: {sku.get('qora|s')}")
if sku.get("oq|l") != 5:
    errors.append(f"oq|l stock: {sku.get('oq|l')}")
colors = {c["name"]: c for c in vc.get("colors") or []}
if "Qora" not in colors or "Oq" not in colors:
    errors.append(f"colors missing: {list(colors)}")
if errors:
    print("FAIL variant_catalog:", "; ".join(errors))
    sys.exit(1)
print("OK  variant_catalog matrix + sku_stock")
print("PASS merchant product variants smoke")
PY
