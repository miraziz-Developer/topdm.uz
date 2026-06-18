#!/usr/bin/env python3
"""Bozor hududlari (ipadroms) — Ippodrom, Abu Sahiy, Kozgalovka."""
from __future__ import annotations

import asyncio
import os
import sys


def _bootstrap() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("backend app topilmadi")


_bootstrap()
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select

from app.infrastructure.db.models import IpadromModel
from app.infrastructure.db.session import AsyncSessionFactory
from seed import IPADROMS


async def main() -> int:
    created = 0
    async with AsyncSessionFactory() as db:
        existing = {row.name: row for row in (await db.execute(select(IpadromModel))).scalars().all()}
        for data in IPADROMS:
            if data["name"] in existing:
                print(f"  ✓ {data['name']}")
                continue
            db.add(IpadromModel(**data))
            created += 1
            print(f"  + {data['name']}")
        await db.commit()
    print(f"ensure_market_zones: yangi={created}, jami={len(IPADROMS)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
