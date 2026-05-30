# Merchant Mobile Release Checklist

## 1) Build readiness

- `merchant-crm` build passes.
- `merchant-crm-mobile` initialized and synced:
  - `make setup-merchant-mobile`

## 2) Android (Play Store)

- Add Firebase config: `android/app/google-services.json`.
- Configure app icon, splash, package metadata.
- Generate signed AAB in Android Studio.
- Test:
  - login
  - orders list refresh
  - new-order local/push notification
  - `Yandex kuryerini chaqirish` action

## 3) iOS (App Store)

- Add Firebase/APNs config in Xcode:
  - `GoogleService-Info.plist`
  - Push Notifications + Background Modes capabilities
- Configure bundle id, signing, provisioning.
- Archive and upload via Xcode Organizer.
- Test on physical iPhone:
  - login persistence
  - order polling
  - notification open -> deep-link to orders page
  - courier assign action

## 4) Backend and env

- Ensure these are set in production:
  - `YANDEX_DELIVERY_TOKEN`
  - `YANDEX_API_URL`
  - `IS_DELIVERY_SANDBOX` (false on production)
  - Click/Payme keys + callback whitelist

## 5) Final smoke

- `bash scripts/smoke-all.sh https://topdim.uz https://crm.topdim.uz https://api.topdim.uz`
- `bash scripts/smoke-payment-callbacks.sh https://api.topdim.uz`

## 6) Go-live ops

- Add crash analytics (Firebase Crashlytics/Sentry).
- Add release channel strategy (internal -> closed beta -> production).
- Add support contact and privacy policy links in store listing.
