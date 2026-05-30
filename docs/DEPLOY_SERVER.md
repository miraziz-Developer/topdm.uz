# Serverga deploy — to‘liq qo‘llanma (Topdim.UZ)

> **Click / Payme hozircha o‘chiq** — faqat do‘konda naqd/terminal. Account bo‘lganda `.env` da `ENABLE_ONLINE_CHECKOUT=true` qo‘ying.

## 1. Server talablari

- Ubuntu 22.04+ yoki Debian 12+
- **4 GB RAM**, 2+ vCPU, 40+ GB disk
- Docker Engine 24+ va Docker Compose v2
- DNS (A yozuvlari bir xil IP ga):
  - `topdim.uz`, `www.topdim.uz`
  - `api.topdim.uz`
  - `crm.topdim.uz`

## 2. Bir martalik tayyorgarlik

```bash
git clone <repo-url> topdim && cd topdim
cp .env.production.example .env
nano .env   # barcha CHANGE_ME va kalitlarni to‘ldiring
mkdir -p deploy/ssl deploy/certbot/www
```

**Majburiy `.env` maydonlari:**

| O‘zgaruvchi | Izoh |
|-------------|------|
| `POSTGRES_PASSWORD` | Kuchli parol |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ADMIN_API_KEY` | Admin API |
| `TELEGRAM_BOT_TOKEN` | @BotFather |
| `TELEGRAM_BOT_USERNAME` | botsiz @ |
| `GROQ_API_KEY` | AI stylist |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | Email OTP |
| `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` | Xarita (build) |
| `CORS_ORIGINS` | HTTPS domenlar |

**SSL** — `deploy/ssl/fullchain.pem` va `privkey.pem` (Let's Encrypt yoki boshqa CA).

## 3. Preflight (deploy oldidan)

```bash
./scripts/preflight-deploy.sh
# yoki to‘liq local gate (build + static verify):
make world-class
```

**Production AI (majburiy):** `GROQ_API_KEY` + (`GOOGLE_API_KEY` yoki `OPENAI_API_KEY` embedding uchun). Rasm qidiruv uchun `GOOGLE_API_KEY` tavsiya etiladi.

## 4. Ishga tushirish

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Kutiladigan servislar: `postgres`, `redis`, `backend`, `merchant-bot`, `frontend`, `merchant-crm`, `nginx`.

Migratsiya backend startida avtomatik (`alembic upgrade head`).

## 5. Smoke test

```bash
./scripts/smoke-all.sh https://topdim.uz https://crm.topdim.uz https://api.topdim.uz
```

## 6. Qo‘lda tekshirish (5 daqiqa)

1. **Mijoz** — `https://topdim.uz` → mahsulot → checkout → naqd/terminal → bron
2. **Auth** — Telegram yoki email OTP
3. **Xarita** — `/map` pin, do‘kon tanlash
4. **CRM** — `https://crm.topdim.uz/login` → OTP → buyurtma/lead/chat
5. **Bot** — Telegram `/start` → kontakt → rasm yuborish → CRM moderatsiya

## 7. Arxitektura

| URL | Servis |
|-----|--------|
| `topdim.uz` | frontend (Next) |
| `topdim.uz/api/v1/*` | frontend proxy → backend |
| `topdim.uz/ws/*` | backend (chat) |
| `api.topdim.uz` | backend to‘g‘ridan |
| `crm.topdim.uz` | merchant-crm + `/api/v1` proxy + `/ws/` |

## 8. Yangilash

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
./scripts/smoke-all.sh https://topdim.uz https://crm.topdim.uz
```

## 9. Click/Payme keyinroq

`.env` da:

```env
ENABLE_ONLINE_CHECKOUT=true
NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT=true
CLICK_SERVICE_ID=...
CLICK_SECRET_KEY=...
PAYME_MERCHANT_ID=...
PAYME_SECRET_KEY=...
```

Keyin qayta build: `docker compose -f docker-compose.prod.yml up -d --build frontend`.

## 10. Muammolar

| Belgi | Yechim |
|-------|--------|
| 502 API | `docker compose logs backend --tail=80` |
| CRM login 500 (dev) | `make dev-reset-crm` yoki `docker compose restart merchant-crm` |
| CRM login 401 | Botda `/start`, telefon `owner_phone` bilan mos |
| Chat ulanmaydi | nginx `/ws/` → backend (crm va topdim) |
| Xarita bo‘sh | `NEXT_PUBLIC_YANDEX_MAPS_API_KEY`, referrer domen |
| Mock kontent | `NEXT_PUBLIC_ALLOW_DEV_MOCKS` o‘chirilganini tekshiring |

Batafsil: [LAUNCH_30_DAYS.md](LAUNCH_30_DAYS.md) (10 ta launch vazifasi), [LAUNCH_CHECKLIST.md](../LAUNCH_CHECKLIST.md), [CRM_LAUNCH_CHECKLIST.md](CRM_LAUNCH_CHECKLIST.md), [PRODUCT_MASTER_PLAN.md](PRODUCT_MASTER_PLAN.md).

## 11. Katalog to‘ldirish (rasm qidiruv testi)

Pinterest scrap qilinmaydi (qonuniy sabab). O‘rniga **barqaror seed rasmlar** (picsum) + Ippodrom do‘konlari; productionda merchant o‘z rasmini yuklaydi:

```bash
docker compose exec backend python /app/scripts/fix_product_images.py --reembed
docker compose exec backend python /app/scripts/ensure_suit_catalog.py
docker compose exec backend python /app/scripts/seed_bulk_ippodrom.py --target 300
docker compose exec backend python /app/scripts/reembed_products.py   # GOOGLE_API_KEY kerak
docker compose restart backend
./scripts/smoke-image-search.sh http://localhost:8000/api/v1
```

`seed_bulk_ippodrom.py --reembed` — seed + indeks bir buyruqda.

## 12. AI Stilist smoke

Stilist chat (Groq + vector katalog) ishlayotganini tekshirish:

```bash
chmod +x scripts/smoke-stylist-chat.sh
./scripts/smoke-stylist-chat.sh
```

Batafsil: [STYLIST_AI.md](STYLIST_AI.md).
