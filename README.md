# Topdim.UZ

**Topdim.UZ** is the GitHub home for a hyper-personalized AI marketplace platform (internally branded **Bozor-AI Engine**). The goal is not only product discovery but also a digital “brain” for bazaars: semantic search over large catalogs, AI-assisted styling (“lookbooks”), merchant tooling, and trackable leads between shoppers and shops.

This repository contains a **production-oriented monorepo**: a FastAPI backend with Clean Architecture / DDD-style layering, PostgreSQL + **pgvector** for embeddings, Redis for caching and rate limits, and a **Next.js 14** frontend (App Router) suitable for Telegram Web App and modern web clients.

---

## What This Project Does

| Area | Description |
|------|-------------|
| **Semantic search** | Products store a **1536-dimensional** embedding; similarity uses pgvector (cosine distance) with HNSW indexing where migrations define it. |
| **AI stylist** | Text flows through LLM-backed intent + look composition (Groq for fast text; optional Gemini for vision when configured). |
| **Marketplace core** | Shops, categories, ipadroms (market locations), products, leads, tracking events, and a simple shop dashboard API. |
| **Leads & tracking** | Customers can express interest (“book” / lead); events can be recorded for analytics. Optional Telegram notifications for shop owners. |
| **Auth (Telegram OTP + JWT)** | Free unlimited OTP via Telegram bot (`/auth/send-otp`, `/auth/verify-otp`); JWT for API access. |

---

## Repository Layout

```
Topdim.UZ/
├── backend/                 # FastAPI application (Python 3.11+)
│   ├── app/
│   │   ├── domain/          # Entities, value objects, repository contracts
│   │   ├── application/     # Use cases (marketplace, stylist, inventory, …)
│   │   ├── infrastructure/ # DB, Redis, AI clients, email, Telegram, auth
│   │   └── interfaces/     # HTTP API (FastAPI), middlewares
│   ├── migrations/          # Alembic migrations (pgvector, core tables)
│   └── pyproject.toml
├── frontend/                # Next.js 14 + Tailwind + React Query + Zustand
├── merchant-crm/            # Merchant dashboard (Next.js)
├── scripts/                 # e.g. database seeding utilities
├── deploy/                  # Caddyfile + production runbook
├── docker-compose.yml       # Local dev stack (Mailpit, hot reload)
├── docker-compose.prod.yml  # Production stack (TLS, prod builds)
├── .env.production.example  # Production env template
└── README.md
```

---

## Tech Stack

- **Backend:** FastAPI, Pydantic v2, SQLAlchemy 2 (async), Alembic, asyncpg  
- **Database:** PostgreSQL 16 with **pgvector** extension  
- **Cache:** Redis (sessions, semantic cache hooks, OTP storage, rate limiting)  
- **AI:** Groq (text + optional vision fallback), Google Generative AI (Gemini) when `GOOGLE_API_KEY` is set  
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, Framer Motion, TanStack Query, Zustand  

---

## Prerequisites

- **Docker Desktop** (or Docker Engine + Compose) for the full stack, **or** local Postgres with pgvector + Redis  
- **Python 3.11+** (recommended; avoid mixing with unsupported preview versions in production)  
- **Node.js 20+** and npm for the frontend  

---

## Quick Start (Docker Compose)

1. **Clone the repository**

   ```bash
   git clone https://github.com/<your-org>/topdim.uz.git
   cd topdim.uz
   ```

2. **Environment**

   Copy and edit root `.env` (Compose reads it for `backend` / `frontend`). At minimum, mirror variables from `backend/.env.example` and set secrets (`GROQ_API_KEY`, optional `GOOGLE_API_KEY`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, SMTP for production email when not using Mailpit).

3. **Start services**

   ```bash
   docker compose up -d --build
   ```

4. **Database migrations** run automatically on backend container start (`docker-entrypoint.sh`). To run manually:

   ```bash
   cd backend
   alembic upgrade head
   ```

5. **Seed demo data** (optional)

   ```bash
   cd ..
   python scripts/seed.py
   ```

6. **URLs (default Compose)**

   - API: `http://localhost:8000`  
   - API docs: `http://localhost:8000/docs` (only when `APP_DEBUG=true`)  
   - Health: `http://localhost:8000/api/v1/health`  
   - Mailpit (dev email): `http://localhost:8025`  
   - Frontend: `http://localhost:3002` (`FRONTEND_PORT`, default 3002)  
   - Merchant CRM: `http://localhost:3003` (`MERCHANT_CRM_PORT`, default 3003)  
   - Merchant Telegram bot: `docker compose up merchant-bot -d` (requires `TELEGRAM_BOT_TOKEN`)  

---

## Production deployment

Use the **production Compose stack** with Nginx TLS (`nginx/production.conf`), multi-worker API, production Next.js builds, and no Mailpit.

**Serverga qo‘yish (to‘liq):** [docs/DEPLOY_SERVER.md](docs/DEPLOY_SERVER.md) · [docs/PRODUCTION_READY.md](docs/PRODUCTION_READY.md)

Click/Payme buyurtma to‘lovi yoqiladi: `.env` da `ENABLE_ONLINE_CHECKOUT=true` va `NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT=true` (+ `CLICK_*` / `PAYME_*` kalitlar).

