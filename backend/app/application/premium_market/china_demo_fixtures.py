"""BTS / investor demo — Taobao API bo'lmasa ham vitrina ishlaydi (PREMIUM_CHINA_DEMO_MODE=true)."""

from __future__ import annotations

from app.application.premium_market.pricing import calculate_china_total
from app.core.config import Settings
from app.schemas.premium_market import (
    AutoSearchItem,
    ChinaCatalogItem,
    ChinaProductPayload,
    MarketAutoSearchResponse,
    MarketChinaCatalogResponse,
    MarketChinaResponse,
    SkuVariant,
)

_DEMO_ROWS: list[dict] = [
    {
        "item_id": "demo-erkak-shim",
        "title": "Erkaklar uchun klassik shim (Xitoy)",
        "image_url": "https://images.unsplash.com/photo-1473966968600-fa801b546d38?w=600&q=80",
        "base_price_cny": 89.0,
        "weight_kg": 0.6,
        "colors": ["Qora", "Ko'k"],
        "sizes": ["30", "32", "34", "36"],
    },
    {
        "item_id": "demo-qishki-kurtka",
        "title": "Qishki issiq kurtka — erkaklar",
        "image_url": "https://images.unsplash.com/photo-1551028711-21967cd2e2f9?w=600&q=80",
        "base_price_cny": 185.0,
        "weight_kg": 1.2,
        "colors": ["Qora", "Kulrang"],
        "sizes": ["M", "L", "XL", "XXL"],
    },
    {
        "item_id": "demo-krossovka",
        "title": "Sport krossovka — yengil",
        "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
        "base_price_cny": 72.0,
        "weight_kg": 0.8,
        "colors": ["Oq", "Qizil"],
        "sizes": ["40", "41", "42", "43", "44"],
    },
    {
        "item_id": "demo-hoodie",
        "title": "Hoodie — unisex, premium mato",
        "image_url": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80",
        "base_price_cny": 58.0,
        "weight_kg": 0.55,
        "colors": ["Qora", "Bej"],
        "sizes": ["S", "M", "L", "XL"],
    },
    {
        "item_id": "demo-sumka",
        "title": "Kundalik sumka — charm",
        "image_url": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80",
        "base_price_cny": 45.0,
        "weight_kg": 0.4,
        "colors": ["Jigarrang", "Qora"],
        "sizes": ["One size"],
    },
    {
        "item_id": "demo-palto",
        "title": "Uzun palto — ayollar",
        "image_url": "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600&q=80",
        "base_price_cny": 210.0,
        "weight_kg": 1.4,
        "colors": ["Camel", "Qora"],
        "sizes": ["S", "M", "L"],
    },
    {
        "item_id": "demo-futbolka",
        "title": "Paxta futbolka — 3 dona to'plam",
        "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80",
        "base_price_cny": 35.0,
        "weight_kg": 0.35,
        "colors": ["Oq", "Qora", "Kulrang"],
        "sizes": ["M", "L", "XL"],
    },
    {
        "item_id": "demo-soat",
        "title": "Zamonaviy soat — erkaklar aksessuar",
        "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
        "base_price_cny": 28.0,
        "weight_kg": 0.2,
        "colors": ["Kumush", "Qora"],
        "sizes": ["One size"],
    },
]


def _pricing(settings: Settings, *, cny: float, weight_kg: float):
    return calculate_china_total(settings, base_price_cny=cny, weight_kg=weight_kg)


def _filter_by_query(query: str) -> list[dict]:
    q = (query or "").strip().lower()
    if not q:
        return list(_DEMO_ROWS)
    tokens = [t for t in q.replace(",", " ").split() if len(t) > 1]
    if not tokens:
        return list(_DEMO_ROWS)
    out: list[dict] = []
    for row in _DEMO_ROWS:
        title = row["title"].lower()
        if any(t in title for t in tokens):
            out.append(row)
    return out or list(_DEMO_ROWS)[:4]


def demo_auto_search(settings: Settings, query: str, page: int = 1) -> MarketAutoSearchResponse:
    rows = _filter_by_query(query)
    page_num = max(1, int(page))
    page_size = 8
    start = (page_num - 1) * page_size
    chunk = rows[start : start + page_size]
    items: list[AutoSearchItem] = []
    for row in chunk:
        pricing = _pricing(settings, cny=row["base_price_cny"], weight_kg=row["weight_kg"])
        items.append(
            AutoSearchItem(
                item_id=row["item_id"],
                title=row["title"],
                image_url=row["image_url"],
                price_cny=row["base_price_cny"],
                total_price_uzs=int(pricing.total_price_uzs),
                source_url=None,
            )
        )
    translated = query.strip() or "demo"
    return MarketAutoSearchResponse(
        query=query.strip() or "demo",
        translated_query=f"{translated} (demo vitrina)",
        page=page_num,
        items=items,
    )


def demo_catalog(settings: Settings) -> MarketChinaCatalogResponse:
    items: list[ChinaCatalogItem] = []
    for row in _DEMO_ROWS[:6]:
        pricing = _pricing(settings, cny=row["base_price_cny"], weight_kg=row["weight_kg"])
        items.append(
            ChinaCatalogItem(
                item_id=row["item_id"],
                title=row["title"],
                image_url=row["image_url"],
                total_price_uzs=int(pricing.total_price_uzs),
                base_price_cny=row["base_price_cny"],
                source_url=None,
            )
        )
    return MarketChinaCatalogResponse(items=items, errors=[])


def demo_product(settings: Settings, item_id: str) -> MarketChinaResponse | None:
    row = next((r for r in _DEMO_ROWS if r["item_id"] == item_id), None)
    if not row:
        return None
    pricing = _pricing(settings, cny=row["base_price_cny"], weight_kg=row["weight_kg"])
    skus = [
        SkuVariant(
            sku_id=f"{row['item_id']}-{c}-{s}",
            color=c,
            size=s,
            price_cny=row["base_price_cny"],
            stock=50,
            image_url=row["image_url"],
        )
        for c in row["colors"][:2]
        for s in row["sizes"][:2]
    ]
    item = ChinaProductPayload(
        item_id=row["item_id"],
        title=row["title"],
        images=[row["image_url"]],
        description="Demo vitrina — BTS uchrashuvi uchun. Taobao API ulangach haqiqiy ma'lumot keladi.",
        colors=row["colors"],
        sizes=row["sizes"],
        skus=skus,
        weight_kg=row["weight_kg"],
        base_price_cny=row["base_price_cny"],
        pricing=pricing,
        source_url=None,
    )
    return MarketChinaResponse(item=item)
