"""Purge electronics / fake catalog from an existing database."""
from __future__ import annotations

import asyncio
import importlib.util
import os
import sys


def _bootstrap_import_path() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("Could not locate backend app package")


_bootstrap_import_path()

from app.core.config import get_settings  # noqa: E402


def _load_seed_module():
    path = os.path.join(os.path.dirname(__file__), "seed.py")
    spec = importlib.util.spec_from_file_location("bozor_seed", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


async def main() -> None:
    seed = _load_seed_module()
    settings = get_settings()
    print(f"Purging non-clothing catalog on {settings.async_database_url.split('@')[-1]}...")
    async with seed.SessionFactory() as db:
        await seed.purge_non_clothing(db)
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
