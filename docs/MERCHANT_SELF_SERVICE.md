# Do'kon egasi — o'zi ro'yxatdan o'tish (Telegram bot)

## Oqim

1. Merchant bot → `/register`
2. 8 qadam: nom, bozor, blok/qator, do'kon raqami, izoh, **Telegram location**, **fasad rasmi**, **kontakt**
3. Tasdiq → tizim **login + parol** beradi
4. Bot CRM rejimiga o'tadi — rasm yuborish → AI to'ldiradi → kategoriya/narx → **Yuklash**
5. `crm.topdim.uz/login` — login+parol, do'kon OTP, yoki @username OTP

## Majburiy maydonlar

| Maydon | Qayerda |
|--------|---------|
| Do'kon nomi | Matn |
| Bozor (Ippodrom, Chorsu, …) | Tugma |
| Blok / qator | Matn |
| Do'kon raqami | Matn |
| Joy izohi (mijoz uchun) | Matn |
| GPS joylashuv | Telegram 📍 |
| Tashqi rasm (fasad) | Rasm |
| Egasi telefoni | Kontakt |

## CRM kirish

| Usul | API |
|------|-----|
| Login + parol | `POST /auth/merchant/login` |
| Do'kon login + OTP (botga kod) | `POST /auth/merchant/send-otp` + `verify-otp` |
| Telegram @username | `POST /auth/send-otp` + `verify-otp` |

## Mahsulot (bot)

1. Rasm yuboring
2. AI: nom, narx taklifi, rang
3. Tugmalar: Kategoriya, Narx, Nom, **Yuklash**, Bekor
4. Yuklash → saytda `published`

## Yo'ldagi mijozlar (CRM xarita)

CRM → **Xarita** — bron qilgan mijoz xaritaga kirganda taxminiy masofada ko'rinadi.

- **Maxfiylik:** aniq GPS emas (~500 m grid), telefon maskalanadi
- **Radius:** 1–30 km (standart 10 km) — sozlanadi
- **Signal:** Telegram + CRM «Bugun» paneli (5 km → 2 km → 1 km → bozorda)

Mijoz: Buyurtmalar → «Do'konga borish (xarita)» — yo'l boshlanganda avtomatik ping.

## Olib ketish (yakunlash)

| Usul | Qanday |
|------|--------|
| **Qo'lda (tavsiya)** | CRM → Buyurtmalar → **«Olib ketdi»** → `completed` |
| **Avtomatik** | Mijoz do'konda ~100 m + 20 daq (sozlash mumkin) → `completed` |

Mijoz do'konga yetganda: sotuvchiga Telegram + «Mijoz do'konda»; 3 daqdan keyin «Tasdiqlang» eslatma.

Sozlama: `PATCH /merchant/pickup-settings` — `auto_complete_enabled`, `auto_complete_after_minutes`, `shop_arrival_radius_m`.

## Mijozlarga havola va QR (tarqatish)

CRM → **O‘sish** (`/dashboard/growth`) yoki **Bosh sahifa** (qisqa panel):

- Do'kon havolasi: `https://topdim.uz/shop/{slug}`
- QR kod **do'kon nomi bilan** (rasm ichida caption + «Skanerlang — katalogga kiring»)
- Chop etish posteri (CRM → Posterni chop etish)
- Skanerlang → `topdim.uz/shop/{slug}?from=qr` — mijozga «Xush kelibsiz, {do'kon}» banner
- Tayyor matnlar (nusxalash / WhatsApp / Telegram):
  - **Mijozga to'liq xabar** — «kirib qarang, bor-yo'qligini ko'ring, ish vaqti…»
  - **Qisqa SMS**
  - **Guruh / kanal**
  - **Eshik / vitrina matni**

Ish vaqtini CRMda saqlang — matnlarga avtomatik qo'shiladi.

**Admin** (do'kon egasiga yuborish uchun, tasdiqlashdan keyin):

```bash
curl -s -H "X-Admin-Key: $ADMIN_API_KEY" \
  "https://api.topdim.uz/admin/shops/{SHOP_UUID}/share-kit" | jq .
```

## Admin havolasi (eski usul)

`/start shop_<UUID>` + kontakt — hali ishlaydi.

## Migratsiya

```bash
docker compose exec backend alembic -c alembic.ini upgrade head
docker compose restart backend merchant-bot
```
