"""Locale-aware stylist prompts (uz / ru / en)."""

from __future__ import annotations

from app.core.client_context import get_locale

_SUPPORTED = frozenset({"uz", "ru", "en"})


def normalize_stylist_locale(raw: str | None) -> str:
    loc = (raw or get_locale() or "uz").strip().lower()[:8]
    return loc if loc in _SUPPORTED else "uz"


def locale_reply_instruction(locale: str | None = None) -> str:
    loc = normalize_stylist_locale(locale)
    if loc == "ru":
        return (
            "ЯЗЫК: отвечайте на русском (естественный, дружелюбный стиль консультанта). "
            "Названия товаров из каталога не переводите."
        )
    if loc == "en":
        return (
            "LANGUAGE: reply in English (warm personal stylist tone). "
            "Keep product names exactly as in the catalog."
        )
    return (
        "TIL: javobni o'zbek lotin tilida yozing (samimiy stylist ohangi). "
        "Mahsulot nomlarini katalogdagidek qoldiring."
    )


def locale_chitchat_suggestions(locale: str | None = None) -> list[str]:
    loc = normalize_stylist_locale(locale)
    if loc == "ru":
        return [
            "Мужской спортивный образ в зал до 500 тыс.",
            "Кроссовки до 400 тыс.",
            "Casual look в университет",
        ]
    if loc == "en":
        return [
            "Men's gym outfit under 500k UZS",
            "Sneakers under 400k UZS",
            "Casual university look",
        ]
    return [
        "Erkaklar uchun sport kiyim zalga 500 ming",
        "400 minggacha krossovka",
        "Universitetga casual look",
    ]
