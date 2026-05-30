#!/usr/bin/env bash
# Bozor-AI / Topdim API smoke tests. Requires backend at BASE (default http://127.0.0.1:8000).
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8000}"
API="${BASE}/api/v1"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK   $*"; }

echo "=== Smoke API ==="
echo "BASE=$BASE"
echo

code=$(curl -sS -o /tmp/health.json -w "%{http_code}" "$BASE/health" || echo "000")
if [[ "$code" != "200" ]]; then
  fail "GET /health → HTTP $code (is uvicorn running?)"
fi
ok "GET /health ($code)"
python3 - <<'PY' || fail "health JSON invalid"
import json,sys
d=json.load(open("/tmp/health.json"))
assert "status" in d and "checks" in d
print("     status:", d.get("status"), "checks:", d.get("checks"))
PY

code=$(curl -sS -o /tmp/cat.json -w "%{http_code}" "$API/categories" || echo "000")
[[ "$code" == "200" ]] || fail "GET /categories → $code"
ok "GET /categories ($code)"
python3 - <<'PY' || fail "categories not a list"
import json
a=json.load(open("/tmp/cat.json"))
assert isinstance(a,list) and len(a)>=1
print("     count:", len(a))
PY

code=$(curl -sS -o /tmp/search.json -w "%{http_code}" "$API/products/search?limit=2&page=1" || echo "000")
[[ "$code" == "200" ]] || fail "GET /products/search → $code"
ok "GET /products/search ($code)"
PID=$(python3 -c "import json;d=json.load(open('/tmp/search.json'));print(d['items'][0]['id'])")

code=$(curl -sS -o /tmp/prod.json -w "%{http_code}" "$API/products/$PID" || echo "000")
[[ "$code" == "200" ]] || fail "GET /products/{id} → $code"
ok "GET /products/{id} ($code)"

code=$(curl -sS -o /tmp/sim.json -w "%{http_code}" "$API/products/$PID/similar" || echo "000")
[[ "$code" == "200" ]] || fail "GET /products/{id}/similar → $code"
ok "GET /products/{id}/similar ($code)"

code=$(curl -sS -o /tmp/lead.json -w "%{http_code}" -X POST "$API/leads" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\":\"$PID\",\"phone\":\"+998901112233\",\"customer_name\":\"Smoke Test\"}" || echo "000")
[[ "$code" == "200" ]] || fail "POST /leads → $code"
ok "POST /leads ($code)"

code=$(curl -sS -o /tmp/track.json -w "%{http_code}" -X POST "$API/tracking/events" \
  -H "Content-Type: application/json" \
  -d "{\"event_type\":\"view\",\"product_id\":\"$PID\",\"metadata\":{\"source\":\"smoke\"}}" || echo "000")
[[ "$code" == "200" ]] || fail "POST /tracking/events → $code"
ok "POST /tracking/events ($code)"

SID=$(python3 -c "import json;d=json.load(open('/tmp/prod.json'));print(d.get('shop',{}).get('id',''))")
[[ -n "$SID" ]] || fail "product has no shop.id"
code=$(curl -sS -o /tmp/dash.json -w "%{http_code}" "$API/dashboard/shop/$SID" || echo "000")
[[ "$code" == "200" ]] || fail "GET /dashboard/shop/{id} → $code"
ok "GET /dashboard/shop/{id} ($code)"

code=$(curl -sS -o /tmp/stylist.json -w "%{http_code}" -X POST "$API/stylist/lookbook" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"smoke-user","text":"toʻyga rasmiy kiyim tavsiya"}' || echo "000")
[[ "$code" == "200" ]] || fail "POST /stylist/lookbook → $code (check GROQ_API_KEY + DB seed)"
ok "POST /stylist/lookbook ($code)"
python3 - <<'PY' || fail "stylist response shape"
import json
d=json.load(open("/tmp/stylist.json"))
assert "source" in d and "intent" in d and "lookbook" in d and "explanation" in d
print("     source:", d["source"], "lookbook items:", len(d.get("lookbook") or []))
PY

echo
echo "=== Indoor map API ==="
code=$(curl -sS -o /tmp/indoor.json -w "%{http_code}" "$API/indoor-maps/ippodrom" || echo "000")
[[ "$code" == "200" ]] || fail "GET /indoor-maps/ippodrom → $code"
ok "GET /indoor-maps/ippodrom ($code)"
python3 - <<'PY' || fail "indoor map shape"
import json
d=json.load(open("/tmp/indoor.json"))
assert "levels" in d and len(d["levels"]) >= 1
assert "navigation_graph" in d["levels"][0] or "stalls" in d["levels"][0]
print("     levels:", len(d["levels"]), "source:", d.get("source"))
PY

code=$(curl -sS -o /tmp/geo.json -w "%{http_code}" -X POST "$API/indoor-maps/ippodrom/geofence/check" \
  -H "Content-Type: application/json" \
  -d '{"lat":41.2346,"lng":69.1834}' || echo "000")
[[ "$code" == "200" ]] || fail "POST /indoor-maps/ippodrom/geofence/check → $code"
ok "POST geofence/check ($code)"

code=$(curl -sS -o /tmp/route.json -w "%{http_code}" \
  "$API/indoor-maps/ippodrom/levels/1/route?start_node_id=entrance-A&goal_node_id=stall-A-08" || echo "000")
[[ "$code" == "200" ]] || fail "GET indoor route → $code"
ok "GET indoor route ($code)"

echo
echo "=== Shop chat API ==="
code=$(curl -sS -o /tmp/chat_thread.json -w "%{http_code}" -X POST "$API/chat/threads" \
  -H "Content-Type: application/json" \
  -d "{\"shop_id\":\"$SID\",\"customer_key\":\"smoke-session\",\"customer_display_name\":\"Smoke Mijoz\"}" || echo "000")
[[ "$code" == "200" ]] || fail "POST /chat/threads → $code"
ok "POST /chat/threads ($code)"
TID=$(python3 -c "import json;d=json.load(open('/tmp/chat_thread.json'));print(d['thread']['id'])")

code=$(curl -sS -o /tmp/chat_msgs.json -w "%{http_code}" "$API/chat/threads/$TID/messages" || echo "000")
[[ "$code" == "200" ]] || fail "GET /chat/threads/{id}/messages → $code"
ok "GET chat messages ($code)"

code=$(curl -sS -o /tmp/chat_post.json -w "%{http_code}" -X POST "$API/chat/threads/$TID/messages?role=customer&session_id=smoke-session" \
  -H "Content-Type: application/json" \
  -d '{"body":"Salom, bu smoke test"}' || echo "000")
[[ "$code" == "200" ]] || fail "POST chat message → $code"
ok "POST chat message ($code)"

echo
echo "=== All smoke checks passed ==="
