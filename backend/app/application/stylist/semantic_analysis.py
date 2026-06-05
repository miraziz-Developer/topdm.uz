"""Groq semantic understanding of shopper messages (Uzbek + typos + FX budgets)."""

from __future__ import annotations

from typing import Any

from app.application.stylist.budget_uzs import normalize_budget_uzs
from app.application.stylist.stylist_persona import format_history_block
from app.services.semantic_guardrails import GYM_SPORT_MARKERS, merge_guardrail_meta

_OUTFIT_MARKERS = (
    "look",
    "obraz",
    "kombin",
    "komplekt",
    "majmu",
    "majmuasi",
    "to'liq",
    "kompleks",
)
_KIYIM_MARKERS = ("kiyim", "krossovka", "futbolka", "shim", "trening", "poyabzal")


def _message_implies_outfit(text: str) -> bool:
    lowered = (text or "").lower()
    if any(m in lowered for m in _OUTFIT_MARKERS):
        return True
    sport_ctx = any(m in lowered for m in GYM_SPORT_MARKERS)
    if sport_ctx and any(m in lowered for m in _KIYIM_MARKERS):
        return True
    return False


SEMANTIC_SYSTEM_PROMPT = """Siz Bozorliii uchun o'zbek/rus/ingliz tilidagi moda so'rovlarini SEMANTIK tahlil qiluvchi parsersiz.
Foydalanuvchi niyatini kontekstdan tushuning (xatolar, slang, aralash til).
Oldingi suhbat va mijoz profilini hisobga oling — «yana», «arzonroq» deganda avvalgi budjet/uslub saqlansin.

FAQAT JSON qaytaring:
{
  "intent": "chitchat" yoki "shopping",
  "wants_outfit": true/false,
  "style": "sport|gym|casual|classic|formal",
  "age_group": "adult|kids",
  "gender": "erkak|ayol|unisex|unknown",
  "budget_uzs": butun son UZS yoki null,
  "search_keywords": "bazada qidirish uchun qisqa o'zbek kalit so'zlar",
  "summary_uz": "foydalanuvchi nimani xohlaydi — 1 jumla",
  "suggestions": ["keyingi savol 1", "keyingi savol 2"]
}

QOIDALAR:
- Faqat salom/rahmat/suhbat -> intent=chitchat, wants_outfit=false
- Kiyim, look, kombin, budjet, uslub -> intent=shopping
- wants_outfit=true: to'liq komplekt (ustki+pastki+poyabzal) — look/kombin/sport/zal/gym/trening so'rovlari
- «zalga sviter kiyadmi» kabi tuzatish = shopping, wants_outfit=true, style=sport/gym, oldingi kontekstni saqlang
- salon xato = salom; poll = polo; klassika = classic/formal
- 100$, 100 dollar -> budget_uzs taxminan 1300000 (13000 kurs)
- gym/sport ≠ maktab formasi / bolalar
- search_keywords: 3-8 so'z, masalan "erkak klassik polo shim tufli"
- Agar mijoz faqat salom desa va kontekstda kiyim yo'q bo'lsa -> chitchat
- Agar oldingi suhbatda look so'ralgan bo'lsa va hozir «yana» desa -> shopping, wants_outfit=true
"""


def build_semantic_user_payload(
    user_message: str,
    history: list[dict] | None = None,
    session: dict | None = None,
) -> str:
    parts = [
        f"HOZIRGI XABAR:\n{user_message.strip()}",
        f"\nOLDINGI SUHBAT:\n{format_history_block(history)}",
    ]
    if session:
        parts.append(
            "\nMIJOZ PROFILI (oldingi aylanadan):\n"
            f"- uslub: {session.get('style')}\n"
            f"- budjet UZS: {session.get('budget_uzs')}\n"
            f"- jins: {session.get('gender')}\n"
            f"- oxirgi xulosa: {session.get('last_summary')}\n"
        )
    return "\n".join(parts)


def normalize_semantic_analysis(groq_payload: dict[str, Any], user_message: str) -> dict[str, Any]:
    """Merge Groq JSON with safe defaults + UZS budget normalization."""
    intent = str(groq_payload.get("intent") or "shopping").strip().lower()
    if intent not in ("chitchat", "shopping"):
        intent = "shopping"

    wants_outfit = bool(groq_payload.get("wants_outfit"))
    if intent == "chitchat":
        wants_outfit = False
    elif intent == "shopping" and _message_implies_outfit(user_message):
        wants_outfit = True

    style = str(groq_payload.get("style") or "casual").strip().lower()
    age_group = str(groq_payload.get("age_group") or "adult").strip().lower()
    gender = str(groq_payload.get("gender") or "unknown").strip().lower()

    budget_uzs = normalize_budget_uzs(groq_payload.get("budget_uzs"), user_message)

    search_keywords = str(groq_payload.get("search_keywords") or "").strip()
    if not search_keywords and intent == "shopping":
        search_keywords = user_message[:80].strip()

    summary_uz = str(groq_payload.get("summary_uz") or "").strip()
    suggestions = groq_payload.get("suggestions")
    if not isinstance(suggestions, list):
        suggestions = []

    meta = merge_guardrail_meta(
        {"style": style, "age_group": age_group, "budget": budget_uzs},
        user_message,
    )
    meta["_user_blob"] = user_message
    meta["_budget_uzs"] = budget_uzs
    meta["budget"] = budget_uzs
    meta["_semantic_summary"] = summary_uz
    meta["_search_keywords"] = search_keywords
    meta["_gender"] = gender

    return {
        "intent": intent,
        "wants_outfit": wants_outfit,
        "style": meta.get("style", style),
        "age_group": meta.get("age_group", age_group),
        "gender": gender,
        "budget_uzs": budget_uzs,
        "search_keywords": search_keywords,
        "summary_uz": summary_uz,
        "suggestions": [str(s) for s in suggestions[:4] if s],
        "_guardrail_meta": meta,
    }
