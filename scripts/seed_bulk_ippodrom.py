#!/usr/bin/env python3
"""
Ippodrom / Abu Sahiy / Kozgalovka uchun ko'p mahsulot to'ldirish.
Pinterest scrap emas — Unsplash (qonuniy) + nom/rang mos rasmlar + vizual indeks.

Ishlatish:
  docker compose exec backend python /app/scripts/seed_bulk_ippodrom.py
  docker compose exec backend python /app/scripts/seed_bulk_ippodrom.py --reembed
  docker compose exec backend python /app/scripts/seed_bulk_ippodrom.py --target 250
"""
from __future__ import annotations

import argparse
import asyncio
import os
import random
import sys
import uuid

from sqlalchemy import select

random.seed(42)


def _bootstrap() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("backend app topilmadi")


_bootstrap()
sys.path.insert(0, os.path.dirname(__file__))

from catalog_images import pick_catalog_image
from seed import make_product_embedding

from app.core.config import get_settings
from app.infrastructure.db.models import CategoryModel, ProductModel, ShopModel
from app.infrastructure.db.session import AsyncSessionFactory

# (sub_category_name_contains, templates)
# template: (name_fmt, desc_fmt, price_min, price_max, sale_type, min_qty, material, color, slot_hint)
CATALOG_TEMPLATES: list[tuple[str, list[tuple]]] = [
    (
        "Bahoriy",
        [
            ("{g} yengil kurtka {c}", "Bahoriy kolleksiya, {m}", 280_000, 520_000, "Chakana", 1, "paxta-aralash", None, "kurtka"),
            ("{g} palto {c}", "Yengil palto, {m}", 450_000, 890_000, "Chakana", 1, "paxta", None, "kurtka"),
            ("{g} blazer {c}", "Ofis va to'y, {m}", 320_000, 680_000, "Chakana", 1, "paxta-aralash", None, "kurtka"),
        ],
    ),
    (
        "Sport",
        [
            ("{g} sport majmua {c}", "Sviter + shim, {m}", 350_000, 580_000, "Chakana", 1, "poliester", "sariq", "sport"),
            ("{g} sport krossovka {c}", "Kundalik yugurish, {m}", 180_000, 420_000, "Chakana", 1, "sintetika", None, "poyabzal"),
            ("{g} sport kostyum {c}", "Ikki parcha, {m}", 480_000, 720_000, "Chakana", 1, "poliester", "qora", "sport"),
            ("Sport majmua optom (10 dona)", "Seriya, aralash o'lcham", 2_800_000, 3_600_000, "Optom", 10, "poliester", None, "sport"),
        ],
    ),
    (
        "Sarpo",
        [
            ("Kelin sarpo {c} (6m)", "Atlas-saten, to'y", 1_200_000, 2_400_000, "Chakana", 1, "atlas", "qizil", "libos"),
            ("Kechki libos {c}", "Atlas, {m}", 550_000, 1_100_000, "Chakana", 1, "atlas", None, "libos"),
            ("Sarpo gazmol {c} (rulon)", "Turk import, {m}", 3_800_000, 6_500_000, "Optom", 5, "atlas", None, "mato"),
        ],
    ),
    (
        "premium",
        [
            ("Turkiya charm {g} tufli {c}", "Klassik, 40–44", 750_000, 1_200_000, "Chakana", 1, "charm", "qora", "poyabzal"),
            ("{g} lofer tufli {c}", "Ofis uslubi, {m}", 420_000, 890_000, "Chakana", 1, "charm", "jigarrang", "poyabzal"),
            ("Poyabzal optom (12 juft)", "Turkiya import", 4_200_000, 6_800_000, "Optom", 12, "charm", None, "poyabzal"),
        ],
    ),
    (
        "klassik",
        [
            ("{g} klassik ko'ylak {c}", "Oq va rangli, {m}", 120_000, 220_000, "Chakana", 1, "paxta", "oq", "koylak"),
            ("{g} futbolka {c}", "Paxta 100%, {m}", 65_000, 120_000, "Chakana", 1, "paxta", None, "koylak"),
            ("Ulgurji ko'ylak (12 dona)", "Ofis seriyasi", 1_400_000, 2_100_000, "Optom", 12, "paxta", None, "koylak"),
        ],
    ),
    (
        "Bolalar",
        [
            ("Bolalar {c} sport krossovka", "28–35 o'lcham", 140_000, 260_000, "Chakana", 1, "sintetika", None, "poyabzal"),
            ("Bolalar maktab formasi", "1–4 sinf to'liq", 165_000, 240_000, "Chakana", 1, "paxta", None, "bolalar"),
            ("Bolalar kundalik kostyum", "6–12 yosh seriya", 890_000, 1_400_000, "Optom", 8, "paxta", None, "bolalar"),
        ],
    ),
    (
        "Dubay",
        [
            ("Dubay atir {brand}", "Ereda parfyum, 100ml", 280_000, 520_000, "Chakana", 1, None, None, "atir"),
            ("Atir optom (12 dona)", "Lattafa / Armaf aralash", 2_100_000, 3_200_000, "Optom", 12, None, None, "atir"),
        ],
    ),
    (
        "Pardabop",
        [
            ("Pardabop mato {c} (rulon)", "Blackout, uy uchun", 380_000, 620_000, "Optom", 10, "poliester", None, "mato"),
            ("Uy tekstili ko'rpa", "Ikki kishilik", 420_000, 780_000, "Chakana", 1, "paxta", None, "mato"),
        ],
    ),
    (
        "Sumka",
        [
            ("Charm sumka {c}", "Kundalik, {m}", 195_000, 420_000, "Chakana", 1, "charm", None, "sumka"),
            ("{g} sumka {c}", "Premium, {m}", 240_000, 550_000, "Chakana", 1, "charm", "qora", "sumka"),
        ],
    ),
    (
        "Soat",
        [
            ("Klassik soat {c}", "Erkak qo'l soati", 180_000, 450_000, "Chakana", 1, None, None, "soat"),
        ],
    ),
]