1. `cp .env.production.example .env` — barcha secretlar (DB, JWT, Telegram, Resend, Yandex, Groq).
2. DNS: `topdim.uz`, `api.topdim.uz`, `crm.topdim.uz`.
3. Preflight + deploy + smoke:

   ```bash
   ./scripts/preflight-deploy.sh
   docker compose -f docker-compose.prod.yml up -d --build
   ./scripts/smoke-all.sh https://topdim.uz https://crm.topdim.uz https://api.topdim.uz
   ```

Full runbook: **[deploy/README.md](deploy/README.md)**.

Production checklist:

| Item | Requirement |
|------|-------------|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `JWT_SECRET` | ≥ 32 random characters |
| `CORS_ORIGINS` | Your HTTPS site URLs |
| `SMTP_*` | Real provider (not `mailpit`) |
| `ADMIN_API_KEY` | Set for admin routes |
| Media | Prefer `s3` or `supabase` |
| TLS | Caddy on ports 80/443 |

---

## Local Development (without full Docker rebuild)

**Backend**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ./backend
cd backend && alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run `uvicorn` from the `backend/` directory (where `app/` lives).

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Use the same-origin proxy (recommended for HttpOnly cookie auth):

```bash
# frontend/.env.local or repo root .env
NEXT_PUBLIC_API_BASE_URL=/api/v1
BACKEND_API_URL=http://127.0.0.1:8000
```

Do **not** point the browser at `http://127.0.0.1:8000/api/v1` directly — login/session cookies are set on the Next.js origin only.

---

## Configuration Highlights

See **`backend/.env.example`** for the full list. Important groups:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` / Postgres vars | Async SQLAlchemy connection |
| `REDIS_URL` | Cache, OTP, rate limits |
| `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_VISION_MODEL` | LLM text / vision fallback |
| `GOOGLE_API_KEY`, `GEMINI_MODEL` | Primary vision path when enabled |
| `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXP_MINUTES` | Access tokens after OTP verify |
| `TELEGRAM_BOT_TOKEN` | Lead notifications + merchant bot |
| `MEDIA_STORAGE_BACKEND` | `local`, `supabase`, or `s3` for product images |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Storage uploads when backend is `supabase` |
| `S3_*` | S3-compatible object storage (Cloudflare R2, MinIO, AWS) |
| `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USE_TLS`, `SMTP_USE_SSL`, `MAIL_FROM`, `MAIL_USERNAME`, `MAIL_PASSWORD` | Email OTP (Mailpit in Docker dev, or real SMTP in production) |

### Real email (production)

- Set **`APP_DEBUG=false`** so OTP is never returned in JSON responses.
- In **`.env`**, configure your provider (SPF/DKIM on the sending domain recommended):
  - **SendGrid:** `SMTP_SERVER=smtp.sendgrid.net`, `SMTP_PORT=587`, `SMTP_USE_TLS=true`, `MAIL_USERNAME=apikey`, `MAIL_PASSWORD=<API key>`, `MAIL_FROM=noreply@your-domain`.
  - **Gmail:** use an [App Password](https://support.google.com/accounts/answer/185833); `MAIL_FROM` and `MAIL_USERNAME` = your address; `SMTP_PORT=587`, `SMTP_USE_TLS=true`.
  - **Port 465 (implicit TLS):** `SMTP_USE_SSL=true`, `SMTP_USE_TLS=false`, `SMTP_PORT=465`.
- Docker Compose forwards these env vars into **`backend`** (defaults remain Mailpit-oriented). After changes: `docker compose up -d backend`.
- To hide the Mailpit banner on `/auth`, set **`NEXT_PUBLIC_MAILPIT_WEB_URL=`** empty in `.env` or unset it.

**Never commit real `.env` files or API keys.** This repo’s `.gitignore` excludes `.env` and `.venv/`.

---

## API Overview (prefix `/api/v1`)

Representative endpoints (names may evolve; always check OpenAPI at `/docs`):

- `GET /health` — database, Redis, and AI connectivity checks  
- `GET /categories`, `GET /ipadroms` — catalog metadata  
- `GET /products/search` — text search + pagination  
- `GET /products/{id}` — product detail (increments view counter)  
- `GET /products/{id}/similar` — vector similarity when embeddings exist  
- `POST /products`, `POST /leads`, `POST /tracking/events` — writes for marketplace flows  
- `GET /dashboard/shop/{shop_id}` — owner-oriented stats and recent leads  
- `POST /stylist/lookbook` — AI stylist / look composition  
- `POST /auth/email/send-otp`, `POST /auth/email/verify` — email OTP + JWT  
- `POST /auth/telegram` — Telegram Login + JWT  

---

## Architecture Notes

- **Clean Architecture / DDD-style separation:** domain rules stay independent of FastAPI and ORM details; application layer orchestrates use cases; infrastructure implements persistence and external APIs; `interfaces` exposes HTTP.  
- **Async-first:** database and I/O paths are designed for asyncio.  
- **Vectors:** product embeddings are first-class; HNSW and cosine ops are used for scalable similarity.  

---

## Contributing & License

Contributions are welcome via issues and pull requests. Add tests when changing business logic or API contracts.

If no `LICENSE` file is present in the repository yet, default copyright applies until the maintainers add an explicit license.

---

## Naming

- **GitHub repository name:** `topdim.uz` (URL-friendly).  
- **Product / platform name:** **Topdim.UZ** — discovery and AI-assisted commerce for markets like Ippodrom and future deployments.

For questions or deployment support, open an issue on this repository.
