# Loyiha tuzilmasi

Monorepo — bitta repository, bir nechta mustaqil ilova. Har bir papka o‘z vazifasiga ega.

```
Topdim.UZ/
├── backend/                 # API server (Python / FastAPI)
├── frontend/                # Mijoz web (Next.js PWA)
├── merchant-crm/            # Sotuvchi panel (Next.js)
├── merchant-crm-mobile/     # Android ilova (Capacitor)
├── brand/                   # Brend manba fayllari (PNG)
├── deploy/                  # Production infra (nginx, SSL, server)
├── scripts/                 # Deploy va ops skriptlar
├── docs/                    # Hujjatlar
├── .env.example             # Dev konfiguratsiya (bitta fayl)
├── .env.production.example  # Prod konfiguratsiya
├── docker-compose.yml       # Lokal dev stack
└── docker-compose.prod.yml  # Production stack
```

---

## Backend (`backend/`)

```
backend/
├── app/
│   ├── main.py              # FastAPI entrypoint
│   ├── core/                # Config, logging, security, phone utils
│   ├── interfaces/          # Tashqi dunyo (HTTP, WS, admin)
│   │   ├── api/             # REST route modullari (*_routes.py)
│   │   ├── ws/              # WebSocket
│   │   └── admin_panel/     # SQLAdmin
│   ├── application/         # Biznes logika (use-case, servis)
│   │   ├── marketplace/     # Mahsulot, buyurtma, feed
│   │   ├── merchant/        # Do‘kon, mahsulot, chat, QR
│   │   ├── billing/         # Obuna, coin, payout
│   │   ├── visual_search/   # Rasm bo‘yicha qidiruv
│   │   ├── delivery/        # BTS yetkazish
│   │   ├── loyalty/         # Mijoz coinlari
│   │   └── …                # Boshqa domenlar
│   ├── infrastructure/      # DB, Redis, S3, bot, Celery
│   │   ├── db/models.py     # Asosiy ORM modellari
│   │   ├── repositories/    # Ma’lumotlar qatlami
│   │   ├── bots/            # Telegram merchant bot
│   │   └── tasks/           # Celery background jobs
│   ├── domain/              # Domen interfeyslari va entity
│   ├── models/              # Qo‘shimcha ORM modellari (feature-specific)
│   ├── schemas/             # Pydantic request/response
│   ├── services/            # AI stylist, inventory, dispatcher
│   └── ai/                  # Stylist agent, wardrobe, intent
├── migrations/              # Alembic DB migratsiyalar
├── tests/                   # pytest
├── uploads/                 # Lokal media (prod: S3)
├── Dockerfile               # Dev image
└── Dockerfile.prod          # Production image
```

**Qoida:** `interfaces` → `application` → `infrastructure`. Route fayllar faqat `interfaces/api/` da.

| Eski (o‘chirilgan) | Yangi |
|--------------------|-------|
| `app/api/` | `app/interfaces/api/*_routes.py` |
| `backend/src/` | — (bo‘sh legacy) |
| `nginx/` (root) | `deploy/nginx/` |

---

## Frontend (`frontend/`)

Next.js App Router — ikki qavat:

```
frontend/
├── app/                     # Sahifalar va route’lar (URL)
│   ├── page.tsx             # Bosh sahifa
│   ├── product/[id]/        # Mahsulot
│   ├── checkout/            # Bron
│   ├── orders/              # Buyurtmalar
│   └── api/                 # Next.js API proxy
├── src/
│   ├── components/          # UI komponentlar (domain bo‘yicha)
│   ├── hooks/               # React hooks
│   ├── lib/                 # API client, utils
│   ├── stores/              # Zustand state
│   └── types/               # TypeScript tiplar
└── public/                  # Static (brand, PWA, sw.js)
```

Import: `@/components/...` → `src/components/...`

---

## Merchant CRM (`merchant-crm/`)

Frontend bilan bir xil pattern:

```
merchant-crm/
├── app/                     # Dashboard sahifalari
│   ├── dashboard/           # orders, products, chat, …
│   ├── login/
│   └── scan/                # QR skaner
├── src/
│   ├── components/
│   ├── hooks/
│   └── lib/
└── public/
```

---

## Brand aktivlari

```
brand/assets/          # Manba (master PNG)
    ↓ sync-brand-assets.sh
frontend/public/brand/
merchant-crm/public/brand/
```

Brendni o‘zgartirish: `brand/assets/` → `make sync-brand`

---

## Deploy (`deploy/`)

```
deploy/
├── nginx/               # Production reverse proxy
│   ├── Dockerfile
│   └── production.conf
├── ssl/                 # TLS sertifikatlar (gitda yo‘q)
├── bootstrap-ssl.sh     # Let's Encrypt
├── check-dns.sh
└── install-docker.sh
```

---

## Scripts (`scripts/`)

Faqat operatsion vazifalar. Ro‘yxat: [scripts/README.md](../scripts/README.md)

---

## Konfiguratsiya

| Fayl | Qayerda ishlatiladi |
|------|---------------------|
| `.env` | Docker compose — barcha servislar |
| `.env.example` | Dev shablon |
| `.env.production.example` | Prod shablon + CI |

Alohida `backend/.env` yoki `frontend/.env` **kerak emas**.

Batafsil biznes ko'rinishi: [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)
