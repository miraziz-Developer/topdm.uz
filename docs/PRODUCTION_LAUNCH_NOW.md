# Production launch (mobil ilovasiz)

Mobil store ilovalari **to‘xtatilgan**. Quyidagi zanjir productionga chiqadi.

## 1. Server `.env`

```bash
cp .env.production.example .env
# To'ldiring: JWT_SECRET, POSTGRES_PASSWORD, GROQ_API_KEY, TELEGRAM_BOT_TOKEN,
# RESEND_*, YANDEX_MAPS (build arg), SITE_URL, MERCHANT_CRM_WEBAPP_URL
```

Tavsiya (birinchi launch):

```env
APP_ENV=production
ENABLE_ONLINE_CHECKOUT=false
NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT=false
IS_DELIVERY_SANDBOX=false
YANDEX_DELIVERY_TOKEN=...
YANDEX_API_URL=https://b2b.taxi.yandex.net
```

Click/Payme keyinroq yoqiladi — kod tayyor.

## 2. Preflight

```bash
./scripts/preflight-deploy.sh
```

## 3. Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

## 4. Smoke

```bash
./scripts/smoke-all.sh https://topdim.uz https://crm.topdim.uz https://api.topdim.uz
```

## 5. Qo‘lda 5 daqiqa

1. `topdim.uz` — mahsulot, bron, buyurtmalar
2. `crm.topdim.uz` — login, buyurtmalar, **Yandex kuryerini chaqirish**
3. Telegram bot — `/start`, merchant OTP
4. Delivery quote + reserve (agar Yandex token bor)
5. Buyurtma telefon bilan `orders` da ko‘rinadi

## Rollback

```bash
docker compose -f docker-compose.prod.yml down
# old image tagga qaytish
docker compose -f docker-compose.prod.yml up -d
```

## Keyinroq (mobil)

`docs/MOBILE_APPS_PAUSED.md` — APK/Xcode qayta yoqilganda.
