"""Stilist chat — foydalanuvchi rasmini Groq vision bilan tahlil qilish."""

from __future__ import annotations

from typing import Any, Literal

from app.infrastructure.ai_clients.groq import GroqClient

StylistPhotoMode = Literal["look_check", "personal_style", "find_similar"]

_MODE_HINTS: dict[StylistPhotoMode, str] = {
    "look_check": (
        "Foydalanuvchi TAYYOR LOOK / kiyim rasmini yubordi. "
        "Nima kiyganini sanab o't, rang va uslub muvofiqligini bahola (1–10), "
        "2–3 aniq yaxshilash taklifi. Katalogdan almashtirish kerak bo'lsa search_keywords yoz."
    ),
    "personal_style": (
        "Foydalanuvchi O'Z SURATI / portret yubordi (hurmatli, betaraf). "
        "Umumiy uslub yo'nalishi, mos ranglar va kiyim turlarini taxmin qil; "
        "yuz/shaxsni baham ko'rmagin. Katalog qidiruv uchun search_keywords."
    ),
    "find_similar": (
        "Foydalanuvchi rasmdagi kiyimlarni BOZOR KATALOGIDAN topmoqchi. "
        "Har bir ko'rinadigan parchani ajrat (kurtka, shim, oyoq kiyim…), rang va search_keywords."
    ),
}

_DEFAULT_USER_TEXT: dict[StylistPhotoMode, str] = {
    "look_check": "Bu look qanday turadi? Nima yaxshilash mumkin?",
    "personal_style": "Mening suratim — menga mos kiyim va look tavsiya qiling.",
    "find_similar": "Rasmdagidek mahsulotlarni katalogdan toping.",
}


async def analyze_stylist_user_photo(
    image_bytes: bytes,
    image_mime: str,
    mode: StylistPhotoMode,
    *,
    user_note: str = "",
) -> dict[str, Any]:
    """Vision JSON → stylist chat konteksti."""
    note = (user_note or "").strip()
    mode_hint = _MODE_HINTS.get(mode, _MODE_HINTS["look_check"])
    groq = GroqClient()
    payload = await groq.chat_json(
        system_prompt=(
            "Sen O'zbekiston bozori (Ippodrom/Abu Sahiy) uchun professional AI stilistsan. "
            "Faqat JSON qaytaring."
        ),
        user_prompt=(
            f"{mode_hint}\n"
            f"Foydalanuvchi qo'shimcha matni: {note or '(yoq)'}\n\n"
            'JSON: {"summary_uz":"2-4 gap o\'zbekcha",'
            '"detected_items":[{"label_uz":"...","color_uz":"...","category":"jacket|pants|shoes|shirt|dress|other"}],'
            '"search_keywords":"katalog qidiruv uchun qisqa matn",'
            '"stylist_context_uz":"stylist LLM uchun batafsil kontekst (o\'zbekcha)"}'
        ),
        vision=True,
        image_bytes=image_bytes,
        image_mime=image_mime or "image/jpeg",
    )
    if not isinstance(payload, dict):
        payload = {}
    summary = str(payload.get("summary_uz") or "").strip()
    context = str(payload.get("stylist_context_uz") or summary).strip()
    keywords = str(payload.get("search_keywords") or "").strip()
    items = payload.get("detected_items")
    if not isinstance(items, list):
        items = []
    return {
        "mode": mode,
        "summary_uz": summary,
        "stylist_context_uz": context,
        "search_keywords": keywords,
        "detected_items": items,
    }


def default_text_for_photo_mode(mode: str) -> str:
    try:
        key = mode if mode in _DEFAULT_USER_TEXT else "look_check"
        return _DEFAULT_USER_TEXT[key]  # type: ignore[index]
    except KeyError:
        return _DEFAULT_USER_TEXT["look_check"]
