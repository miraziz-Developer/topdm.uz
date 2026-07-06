#!/usr/bin/env bash
# DNS tayyorligini tekshirish — certbot oldidan ishga tushiring
set -euo pipefail

IP="${SERVER_IP:-$(curl -fsS ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')}"
DOMAINS=(bozorliii.online www.bozorliii.online api.bozorliii.online crm.bozorliii.online)
OPTIONAL_DOMAINS=(media.bozorliii.online)

echo "Kutilayotgan server IP: $IP"
echo ""

ok=0
fail=0

check_domain() {
  local d="$1"
  local required="$2"
  local a
  a=$(dig +short A "$d" @8.8.8.8 2>/dev/null | head -1 || true)
  if [[ -z "$a" ]]; then
    if [[ "$required" == "1" ]]; then
      echo "FAIL  $d — A yozuv yo'q (NXDOMAIN yoki propagatsiya)"
      fail=$((fail + 1))
    else
      echo "SKIP  $d — ixtiyoriy, A yozuv yo'q"
    fi
  elif [[ "$a" == "$IP" ]]; then
    echo "OK    $d → $a"
    ok=$((ok + 1))
  else
    if [[ "$required" == "1" ]]; then
      echo "WARN  $d → $a (kutilgan: $IP)"
      fail=$((fail + 1))
    else
      echo "SKIP  $d → $a (ixtiyoriy, kutilgan: $IP)"
    fi
  fi
}

for d in "${DOMAINS[@]}"; do
  check_domain "$d" 1
done
for d in "${OPTIONAL_DOMAINS[@]}"; do
  check_domain "$d" 0
done

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "DNS tayyor — endi: bash deploy/bootstrap-ssl.sh"
  exit 0
fi

echo "Certbot ishlamaydi — avval domain registrar / DNS panelda A yozuvlarni qo'shing."
echo "Nameserverlar domen sotib olgan joyda (registrar) to'g'ri ko'rsatilgan bo'lishi kerak."
exit 1
