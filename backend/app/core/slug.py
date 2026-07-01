from __future__ import annotations

import re
import unicodedata


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    ascii_text = ascii_text.replace("'", "").replace("'", "").replace("`", "")
    slug = _SLUG_RE.sub("-", ascii_text.lower()).strip("-")
    return slug or "shop"


def unique_slug(base: str, existing: set[str]) -> str:
    candidate = slugify(base)
    if candidate not in existing:
        existing.add(candidate)
        return candidate
    index = 2
    while True:
        next_slug = f"{candidate}-{index}"
        if next_slug not in existing:
            existing.add(next_slug)
            return next_slug
        index += 1
