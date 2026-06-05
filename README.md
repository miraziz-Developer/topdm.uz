# Bozorliii.uz

Mahalliy bozor uchun AI marketplace: katalog, qidiruv, bron, xarita, merchant Telegram bot va CRM.

| Qism | Texnologiya | Port (dev) |
|------|-------------|------------|
| API | FastAPI, PostgreSQL 16 + pgvector, Redis | 8000 |
| Mijoz web | Next.js 14 | 3002 |
| Merchant CRM | Next.js 14 | 3003 |
| Bot | Aiogram (merchant) | — |

---

## Tez boshlash (lokal)

```bash
git clone <repo-url> bozorliii && cd bozorliii
cp .env.example .env          # yoki mavjud .env ni tahrirlang
docker compose up -d --build
```

| URL | |
|-----|---|
| Do‘kon | http://localhost:3002 |
| CRM | http://localhost:3003 |
| API health | http://localhost:8000/health |

Migratsiya backend startida avtomatik. **Productionda seed yo‘q** (`RUN_SEED=false`).

```bash
make dev-up          # docker compose
make prod-preflight  # .env tekshiruv (server oldidan)
make prod-deploy     # production stack + health
```

---

## Loyiha tuzilmasi

```
├── backend/           # FastAPI + Alembic
├── frontend/        # Mijoz Next.js
├── merchant-crm/    # Sotuvchi panel
├── scripts/         # deploy-prod, preflight, generate-production-env
├── deploy/          # nginx, SSL, install-docker
├── docker-compose.yml
└── docker-compose.prod.yml
```

---

## Production

**Server:** `8.222.211.54`  
**Domenlar:** `bozorliii.online`, `api.bozorliii.online`, `crm.bozorliii.online`

### 1. DNS (certbot oldidan majburiy)

**NXDOMAIN** = domen DNS hali yo‘q. Avval registrar panelida quyidagilarni qo‘shing:

| Type | Host | Value |
|------|------|--------|
| A | `@` | `8.222.211.54` |
| A | `www` | `8.222.211.54` |
| A | `api` | `8.222.211.54` |
| A | `crm` | `8.222.211.54` |

Tekshirish (Mac yoki serverda):

```bash
bash deploy/check-dns.sh
```

Hammasi **OK** bo‘lgach (5–30 daqiqa kutish mumkin):

```bash
bash deploy/bootstrap-ssl.sh
docker compose -f docker-compose.prod.yml restart nginx
```

Security Group: **22, 80, 443** ochiq.

### 2. Production `.env`

```bash
./scripts/generate-production-env.sh > .env
nano .env
```

| O‘zgaruvchi | Production |
|-------------|------------|
| `PRODUCTION` | `true` |
| `ALLOW_DEV_MOCKS` | `false` |
| `RUN_SEED` | `false` |
| `PREMIUM_CHINA_DEMO_MODE` | `false` |
| `ENABLE_ONLINE_CHECKOUT` | `false` (Click/Payme keyin) |

Majburiy: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_API_KEY`, `TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY`, `GOOGLE_API_KEY` yoki `OPENAI_API_KEY`, `RESEND_API_KEY`.

Namuna: `.env.production.example`

### 3. SSH

`~/.ssh/config`:

```
Host bozorliii
  HostName 8.222.211.54
  User root
```

```bash
ssh root@8.222.211.54
```

### 4. Deploy (Mac dan, SSH ishlaganda)

```bash
./scripts/deploy-from-mac.sh
```

Yoki serverda:

```bash
bash deploy/install-docker.sh    # birinchi marta
bash deploy/bootstrap-ssl.sh     # Let's Encrypt → deploy/ssl/
./scripts/deploy-prod.sh
```

### 5. Tekshirish

- https://bozorliii.online/health  
- https://crm.bozorliii.online/login  
- Telegram bot → `/register` → CRM Panel  

---

## Merchant oqimi

1. Admin do‘kon yaratadi (`owner_phone` +998…).  
2. Botda `/start shop_<uuid>` → kontakt (telefon mos kelishi kerak).  
3. **CRM Panel** — buyurtma, lead, chat, mahsulot, xarita, reels/stories.  
4. Mijoz `bozorliii.online` da qidiradi → bron → do‘konga keladi.

---

## Muhim API (`/api/v1`)

- `GET /health` — holat  
- `GET /products/search`, `GET /products/{id}`  
- Checkout / buyurtma (naqd/terminal; onlayn to‘lov ixtiyoriy)  
- `POST /auth/telegram/*`, email OTP  
- CRM: `/crm/*` (merchant JWT)  

To‘liq ro‘yxat: `http://localhost:8000/docs` (faqat `APP_DEBUG=true`).

---

## Konfiguratsiya

Asosiy kalitlar — `backend/.env.example` va root `.env`.

| Guruh | O‘zgaruvchilar |
|-------|----------------|
| DB | `DATABASE_URL`, `POSTGRES_*` |
| AI | `GROQ_API_KEY`, `GOOGLE_API_KEY` |
| Auth | `JWT_SECRET`, `TELEGRAM_BOT_TOKEN` |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Xarita | `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` |
| Media | `MEDIA_STORAGE_BACKEND` (`local` yoki `s3`) |

**`.env` ni gitga commit qilmang.**

---

## Click / Payme (keyinroq)

```env
ENABLE_ONLINE_CHECKOUT=true
NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT=true
CLICK_SERVICE_ID=...
PAYME_MERCHANT_ID=...
```

---

## Skriptlar

| Skript | Vazifa |
|--------|--------|
| `scripts/preflight-deploy.sh` | Deploy oldidan `.env` tekshiruv |
| `scripts/deploy-prod.sh` | Build + `docker compose -f docker-compose.prod.yml up` |
| `scripts/deploy-from-mac.sh` | rsync + serverda deploy |
| `scripts/generate-production-env.sh` | Production `.env` yaratish |

---

## License

Maintainer litsenziyasini qo‘shguncha — repository default copyright.
