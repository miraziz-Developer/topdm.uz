"""Kategoriya bo'yicha Unsplash rasmlar — nom, tavsif va attributes bilan mos."""

from __future__ import annotations

import hashlib
import re

# Frontend `/brand/bozorliii-product-placeholder.svg` — kategoriya sloti attributes da
_CATALOG_PLACEHOLDER = "/brand/bozorliii-product-placeholder.svg"


def _stable_pool_urls(pool_key: str, count: int = 6) -> tuple[str, ...]:
    """Mahsulot kartasi — tasodifiy landshaft emas, brend placeholder."""
    return tuple(_CATALOG_PLACEHOLDER for _ in range(count))


# Har slot uchun bir nechta turli rasm (vizual qidiruv testi)
IMAGE_POOLS: dict[str, tuple[str, ...]] = {
    "shim": _stable_pool_urls("shim"),
    "kurtka": _stable_pool_urls("kurtka"),
    "koylak": _stable_pool_urls("koylak", 5),
    "poyabzal": _stable_pool_urls("poyabzal"),
    "kamar": _stable_pool_urls("kamar", 3),
    "sumka": _stable_pool_urls("sumka", 4),
    "libos": _stable_pool_urls("libos", 4),
    "mato": _stable_pool_urls("mato", 3),
    "atir": _stable_pool_urls("atir", 2),
    "sport": _stable_pool_urls("sport", 3),
    "bolalar": _stable_pool_urls("bolalar", 2),
    "soat": _stable_pool_urls("soat", 2),
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
    (("bahoriy", "kuzgi", "ustki"), "kurtka"),  # nomda shim bo'lsa nom ustun
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

    # Shim/kurtka: sub "Bahoriy" — nomda aniq slot bo'lsa ishlatiladi
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
    if u in _LEGACY_MISMATCH_URLS:
        return True
    if "images.unsplash.com" in u:
        return True
    if "picsum.photos" in u:
        return True
    if "/placeholder" in u and "bozorliii-product-placeholder" not in u:
        return True
    return False


# seed.py uchun alias
pick_product_image = pick_catalog_image
