#!/usr/bin/env bash
# DNS tayyorligini tekshirish — certbot oldidan ishga tushiring
set -euo pipefail

IP="${SERVER_IP:-8.222.211.54}"
DOMAINS=(bozorliii.online www.bozorliii.online api.bozorliii.online crm.bozorliii.online)

echo "Kutilayotgan server IP: $IP"
echo ""

ok=0
fail=0

for d in "${DOMAINS[@]}"; do
  a=$(dig +short A "$d" 2>/dev/null | head -1 || true)
  if [[ -z "$a" ]]; then
    echo "FAIL  $d — A yozuv yo'q (NXDOMAIN yoki propagatsiya)"
    fail=$((fail + 1))
  elif [[ "$a" == "$IP" ]]; then
    echo "OK    $d → $a"
    ok=$((ok + 1))
  else
    echo "WARN  $d → $a (kutilgan: $IP)"
    fail=$((fail + 1))
  fi
done

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "DNS tayyor — endi: bash deploy/bootstrap-ssl.sh"
  exit 0
fi

echo "Certbot ishlamaydi — avval domain registrar / DNS panelda A yozuvlarni qo'shing."
echo "Nameserverlar domen sotib olgan joyda (registrar) to'g'ri ko'rsatilgan bo'lishi kerak."
exit 1
