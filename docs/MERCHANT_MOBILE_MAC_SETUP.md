# Merchant CRM — Mac setup (Android + iOS)

Your terminal output means:

| Step | Status | What to do |
|------|--------|------------|
| `cap add android` | OK | `merchant-crm-mobile/android` is ready |
| `cap add ios` | Failed | Need **Xcode** + **CocoaPods** |
| `cap open android` | Failed | Install **Android Studio** |
| `cap open ios` | Opened workspace | Full build still needs Xcode + pods |

## 1) iOS — fix `pod install` / xcodebuild

1. Install **Xcode** from the Mac App Store (not only Command Line Tools).
2. Point developer tools to Xcode:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

3. Install **CocoaPods**:

```bash
sudo gem install cocoapods
# or: brew install cocoapods
```

4. Install iOS pods and sync:

```bash
cd merchant-crm-mobile
npm run cap:add:ios    # skip if ios/ already exists
cd ios/App && pod install && cd ../..
npm run cap:sync
npm run cap:open:ios
```

## 2) Android — fix “Unable to launch Android Studio”

1. Install [Android Studio](https://developer.android.com/studio).
2. Open the project:

```bash
cd merchant-crm-mobile
npm run cap:open:android
```

If Studio is in a custom path:

```bash
export CAPACITOR_ANDROID_STUDIO_PATH="/path/to/Android Studio.app"
npm run cap:open:android
```

## 3) Re-run setup (safer script)

From repo root:

```bash
make setup-merchant-mobile
```

The script now **does not fail** only because iOS deps are missing, as long as Android was created.

## 4) Use CRM without store (today)

Sellers can use CRM immediately:

- Browser: `http://localhost:3003` (dev) or `https://crm.topdim.uz` (prod)
- **Install as PWA**: CRM shows “Android ilova” / iOS “Add to Home Screen”
- New orders: in-app toast + notification when CRM is open
- Delivery: **Yandex kuryerini chaqirish** on Orders panel

Native store apps need the tools above + Firebase/APNs for background push.
