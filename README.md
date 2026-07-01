# Bozorliii.uz

[![CI](https://github.com/miraziz-Developer/topdm.uz/actions/workflows/ci.yml/badge.svg)](https://github.com/miraziz-Developer/topdm.uz/actions/workflows/ci.yml)

**AI-powered mahalliy bozor marketplace** — kiyim-kechak katalogi, vizual qidiruv, onlayn bron, xarita navigatsiyasi, merchant CRM va Telegram bot.

| | |
|---|---|
| **Live do'kon** | https://bozorliii.online |
| **Merchant CRM** | https://crm.bozorliii.online |
| **API** | https://api.bozorliii.online/health |

> HR / biznes ko'rinishi: [docs/EXECUTIVE_SUMMARY.md](docs/EXECUTIVE_SUMMARY.md)  
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

**To'lov:** Click, Payme. **Logistika:** BTS Express.

---

## Loyiha tuzilmasi

```
├── backend/              # FastAPI API + bot + Celery
├── frontend/             # Mijoz Next.js PWA
├── merchant-crm/         # Sotuvchi panel
├── merchant-crm-mobile/  # Android (Capacitor)
├── brand/                # Brend manba PNG
├── deploy/nginx/         # Production reverse proxy
├── scripts/              # Deploy va ops
├── docs/                 # Hujjatlar
├── docker-compose.yml
└── docker-compose.prod.yml
```

Har bir ilovada `README.md`. To'liq xarita: [docs/STRUCTURE.md](docs/STRUCTURE.md).

---

## Tez boshlash

```bash
git clone https://github.com/miraziz-Developer/topdm.uz.git bozorliii
cd bozorliii
cp .env.example .env
docker compose up -d --build
```

| URL | |
|-----|---|
| Do'kon | http://localhost:3002 |
| CRM | http://localhost:3003 |
| API | http://localhost:8000/health |

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

## Konfiguratsiya

Bitta root `.env` — barcha servislar shu fayldan o'qiydi.

| Fayl | Maqsad |
|------|--------|
| `.env.example` | Lokal development |
| `.env.production.example` | Production deploy |

```bash
cp .env.example .env
```

---

## CI / sifat

GitHub Actions: frontend build, Playwright E2E, backend pytest (30+ test), Alembic migratsiya, production Docker build.

---

## License

Proprietary — [LICENSE](LICENSE) (Bozorliii © 2026).
