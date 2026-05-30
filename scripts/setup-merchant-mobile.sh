#!/usr/bin/env bash
# Merchant CRM native wrapper setup (Android + iOS).
# Partial success is OK: Android can finish even if iOS deps are missing on this Mac.
set -uo pipefail

export CI="${CI:-1}"
export CAPACITOR_DISABLE_TELEMETRY="${CAPACITOR_DISABLE_TELEMETRY:-1}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$ROOT/merchant-crm-mobile"

if [[ ! -d "$MOBILE_DIR" ]]; then
  echo "Missing merchant-crm-mobile directory"
  exit 1
fi

cd "$MOBILE_DIR"
echo "== Topdim Merchant Mobile setup =="

has_xcode_app() {
  [[ -d "/Applications/Xcode.app/Contents/Developer" ]]
}

has_android_studio() {
  [[ -d "/Applications/Android Studio.app" ]] || [[ -n "${CAPACITOR_ANDROID_STUDIO_PATH:-}" ]]
}

echo ""
echo "-- Prerequisites --"
if has_xcode_app; then
  echo "OK  Xcode.app found"
else
  echo "!!  Xcode.app not found (required for iOS build)"
  echo "    Install: App Store -> Xcode, then run:"
  echo "    sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
fi

if command -v pod >/dev/null 2>&1; then
  echo "OK  CocoaPods (pod) found"
else
  echo "!!  CocoaPods not found (required for iOS pods)"
  echo "    Install: sudo gem install cocoapods   OR   brew install cocoapods"
fi

if has_android_studio; then
  echo "OK  Android Studio found"
else
  echo "!!  Android Studio not found (required to open/build Android project)"
  echo "    Install: https://developer.android.com/studio"
fi

echo ""
npm install

ANDROID_OK=0
IOS_OK=0

if [[ ! -d android ]]; then
  echo ""
  echo "-- Adding Android --"
  if npm run cap:add:android; then
    ANDROID_OK=1
  else
    echo "WARN Android add failed"
  fi
else
  echo "OK  android/ already exists"
  ANDROID_OK=1
fi

if [[ ! -d ios ]]; then
  echo ""
  echo "-- Adding iOS --"
  if has_xcode_app && command -v pod >/dev/null 2>&1; then
    if npm run cap:add:ios; then
      IOS_OK=1
    else
      echo "WARN iOS add failed (see Xcode/CocoaPods above)"
    fi
  else
    echo "SKIP iOS add — install Xcode + CocoaPods first, then run:"
    echo "     cd merchant-crm-mobile && npm run cap:add:ios && npm run cap:sync"
    # Folder may exist from a previous partial run; treat as partial.
    [[ -d ios ]] && IOS_OK=1
  fi
else
  echo "OK  ios/ already exists"
  IOS_OK=1
fi

echo ""
echo "-- Capacitor sync --"
if npm run cap:sync; then
  echo "OK  cap sync"
else
  echo "WARN cap sync had errors (common when iOS pods/Xcode are missing)"
fi

echo ""
echo "== Summary =="
if [[ "$ANDROID_OK" -eq 1 ]]; then
  echo "Android: ready (project in merchant-crm-mobile/android)"
  if has_android_studio; then
    echo "  Open:  cd merchant-crm-mobile && npm run cap:open:android"
  else
    echo "  Install Android Studio, then: npm run cap:open:android"
  fi
else
  echo "Android: not ready — re-run after fixing npm/cap errors"
fi

if [[ "$IOS_OK" -eq 1 ]] && has_xcode_app && command -v pod >/dev/null 2>&1; then
  echo "iOS: ready (project in merchant-crm-mobile/ios)"
  echo "  Open:  cd merchant-crm-mobile && npm run cap:open:ios"
elif [[ -d ios ]]; then
  echo "iOS: project folder exists but pods may be incomplete"
  echo "  Fix: install Xcode + CocoaPods, then:"
  echo "       cd merchant-crm-mobile/ios/App && pod install"
  echo "       cd ../.. && npm run cap:sync"
else
  echo "iOS: skipped — install Xcode (App Store) and CocoaPods, then cap:add:ios"
fi

echo ""
echo "CRM web/PWA (no store): https://crm.topdim.uz — works in browser + Add to Home Screen"
echo "Docs: docs/MERCHANT_MOBILE_MAC_SETUP.md"

# Exit 0 if at least Android is usable (your terminal showed Android succeeded).
if [[ "$ANDROID_OK" -eq 1 ]]; then
  exit 0
fi
exit 1
