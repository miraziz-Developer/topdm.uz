# Frontend Mobile

Capacitor + Android (va kelajakda iOS) ilova — mijoz saytining mobil qoplamasi.

Xuddi `merchant-crm-mobile/` kabi: bu alohida build emas, `frontend/` (Next.js PWA) ni native WebView orqali ochadi. Barcha funksiya (AI qidiruv, stylist, checkout) veb saytdan to'g'ridan-to'g'ri ishlaydi — mobil qoplama faqat native shell, push notification va uy ekrani ikonkasini beradi.

## Ishga tushirish

```bash
npm ci
npx cap sync android
npx cap open android   # Android Studio ochadi
```

Lokal dev serverga ulanish uchun (production o'rniga):

```bash
BOZORLIII_WEB_URL=http://10.0.2.2:3002 npx cap sync android
```

(`10.0.2.2` — Android emulyatordan host machine'ga ishora.)

## Icon / splash yangilash

Manba: `resources/icon.png` (512×512, `brand/assets/bozorliii-icon-512.png` dan olingan).

```bash
npx @capacitor/assets generate --iconBackgroundColor '#0066ff' --splashBackgroundColor '#0066ff'
```

## Talab qilinadigan lokal muhit

- Node.js
- Android Studio + Android SDK (Android build/emulator uchun), yoki JDK 17 + Android command-line tools (`brew install openjdk@17 --cask android-commandlinetools`) — Studio shart emas, `./gradlew` orqali buyruq qatoridan ham build qilish mumkin.

Loyiha buyruq qatori orqali build qilinib (`./gradlew assembleDebug`), Android emulyatorda ishga tushirilib sinovdan o'tgan (2026-08-19) — debug APK ishlaydi, real `bozorliii.online`ni to'g'ri yuklaydi.

## Play Store uchun release (signed) build

Release imzo kaliti **repo'da emas** — `frontend-mobile/keystore-DO-NOT-COMMIT/` gitignore qilingan (nomidan ko'rinib turibdi: hech qachon commit qilinmasin). Kalit va parollar sizga chatda alohida yuborilgan — parol menejeringizga saqlang.

Kalit borligini tekshirish:

```bash
ls frontend-mobile/keystore-DO-NOT-COMMIT/
# bozorliii-upload-key.jks
# keystore.properties
```

Agar bu fayllar yo'q bo'lsa (yangi mashina/kalit yo'qolgan holat), Google Play Console'dagi "App signing" bo'limidan upload key reset so'rovi yuboriladi — build.gradle `hasReleaseSigning` yo'q bo'lsa signsiz build qiladi, xato bermaydi.

Signed AAB (Play Console'ga yuklanadigan format) yig'ish:

```bash
cd android && ./gradlew bundleRelease
# natija: android/app/build/outputs/bundle/release/app-release.aab
```

Play Console'ga yuklashdan oldin:
1. https://play.google.com/console — developer akkaunt ($25, bir martalik)
2. Yangi ilova yaratish, `app-release.aab`ni yuklash
3. Ilova tavsifi, skrinshotlar, maxfiylik siyosati (`docs/` da tayyor material bor bo'lishi mumkin, aks holda yozish kerak)
4. Google tekshiruvi (odatda bir necha kun)
