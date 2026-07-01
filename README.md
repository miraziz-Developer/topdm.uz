# Bozorliii.uz

**AI-powered mahalliy bozor marketplace** — kiyim-kechak katalogi, vizual qidiruv, onlayn bron, xarita navigatsiyasi, merchant CRM va Telegram bot.

> Texnik arxitektura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  
> Loyiha tuzilmasi: [docs/STRUCTURE.md](docs/STRUCTURE.md)  
> Production deploy: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## Texnologiyalar

| Qism | Stack | Port (dev) |
|------|-------|------------|
| **API** | Python 3.11, FastAPI, PostgreSQL 16 + pgvector, Redis, Celery | 8000 |
| **Mijoz web** | Next.js 14, PWA, Tailwind | 3002 |
| **Merchant CRM** | Next.js 14 | 3003 |
| **Mobil CRM** | Capacitor (Android) | — |
| **Bot** | Aiogram 3 (merchant) | — |

**AI:** Groq LLM, vizual embedding (CLIP), AI stylist agent, mahsulot moderatsiyasi.

**To'lov:** Click, Payme, escrow oqimi.

**Logistika:** BTS Express integratsiyasi.

---

## Loyiha tuzilmasi

```
├── backend/              # FastAPI API + bot + Celery
├── frontend/             # Mijoz Next.js PWA
├── merchant-crm/         # Sotuvchi panel
├── merchant-crm-mobile/  # Android (Capacitor)
├── brand/                # Brend manba PNG
├── deploy/               # nginx, SSL, server skriptlar
│   └── nginx/            # Production reverse proxy
├── scripts/              # Deploy va ops
├── docs/                 # STRUCTURE, ARCHITECTURE, DEPLOYMENT
├── docker-compose.yml
└── docker-compose.prod.yml
```

Har bir ilovada `README.md` bor. To‘liq xarita: [docs/STRUCTURE.md](docs/STRUCTURE.md).

---

## Tez boshlash

```bash
git clone <repo-url> bozorliii && cd bozorliii
cp .env.example .env          # dev
# yoki production: cp .env.production.example .env
docker compose up -d --build
```

| URL | |
|-----|---|
| Do'kon | http://localhost:3002 |
| CRM | http://localhost:3003 |
| API | http://localhost:8000/health |
| API docs | http://localhost:8000/docs (`APP_DEBUG=true`) |

Migratsiya backend startida avtomatik ishlaydi.

```bash
make dev-up           # docker compose
make test-backend     # pytest
make prod-preflight   # production .env tekshiruv
make prod-deploy      # production stack
```

---

## Asosiy funksiyalar

| Funksiya | Tavsif |
|----------|--------|
| Vizual qidiruv | Rasm yuklash orqali o'xshash mahsulotlarni topish |
| AI stylist | Kiyim maslahati va look kompozitsiyasi |
| Buyurtma + QR pickup | Bron, to'lov, do'konda QR bilan topshirish |
| Xarita | Do'konlar, piyoda marshrut, indoor navigatsiya |
| Merchant CRM | Mahsulot, buyurtma, chat, stories, analytics |
| Telegram bot | Ro'yxatdan o'tish, buyurtma bildirishnomalari |
| Loyalty | Mijoz coin tizimi |

---

## Merchant oqimi

1. Admin do'kon yaratadi (`owner_phone` +998…)
2. Botda `/start shop_<uuid>` → telefon tasdiqlash
3. **CRM Panel** — mahsulot, buyurtma, chat, xarita
4. Mijoz saytda qidiradi → bron → do'konga keladi

---

## Konfiguratsiya

Bitta root `.env` — barcha servislar (Docker compose) shu fayldan o'qiydi.

| Fayl | Maqsad |
|------|--------|
| `.env.example` | Lokal development |
| `.env.production.example` | Production deploy |

```bash
cp .env.example .env              # dev
cp .env.production.example .env   # prod
```

---

## CI

GitHub Actions: frontend build, Playwright E2E, backend pytest, Alembic migratsiya, Docker prod build.

---

## License

Maintainer litsenziyasini qo'shguncha — repository default copyright.
