#!/usr/bin/env bash
# Build installable Android APK (no Android Studio GUI required).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/merchant-crm-mobile"
LAN_IP="${LAN_IP:-$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")}"
CRM_URL="${MERCHANT_CRM_URL:-http://${LAN_IP}:3003}"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

echo "CRM URL inside app: $CRM_URL"
echo "Make sure: docker compose up -d merchant-crm backend"
echo "Phone and Mac must be on same Wi‑Fi."

cd "$MOBILE"
MERCHANT_CRM_URL="$CRM_URL" npx cap sync android
cd android
./gradlew assembleDebug

mkdir -p "$MOBILE/dist"
cp app/build/outputs/apk/debug/app-debug.apk "$MOBILE/dist/Topdim-Merchant-CRM-debug.apk"
echo ""
echo "APK ready: $MOBILE/dist/Topdim-Merchant-CRM-debug.apk"
open "$MOBILE/dist" 2>/dev/null || true
