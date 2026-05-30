# Topdim Mobile Rollout (1 day)

## 1) PWA (fastest path)

- Production HTTPS domain required (`https://topdim.uz`).
- `manifest.webmanifest` + `sw.js` already enabled.
- Android users: open site once -> `Install app` prompt appears.
- iOS users: Safari -> Share -> `Add to Home Screen`.

## 2) WebView shell (store publish path)

If you need Play Store / App Store listing quickly, wrap existing web in WebView:

- Android: Capacitor (`npx cap init`) + `android` target.
- iOS: Capacitor + `ios` target.
- Load URL: `https://topdim.uz`.
- Allow file upload, camera, geolocation permissions.
- Keep auth/session in same domain cookies.

## 3) Recommended release checklist

- Confirm `serviceWorker` active in browser devtools.
- Test install flow on:
  - Android Chrome
  - iPhone Safari
- Test offline fallback page `/offline`.
- Test push-notification plan (optional next phase: FCM/APNs).
- Run smoke:
  - `bash scripts/smoke-all.sh http://localhost:3002 http://localhost:3003 http://localhost:8000`

## 4) For your target users (doimiy/optom xaridorlar)

- Add shortcut campaigns:
  - "Ilovani o'rnatib oling" banner in checkout page.
  - Repeat buyers -> show install CTA after second successful order.
- Keep homepage lightweight for low-end devices.
