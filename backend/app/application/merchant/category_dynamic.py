"""Mahsulot kiyim bo'lmasa — AI yoki qoidalar orqali yangi kategoriya taklif qilish."""

from __future__ import annotations

import re
from typing import Any

from loguru import logger

# (hint, root, sub)
_NON_CLOTHING_KEYWORD_ROUTES: list[tuple[tuple[str, ...], str, str]] = [
    (("mato", "gazmol", "atlas", "saten", "pardabop", "tekstil", "ko'rpa", "yostiq"), "Matolar & tekstil", "Pardabop va dekor mato"),
    (("atir", "parfyum", "parfum", "lattafa", "armaf"), "Go'zallik & Parfümeriya", "Atir va parfyum"),
    (("kosmetika", "krem", "lab", "soch", "parvarish"), "Go'zallik & Parfümeriya", "Kosmetika"),
    (("telefon", "smartfon", "iphone", "samsung", "naushnik", "quloqchin"), "Elektronika & texnika", "Telefon va aksessuar"),
    (("mikser", "blender", "muzlatgich", "pech", "maishiy texnika"), "Elektronika & texnika", "Maishiy texnika"),
    (("kompyuter", "noutbuk", "planshet", "klaviatura"), "Elektronika & texnika", "Kompyuter va planshet"),
    (("idish", "tovoq", "choynak", "qoshiq", "vilka", "piyola"), "Uy & maishiy", "Idish-tovoq"),
    (("oshxona", "qozon", "skovorodka"), "Uy & maishiy", "Oshxona jihozlari"),
    (("mebel", "stol", "stul", "shkaf", "divan"), "Uy & maishiy", "Dekor va interyer"),
    (("yong'oq", "bodom", "pista", "quruq meva", "ziravor", "ziravorlar"), "Oziq-ovqat & savdo", "Quruq mevalar"),
    (("asbob", "bolg'a", "o'roq", "qurilish"), "Qurilish & hunarmandchilik", "Asbob-uskunalar"),
    (("sement", "gips", "plitka", "kraska"), "Qurilish & hunarmandchilik", "Qurilish materiallari"),
]

_CATEGORY_SUGGEST_SYSTEM = """Siz O'zbekiston bozoridagi mahsulot uchun kategoriya taklif qilasiz.
Faqat JSON: {"root_category": "2-5 so'z", "sub_category": "2-6 so'z"}
root — keng bo'lim (masalan: Matolar & tekstil, Elektronika & texnika).
sub — aniq tur (masalan: Pardabop va dekor mato).
Mahsulot kiyim bo'lmasa ham mos bo'lim tanlang; kerak bo'lsa yangi nom taklif qiling."""


def _text_blob(attrs: dict[str, Any]) -> str:
    return " ".join(
        str(attrs.get(key) or "")
        for key in (
            "product_name",
            "description",
            "category_hint",
            "category",
            "category_label",
            "suggested_root_category",
            "suggested_sub_category",
        )
    ).casefold()


def infer_non_clothing_route(attrs: dict[str, Any]) -> tuple[str, str] | None:
    text = _text_blob(attrs)
    if not text.strip():
        return None
    for words, root, sub in _NON_CLOTHING_KEYWORD_ROUTES:
        if any(w in text for w in words):
            return root, sub
    return None


def _clean_name(raw: str, *, max_len: int = 80) -> str:
    cleaned = re.sub(r"\s+", " ", (raw or "").strip())
    if len(cleaned) > max_len:
        cleaned = cleaned[: max_len - 1].rstrip() + "…"
    return cleaned


async def suggest_category_via_ai(attrs: dict[str, Any]) -> tuple[str, str] | None:
    """Groq — noma'lum mahsulot uchun root/sub taklif."""
    from app.infrastructure.ai_clients.groq import GroqClient

    groq = GroqClient()
    if not groq._settings.groq_api_key:
        return None

    name = str(attrs.get("product_name") or attrs.get("description") or "").strip()
    if len(name) < 2:
        return None

    try:
        payload = await groq.chat_json(
            system_prompt=_CATEGORY_SUGGEST_SYSTEM,
            user_prompt=f"Mahsulot: {name}\nTavsif: {attrs.get('description') or '-'}",
            vision=False,
        )
    except Exception as exc:
        logger.warning("category_ai_suggest_failed", error=str(exc)[:120])
        return None

    if not isinstance(payload, dict):
        return None
    root = _clean_name(str(payload.get("root_category") or payload.get("root") or ""))
    sub = _clean_name(str(payload.get("sub_category") or payload.get("sub") or ""))
    if len(root) < 2 or len(sub) < 2:
        return None
    return root, sub


async def resolve_category_names(attrs: dict[str, Any]) -> tuple[str, str] | None:
    """Mavjud taxmin → qoidalar → AI."""
    root = str(attrs.get("suggested_root_category") or "").strip()
    sub = str(attrs.get("suggested_sub_category") or "").strip()
    if root and sub:
        return root, sub

    route = infer_non_clothing_route(attrs)
    if route:
        return route

    return await suggest_category_via_ai(attrs)
