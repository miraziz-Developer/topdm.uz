#!/usr/bin/env bash
# Stylist / Bozor AI chat smoke — Groq outfit engine + product blocks.
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8000}"
API="${BASE}/api/v1"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK   $*"; }

echo "=== Smoke: Stylist AI Chat ==="
echo "BASE=$BASE"
echo

code=$(curl -sS -o /tmp/stylist_health.json -w "%{http_code}" "$BASE/health" || echo "000")
[[ "$code" == "200" ]] || fail "GET /health → $code"
ok "GET /health"

run_turn() {
  local name="$1"
  local text="$2"
  local outfile="/tmp/stylist_${name}.json"
  local payload
  payload=$(TURN_NAME="$name" TURN_TEXT="$text" python3 - <<'PY'
import json, os
print(json.dumps({
    "user_id": "smoke-stylist",
    "thread_id": f"smoke-{os.environ['TURN_NAME']}",
    "text": os.environ["TURN_TEXT"],
}))
PY
)
  code=$(curl -sS -o "$outfile" -w "%{http_code}" \
    -X POST "$API/chat/agent/turn" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    || echo "000")
  [[ "$code" == "200" ]] || fail "POST turn ($name) → HTTP $code"
  python3 - "$name" "$outfile" <<'PY'
import json, sys
name, path = sys.argv[1], sys.argv[2]
d = json.load(open(path))
engine = d.get("engine") or ""
route = d.get("route") or ""
text = (d.get("assistant_text") or "").strip()
blocks = d.get("blocks") or []
if not text:
    raise SystemExit(f"{name}: empty assistant_text")
if route == "shopping" and engine not in ("groq_outfit", "groq_outfit_retry", "groq_shopping"):
    raise SystemExit(f"{name}: unexpected engine={engine!r}")
ids = []
for b in blocks:
    if b.get("type") == "product_cards":
        ids.extend(b.get("product_ids") or [])
    if b.get("type") == "wardrobe_bundle":
        for s in b.get("slots") or []:
            if s.get("product_id"):
                ids.append(s["product_id"])
if route == "shopping" and not ids:
    raise SystemExit(f"{name}: shopping but no product ids in blocks")
print(f"     {name}: engine={engine} route={route} ids={len(ids)} chars={len(text)}")
PY
  ok "turn: $name"
}

run_turn "sport_zal" "Erkak sport kiyim zalga bormoqchiman 500 ming so'mgacha"
run_turn "correction" "zalga sviter kiyadmi jinnimsa sport krossovka kerak"
run_turn "chitchat" "salom"

echo
echo "=== All stylist smoke checks passed ==="
