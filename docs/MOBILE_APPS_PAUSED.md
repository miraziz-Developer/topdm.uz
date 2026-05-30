# Mobil ilovalar — vaqtincha to‘xtatilgan

**Qaror:** Native Android/iOS (Play Store / App Store) keyingi bosqichga qoldirildi.  
**Hozirgi fokus:** Web + CRM + Backend production deploy — hammasi ideal bog‘langach ilova qo‘shiladi.

Kod (`merchant-crm-mobile/`, APK skriptlari) **o‘chirilmaydi** — faqat hozircha ishlatilmaydi.

## Nima productionga chiqadi (hozir)

| Kanal | URL | Holat |
|-------|-----|--------|
| Mijoz sayti | `https://topdim.uz` | Deploy |
| Merchant CRM (web) | `https://crm.topdim.uz` | Deploy |
| API | `https://api.topdim.uz` | Deploy |
| Telegram bot | server worker | Deploy |

## Nima keyinroq

- `merchant-crm-mobile/` — Capacitor wrapper (APK build skripti tayyor, ishlatilmaydi)
- Play Store / App Store
- Firebase/APNs background push

## Kod saqlanadi

- `scripts/build-merchant-apk.sh` — kerak bo‘lsa keyin
- `make setup-merchant-mobile` — kerak bo‘lsa keyin
- PWA “CRM ilovani o‘rnating” banneri **o‘chiq** (`NEXT_PUBLIC_CRM_APP_PROMPTS` yo‘q yoki `0`). Keyin: `=1`