# Har bir shim/kamar/kurtka varianti — vizual qidiruv uchun ko'p
EXTRA_SHIM = [
    ("{g} jinsi shim {c}", "Slim fit, {m}", 220_000, 380_000, "charm", "denim"),
    ("{g} jinsi shim qora", "Klassik fit", 240_000, 360_000, "qora", "denim"),
    ("{g} jinsi shim ko'k", "To'q ko'k denim", 250_000, 390_000, "ko'k", "denim"),
    ("{g} chino shim {c}", "Ofis, {m}", 200_000, 340_000, "bej", "paxta"),
]
EXTRA_KURTKA = [
    ("{g} kostyum kurtka {c}", "Klassik, {m}", 980_000, 1_650_000, "ko'k", "paxta-aralash"),
    ("{g} kostyum kurtka qora", "Ikki tugmali", 1_050_000, 1_800_000, "qora", "paxta-aralash"),
    ("{g} kurtka {c}", "Demisezon, {m}", 380_000, 720_000, None, "paxta"),
]
EXTRA_KAMAR = [
    ("{g} charm kamar {c}", "Klassik tok, {m}", 75_000, 140_000, "jigarrang", "charm"),
    ("{g} kamar qora", "Ofis kamar", 65_000, 120_000, "qora", "charm"),
    ("{g} belbog {c}", "Keng, {m}", 55_000, 95_000, "qora", "charm"),
]
EXTRA_KOYLAK = [
    ("{g} ko'ylak oq", "Paxta 100%", 130_000, 195_000, "oq", "paxta"),
    ("{g} ko'ylak ko'k", "Ofis rang", 125_000, 185_000, "ko'k", "paxta"),
    ("{g} sviter {c}", "Qishki, {m}", 180_000, 320_000, None, "paxta"),
]

