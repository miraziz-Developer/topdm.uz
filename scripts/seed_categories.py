#!/usr/bin/env python3
"""Bozorliii kategoriya katalogini bazaga yozish (idempotent)."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.application.merchant.category_seed_service import CategorySeedService
from app.infrastructure.db.session import AsyncSessionFactory


async def main() -> None:
    async with AsyncSessionFactory() as session:
        svc = CategorySeedService(session)
        stats = await svc.ensure_bazaar_catalog()
    print(
        f"Kategoriyalar tayyor: jami {stats['total']}, "
        f"yangi root {stats['created_roots']}, yangi sub {stats['created_subs']}"
    )


if __name__ == "__main__":
    asyncio.run(main())
