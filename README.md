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
| **Auth (OTP + JWT)** | OTP can be sent via Eskiz (SMS); successful verification issues a JWT (see backend routes and env). |

---

## Repository Layout

```
Topdim.UZ/
├── backend/                 # FastAPI application (Python 3.11+)
│   ├── app/
│   │   ├── domain/          # Entities, value objects, repository contracts
│   │   ├── application/     # Use cases (marketplace, stylist, inventory, …)
│   │   ├── infrastructure/ # DB, Redis, AI clients, SMS, Telegram, auth
│   │   └── interfaces/     # HTTP API (FastAPI), middlewares
│   ├── migrations/          # Alembic migrations (pgvector, core tables)
│   └── pyproject.toml
├── frontend/                # Next.js 14 + Tailwind + React Query + Zustand
├── scripts/                 # e.g. database seeding utilities
├── docker-compose.yml       # Local Postgres (pgvector), Redis, backend, frontend
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

   Copy and edit root `.env` (Compose reads it for `backend` / `frontend`). At minimum, mirror variables from `backend/.env.example` and set secrets (`GROQ_API_KEY`, optional `GOOGLE_API_KEY`, `JWT_SECRET`, SMS/Telegram keys as needed).

3. **Start services**

   ```bash
   docker compose up -d --build
   ```

4. **Database migrations** (if you run the API outside Compose or need a fresh DB)

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
   - API docs: `http://localhost:8000/docs`  
   - Health: `http://localhost:8000/health`  
   - Frontend: `http://localhost:3000`  

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

Point the UI at your API, e.g. `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1` in `.env.local`.

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
| `TELEGRAM_BOT_TOKEN` | Optional lead notifications |
| `ESKIZ_LOGIN`, `ESKIZ_PASSWORD` | SMS OTP via Eskiz.uz |

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
- `POST /auth/otp/send`, `POST /auth/otp/verify` — OTP + JWT  

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
