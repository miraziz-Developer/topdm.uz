# Topdim Merchant CRM Mobile (Android/iOS)

This is the native wrapper project for merchant CRM.

## Goal

- Dedicated seller-only mobile app.
- Open merchant CRM instantly.
- Receive push/local notifications for new orders.
- One-tap action inside CRM: `Yandex kuryerini chaqirish`.

## Quick start

```bash
cd merchant-crm-mobile
npm install
npm run cap:add:android
npm run cap:add:ios
npm run cap:sync
```

Open projects:

```bash
npm run cap:open:android
npm run cap:open:ios
```

## Channel setup

- Android push: configure Firebase in Android Studio (`google-services.json`).
- iOS push: configure APNs + Firebase in Xcode (`GoogleService-Info.plist`).
- Domain served in wrapper: `https://crm.topdim.uz`.

## Operational flow

1. Merchant receives notification on phone.
2. Opens mobile CRM app.
3. Goes to orders panel.
4. Taps `Yandex kuryerini chaqirish`.

## Notes

- CRM itself already has periodic order polling and now triggers local/web notification when new orders appear.
- For store release, set app icons/splash in native projects after `cap add`.
