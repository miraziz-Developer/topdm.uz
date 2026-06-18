"""Kategoriya bo'yicha Unsplash rasmlar — nom, tavsif va attributes bilan mos."""

from __future__ import annotations

import hashlib
import re

# Har slot uchun turli rasm — CLIP vizual qidiruv uchun haqiqiy foto
IMAGE_POOLS: dict[str, tuple[str, ...]] = {
    "shim": (
        "https://images.unsplash.com/photo-1473966968600-fa801b546d38?w=600&q=80",
        "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&q=80",
        "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&q=80",
    ),
    "kurtka": (
        "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80",
        "https://images.unsplash.com/photo-1544022613-e87ca75d338e?w=600&q=80",
        "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600&q=80",
    ),
    "koylak": (
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80",
        "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&q=80",
        "https://images.unsplash.com/photo-1434389677669-641f78720c3e?w=600&q=80",
        "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600&q=80",
        "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&q=80",
    ),
    "poyabzal": (
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
        "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&q=80",
        "https://images.unsplash.com/photo-1460353581641-745b41e12a4f?w=600&q=80",
        "https://images.unsplash.com/photo-1595950653102-6c9ebd614d3a?w=600&q=80",
        "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&q=80",
    ),
    "kamar": (
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80",
        "https://images.unsplash.com/photo-1624222247344-550fb60583fd?w=600&q=80",
        "https://images.unsplash.com/photo-1584917865442-de89d76aad62?w=600&q=80",
    ),
    "sumka": (
        "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80",
        "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&q=80",
        "https://images.unsplash.com/photo-1584917865442-de89d76aad62?w=600&q=80",
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80",
    ),
    "libos": (
        "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80",
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80",
        "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80",
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80",
    ),
    "mato": (
        "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600&q=80",
        "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&q=80",
        "https://images.unsplash.com/photo-1615485925511-ef3c81a0e1e8?w=600&q=80",
    ),
    "atir": (
        "https://images.unsplash.com/photo-1541643600914-78b084683702?w=600&q=80",
        "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&q=80",
    ),
    "sport": (
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80",
    ),
    "bolalar": (
        "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&q=80",
        "https://images.unsplash.com/photo-1519233290459-e8b835a3e4d0?w=600&q=80",
    ),
    "soat": (
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
        "https://images.unsplash.com/photo-1524592094715-efdd4c45d968?w=600&q=80",
    ),
}

# Uzunroq iboralar avval — "kostyum kurtka" "kurtka" dan oldin
_HINT_TO_POOL: list[tuple[tuple[str, ...], str]] = [
    (("sport majmua", "sport kostyum", "sport krossovka"), "sport"),
    (("kostyum kurtka", "klassik kostyum kurtka"), "kurtka"),
    (("jinsi shim", "chino shim", "chino", "jinsi", "shim", "pantalon", "pant"), "shim"),
    (("yengil kurtka", "kurtka", "kostyum", "blazer", "palto", "jacket"), "kurtka"),
    (("ko'ylak", "koylak", "futbolka", "sviter", "polo", "shirt", "ustki"), "koylak"),
    (("krossovka", "tufli", "lofer", "poyabzal", "sandal", "bot", "oyoq", "kross"), "poyabzal"),
    (("belbog", "kamar", "belt"), "kamar"),
    (("sumka", "chelak", "ryukzak", "portfel"), "sumka"),
    (("kelin sarpo", "sarpo", "kechki libos", "libos", "platye", "kechki", "dress"), "libos"),
    (("pardabop", "gazmol", "ko'rpa", "tekstil", "mato", "rulon", "to'qimachilik"), "mato"),
    (("dubay atir", "atir", "parfyum", "lattafa", "armaf", "kosmetika"), "atir"),
    (("maktab formasi", "bolalar", "forma"), "bolalar"),
    (("klassik soat", "qo'l soati", "soat", "watch"), "soat"),
]

_SUB_CATEGORY_POOL: list[tuple[tuple[str, ...], str]] = [
    (("poyabzal", "tufli", "oyoq"), "poyabzal"),
    (("ko'ylak", "koylak", "klassik"), "koylak"),
    (("bahoriy", "kuzgi", "ustki"), "kurtka"),
    (("sport",), "sport"),
    (("sarpo", "libos"), "libos"),
    (("dubay", "atir"), "atir"),
    (("pardabop", "tekstil"), "mato"),
    (("sumka", "aksessuar"), "sumka"),
    (("soat",), "soat"),
    (("bolalar",), "bolalar"),
]

# Eski seed round-robin / noto'g'ri default rasmlar
_LEGACY_MISMATCH_URLS: frozenset[str] = frozenset(
    {
        "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=80",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&q=85",
    }
)

_NAME_ID_SUFFIX = re.compile(r"\s*·\d{4}\s*$")


def _text_blob(name: str, desc: str = "", attrs: dict | None = None) -> str:
    parts = [name, desc]
    attrs = attrs or {}
    for key in ("root_category", "sub_category", "category", "color", "material", "gender"):
        val = attrs.get(key)
        if val:
            parts.append(str(val))
    return " ".join(parts).lower()


def resolve_pool_key(name: str, desc: str = "", attrs: dict | None = None) -> str:
    """Mahsulot uchun eng mos katalog sloti (shim, kurtka, …)."""
    blob = _text_blob(name, desc, attrs)
    clean_name = _NAME_ID_SUFFIX.sub("", name).lower()
    if clean_name != name.lower():
        blob = f"{clean_name} {blob}"

    best_key: str | None = None
    best_len = 0
    for hints, key in _HINT_TO_POOL:
        for hint in hints:
            if hint in blob and len(hint) > best_len:
                best_len = len(hint)
                best_key = key
    if best_key:
        return best_key

    if any(h in clean_name for h in ("shim", "jinsi", "chino", "pant")):
        return "shim"
    if any(h in clean_name for h in ("kurtka", "palto", "blazer")):
        return "kurtka"

    sub_blob = " ".join(
        str(attrs.get(k) or "")
        for k in ("sub_category", "category", "root_category")
    ).lower()
    for hints, key in _SUB_CATEGORY_POOL:
        if any(h in sub_blob for h in hints):
            return key

    return "koylak"


def pick_catalog_image(name: str, desc: str = "", attrs: dict | None = None) -> str:
    pool_key = resolve_pool_key(name, desc, attrs)
    pool = IMAGE_POOLS.get(pool_key) or IMAGE_POOLS["koylak"]
    stable = f"{pool_key}|{name}|{desc}|{attrs.get('color') if attrs else ''}"
    idx = int(hashlib.md5(stable.encode()).hexdigest(), 16) % len(pool)
    return pool[idx]


def is_seed_placeholder_image(url: str) -> bool:
    u = (url or "").strip()
    if not u:
        return True
    if "/api/v1/media/" in u or u.startswith("/uploads/"):
        return False
    if "bozorliii-product-placeholder" in u:
        return True
    if u in _LEGACY_MISMATCH_URLS:
        return True
    if "unsplash.com" in u or "picsum.photos" in u:
        return True
    if "/placeholder" in u and "bozorliii-product-placeholder" not in u:
        return True
    return False


# seed.py uchun alias
pick_product_image = pick_catalog_image