COLORS = ("qora", "oq", "ko'k", "sariq", "qizil", "bej", "kulrang", "jigarrang")
GENDERS = ("Erkak", "Ayol", "Bolalar")
GENDER_UZ = {"Erkak": "erkak", "Ayol": "ayol", "Bolalar": "bolalar"}
MATERIALS = ("paxta", "poliester", "charm", "denim", "atlas", "sintetika")


def _expand_templates(target: int) -> list[dict]:
    rows: list[dict] = []

    counter = 0

    def add(name: str, desc: str, pmin: int, pmax: int, sale: str, min_q: int, color: str | None, material: str | None, sub_hint: str):
        nonlocal counter
        counter += 1
        g = random.choice(GENDERS)
        c = color or random.choice(COLORS)
        m = material or random.choice(MATERIALS)
        price = random.randint(pmin // 1000, pmax // 1000) * 1000
        final_name = (
            name.format(g=g, c=c, m=m, brand=random.choice(("Lattafa", "Armaf", "Rasasi")))
            + f" ·{counter:04d}"
        )
        rows.append(
            {
                "name": final_name,
                "desc": desc.format(g=g, c=c, m=m),
                "price": price,
                "sale_type": sale,
                "min_qty": min_q,
                "color": c,
                "material": m,
                "sub_hint": sub_hint,
                "gender": GENDER_UZ.get(g, "erkak"),
            }
        )

    for sub_hint, templates in CATALOG_TEMPLATES:
        for tpl in templates:
            if len(rows) >= target:
                return rows
            name, desc, pmin, pmax, sale, min_q, mat, col, hint = tpl
            add(name, desc, pmin, pmax, sale, min_q, col, mat or random.choice(MATERIALS), hint or sub_hint)

    extras = [
        (EXTRA_SHIM, "shim", "Bahoriy"),
        (EXTRA_KURTKA, "kurtka", "Bahoriy"),
        (EXTRA_KAMAR, "kamar", "Sumka"),
        (EXTRA_KOYLAK, "koylak", "klassik"),
    ]
    while len(rows) < target:
        for pool, hint, sub in extras:
            for name, desc, pmin, pmax, col, mat in pool:
                if len(rows) >= target:
                    break
                add(name, desc, pmin, pmax, "Chakana", 1, col, mat, hint)
        # Poyabzal / libos variantlari
        add(
            "{g} krossovka {c}",
            "Kundalik, {m}",
            160_000,
            480_000,
            "Chakana",
            1,
            random.choice(COLORS),
            "sintetika",
            "poyabzal",
        )
        add(
            "{g} kechki libos {c}",
            "Bayram uchun, {m}",
            420_000,
            980_000,
            "Chakana",
            1,
            "qizil",
            "atlas",
            "libos",
        )

    return rows[:target]


def _match_subcategory(sub_name: str, hint: str) -> bool:
    h = hint.lower()
    s = sub_name.lower()
    if h in s or s in h:
        return True
    keys = ("bahoriy", "sport", "sarpo", "premium", "klassik", "bolalar", "dubay", "pardabop", "sumka", "soat", "kundalik")
    for k in keys:
        if k in h and k in s:
            return True
    if hint in ("shim", "kurtka", "koylak", "poyabzal", "kamar", "libos", "mato", "atir", "sport", "bolalar", "soat", "sumka"):
        if hint == "koylak" and ("ko'ylak" in s or "ustki" in s or "klassik" in s.lower()):
            return True
        if hint == "poyabzal" and ("poyabzal" in s or "premium" in s or "bolalar" in s):
            return True
        if hint == "kurtka" and ("bahoriy" in s or "kuzgi" in s or "ustki" in s):
            return True
        if hint == "shim" and ("bahoriy" in s or "kuzgi" in s or "ustki" in s):
            return True
        if hint == "kamar" and ("sumka" in s or "belbog" in s):
            return True
    return False


async def _load_taxonomy(db):
    shops = (await db.execute(select(ShopModel).where(ShopModel.is_active == True))).scalars().all()  # noqa: E712
    if not shops:
        raise RuntimeError("Do'kon yo'q — avval: python scripts/seed.py")

    cats = (await db.execute(select(CategoryModel))).scalars().all()
    roots = {c.id: c for c in cats if c.parent_id is None}
    subs: list[CategoryModel] = [c for c in cats if c.parent_id is not None]

    by_root: dict[str, list[CategoryModel]] = {}
    for sub in subs:
        root = roots.get(sub.parent_id)
        if root:
            by_root.setdefault(root.name, []).append(sub)

    return shops, subs, by_root


def _pick_category(subs: list[CategoryModel], by_root: dict, hint: str) -> CategoryModel:
    for sub in subs:
        if _match_subcategory(sub.name, hint):
            return sub
    # fallback: random sub
    if subs:
        return random.choice(subs)
    raise RuntimeError("Sub-kategoriya topilmadi")


async def seed_bulk(target: int, *, skip_existing_names: bool = True) -> int:
    rows = _expand_templates(target)
    added = 0
    skipped = 0

    async with AsyncSessionFactory() as db:
        shops, subs, by_root = await _load_taxonomy(db)
        existing_names: set[str] = set()
        if skip_existing_names:
            res = await db.execute(select(ProductModel.name))
            existing_names = {n for (n,) in res.all()}

        for i, row in enumerate(rows):
            if row["name"] in existing_names:
                skipped += 1
                continue

            shop = shops[i % len(shops)]
            cat = _pick_category(subs, by_root, row["sub_hint"])
            root_name = next((r for r, children in by_root.items() if cat in children), "Kiyim-kechak & Moda")
            sub_name = cat.name
            attrs = {
                "color": row["color"],
                "material": row["material"],
                "gender": row["gender"],
                "root_category": root_name,
                "sub_category": sub_name,
                "category": sub_name,
                "market_zone": shop.market_zone or "Ippodrom",
                "block_sector": shop.block_sector or "",
                "location": shop.location_comment or "",
                "floor": shop.floor or "",
                "shop_number": shop.section or "",
                "sale_type": row["sale_type"],
            }
            img = pick_catalog_image(row["name"], row["desc"])
            product = ProductModel(
                shop_id=shop.id,
                category_id=cat.id,
                name=row["name"],
                description=row["desc"],
                price=row["price"],
                sale_type=row["sale_type"],
                min_order_quantity=row["min_qty"],
                images=[img],
                attributes=attrs,
                embedding=make_product_embedding(row["name"], row["desc"], attrs),
                is_available=True,
                is_featured=random.random() < 0.15,
                view_count=random.randint(20, 900),
                stock_count=random.randint(3, 40),
            )
            db.add(product)
            existing_names.add(row["name"])
            added += 1
            if added % 25 == 0:
                await db.flush()
                print(f"  … {added} ta qo'shildi")

        await db.commit()

    print(f"\n✅ Bulk seed: +{added} mahsulot | o'tkazildi (nom takrori): {skipped}")
    return added


def main() -> None:
    parser = argparse.ArgumentParser(description="Ippodrom bulk product catalog")
    parser.add_argument("--target", type=int, default=300, help="Qo'shiladigan mahsulotlar (default 300)")
    parser.add_argument("--reembed", action="store_true", help="Yuklangandan keyin visual indeks")
    args = parser.parse_args()

    get_settings()
    print(f"📦 Bulk katalog: ~{args.target} ta mahsulot (Unsplash + Ippodrom do'konlari)")
    added = asyncio.run(seed_bulk(args.target))
    if args.reembed and added > 0:
        print("🔄 Vizual indeks (Gemini) — biroz vaqt oladi…")
        import subprocess

        script = os.path.join(os.path.dirname(__file__), "reembed_products.py")
        subprocess.run([sys.executable, script], check=True)
        print("✅ Indeks tayyor — rasm qidiruvni sinang")


if __name__ == "__main__":
    main()
