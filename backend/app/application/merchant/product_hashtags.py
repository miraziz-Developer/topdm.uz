"""Mahsulot hashtaglari — bot, publish va qidiruv."""
from __future__ import annotations

import re

_HASHTAG_RE = re.compile(r"#([\w\u0400-\u04FF\u0100-\u024F]+)", re.UNICODE)
_TOKEN_RE = re.compile(r"[\w\u0400-\u04FF\u0100-\u024F]{2,}", re.UNICODE)


def normalize_tag(raw: str) -> str:
    t = (raw or "").strip().lstrip("#").casefold().replace(" ", "_")
    return t[:40]


def parse_hashtags_from_text(text: str) -> list[str]:
    """'#tufli #qora' yoki 'tufli, qora, ayollar' → ['tufli', 'qora', 'ayollar']."""
    found: list[str] = []
    seen: set[str] = set()
    plain_chunks: list[str] = []
    last_end = 0
    for m in _HASHTAG_RE.finditer(text or ""):
        plain_chunks.append((text or "")[last_end : m.start()])
        last_end = m.end()
        tag = normalize_tag(m.group(1))
        if tag and tag not in seen:
            seen.add(tag)
            found.append(tag)
    plain_chunks.append((text or "")[last_end:])
    for chunk in plain_chunks:
        for token in _TOKEN_RE.findall(chunk):
            tag = normalize_tag(token)
            if len(tag) >= 2 and tag not in seen:
                seen.add(tag)
                found.append(tag)
    if found:
        return found[:20]
    for chunk in re.split(r"[,;\n]+", text or ""):
        for token in _TOKEN_RE.findall(chunk):
            tag = normalize_tag(token)
            if len(tag) >= 2 and tag not in seen:
                seen.add(tag)
                found.append(tag)
    return found[:20]


def merge_hashtags(*groups: list[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for group in groups:
        for raw in group or []:
            tag = normalize_tag(str(raw))
            if tag and tag not in seen:
                seen.add(tag)
                out.append(tag)
    return out[:20]


def suggest_hashtags_from_attrs(attrs: dict) -> list[str]:
    bits: list[str] = []
    for key in ("category_label", "category_hint", "product_name", "color"):
        val = str(attrs.get(key) or "")
        for token in _TOKEN_RE.findall(val):
            bits.append(normalize_tag(token))
    for c in attrs.get("colors") or []:
        if isinstance(c, str):
            bits.append(normalize_tag(c))
    draft = attrs.get("variant_draft") if isinstance(attrs.get("variant_draft"), dict) else {}
    for row in draft.get("colors") or []:
        if isinstance(row, dict):
            bits.append(normalize_tag(str(row.get("name") or "")))
    for t in attrs.get("style_tags") or []:
        bits.append(normalize_tag(str(t)))
    return merge_hashtags(bits)[:12]


def format_hashtags_display(tags: list[str] | None) -> str:
    items = [f"#{t}" for t in (tags or []) if t]
    return " ".join(items) if items else "—"


def hashtags_for_publish(attrs: dict) -> list[str]:
    manual = attrs.get("hashtags") if isinstance(attrs.get("hashtags"), list) else []
    manual_norm = merge_hashtags([str(x) for x in manual])
    if manual_norm:
        return manual_norm
    return suggest_hashtags_from_attrs(attrs)
