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
- Android Studio + Android SDK (Android build/emulator uchun)
- JDK 17+

Bu repo ichida Android SDK/Android Studio yo'q — build va real qurilmada/emulyatorda sinash uchun shu vositalar o'rnatilgan mashinada ochish kerak.
