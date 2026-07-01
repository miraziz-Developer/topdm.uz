# Backend

FastAPI monolith — marketplace API, merchant bot, Celery workers.

## Tuzilma

```
app/
├── interfaces/api/    # HTTP routes (*_routes.py)
├── application/       # Biznes logika
├── infrastructure/    # DB, Redis, S3, bot
├── domain/            # Domen interfeyslari
├── models/            # Qo‘shimcha ORM
├── schemas/           # Pydantic
├── services/          # AI stylist, inventory
└── ai/                # Agent pipeline
```

Batafsil: [docs/STRUCTURE.md](../docs/STRUCTURE.md)

## Ishga tushirish

```bash
# Root dan (tavsiya)
cp .env.example .env
docker compose up backend

# Yoki to‘g‘ridan-to‘g‘ri
cd backend && pip install -e ".[dev]"
uvicorn app.main:app --reload
```

## Test

```bash
pytest -q
```

## Migratsiya

```bash
alembic -c alembic.ini upgrade head
```
