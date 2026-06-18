#!/usr/bin/env bash
# Backend konteynerida vizual re-embed (CLIP allaqachon yuklangan — Celery OOM emas).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f docker-compose.prod.yml)
BATCH="${REEMBED_BATCH:-40}"
MAX_BATCHES="${REEMBED_MAX_BATCHES:-50}"

cd "$ROOT"

for ((i = 0; i < MAX_BATCHES; i++)); do
  offset=$((i * BATCH))
  echo "== reembed batch offset=$offset limit=$BATCH =="
  if ! "${COMPOSE[@]}" exec -T backend python /app/scripts/reembed_products.py \
    --visual-only --limit "$BATCH" --offset "$offset"; then
    echo "reembed batch failed at offset=$offset" >&2
    exit 1
  fi
  processed=$("${COMPOSE[@]}" exec -T backend python -c "
from sqlalchemy import create_async_engine, select, func
import asyncio, os
from app.infrastructure.db.models import ProductModel
async def c():
    e = create_async_engine(os.environ['DATABASE_URL'].replace('postgresql://','postgresql+asyncpg://'))
    async with e.connect() as conn:
        r = await conn.execute(select(func.count()).select_from(ProductModel))
        total = r.scalar() or 0
    await e.dispose()
    print(total)
asyncio.run(c())
" 2>/dev/null || echo "0")
  next_offset=$((offset + BATCH))
  if [[ "$next_offset" -ge "$processed" ]]; then
    echo "reembed complete (catalog size ~$processed)"
    break
  fi
done
