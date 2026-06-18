"""
Universal Bozorliii stylist — Groq semantic analysis + Postgres inventory.

Flow:
  1. Groq analyzes message (intent, style, budget, search keywords, typos)
  2. chitchat → Groq conversation only
  3. shopping → Groq picks product UUIDs + writes advice (no rule-based mixer)
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any, Literal

from groq import Groq

from app.ai.config import require_groq_api_key, resolve_groq_chat_model
from app.ai.intent_analyzer import parse_budget_with_fx
from app.application.agents.bozor_chat_catalog import parse_budget_from_text, parse_look_intent
from app.application.stylist.budget_uzs import normalize_budget_uzs
from app.application.stylist.semantic_analysis import (
    SEMANTIC_SYSTEM_PROMPT,
    build_semantic_user_payload,
    normalize_semantic_analysis,
)
from app.application.stylist.semantic_analysis import _message_implies_outfit
from app.application.stylist.stylist_persona import (
    HUMAN_STYLIST_CHITCHAT,
    HUMAN_STYLIST_OUTFIT_JSON,
    HUMAN_STYLIST_SHOPPING_JSON,
    build_messages,
)
from app.application.stylist.stylist_locale import (
    locale_chitchat_suggestions,
    locale_reply_instruction,
    normalize_stylist_locale,
)
from app.application.stylist.stylist_pick_validator import validate_ai_picks
from app.application.stylist.stylist_session import merge_session_into_analysis
from app.application.stylist.stylist_user_profile import filter_catalog_by_profile, profile_context_block
from app.core.client_context import get_locale
from app.core.config import get_settings
from app.services.semantic_guardrails import (
    filter_db_by_guardrails,
    infer_product_age_group,
    infer_product_style_tag,
    merge_guardrail_meta,
    normalize_gender,
)
from app.services.stylist import infer_target_style

RouteIntent = Literal["chitchat", "shopping"]

_CHITCHAT_EXACT = frozenset(
    {
        "salom",
        "salon",
        "salam",
        "slom",
        "assalomu alaykum",
        "assalom",
        "hello",
        "hi",
        "hey",
        "rahmat",
        "raxmat",
        "thanks",
        "thank you",
        "test",
        "yo",
        "yordam",
        "kim siz",
        "nima qilasiz",
        "nima gap",
        "qalesiz",
        "qalaysiz",
        "yaxshimisiz",
    }
)
_CHITCHAT_PREFIXES = ("salom ", "salon ", "assalom ", "hello ", "hi ", "rahmat ", "qalay ")
_GREETING_ROOTS = ("salom", "salam", "assalom", "hello", "hi", "hey", "rahmat", "qalay")


def _is_greeting_like(text: str) -> bool:
    """Catch typos (salon → salom) and ultra-short openers — never force a look."""
    raw = (text or "").strip().lower()
    if not raw:
        return True
    if raw in _CHITCHAT_EXACT:
        return True
    if any(raw.startswith(p) for p in _CHITCHAT_PREFIXES):
        return True
    compact = re.sub(r"[^a-zа-яёўқғҳ]", "", raw)
    if len(compact) <= 10:
        for root in _GREETING_ROOTS:
            if compact == root:
                return True
            if len(compact) >= 3 and len(root) >= 3:
                if compact in root or root in compact:
                    return True
                # one-character typo (salon / salom)
                if abs(len(compact) - len(root)) <= 1:
                    mismatches = sum(1 for a, b in zip(compact, root) if a != b)
                    mismatches += abs(len(compact) - len(root))
                    if mismatches <= 1:
                        return True
    return False
_SKU_SUFFIX_RE = re.compile(r"\s*·\d{3,5}\b")

_SHOPPING_MARKERS = (
    "kiyim",
    "krossovka",
    "poyabzal",
    "kurtka",
    "shim",
    "futbolka",
    "budjet",
    "byudjet",
    "so'mgacha",
    "somgacha",
    "gym",
    "sport",
    "look",
    "obraz",
    "kombin",
    "komplekt",
    "erkak",
    "ayol",
    "bolalar",
    "maktab",
    "forma",
    "tufli",
    "trening",
)


def _clean_assistant_text(text: str) -> str:
    """Remove catalog SKU suffixes (·0220) from spoken stylist text."""
    cleaned = _SKU_SUFFIX_RE.sub("", text or "")
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def _should_build_outfit(semantic: dict[str, Any], user_message: str) -> bool:
    if semantic.get("wants_outfit"):
        return True
    if str(semantic.get("intent") or "") == "chitchat":
        return False
    return _message_implies_outfit(user_message)


def _safe_json_object(raw: str | None) -> dict[str, Any]:
    if not raw or not str(raw).strip():
        return {}
    text = str(raw).strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(0))
                return parsed if isinstance(parsed, dict) else {}
            except json.JSONDecodeError:
                pass
    return {}


def _price_uzs(product: dict[str, Any]) -> int:
    raw = product.get("price_uzs")
    if raw is None:
        raw = product.get("price")
    try:
        return int(float(raw or 0))
    except (TypeError, ValueError):
        return 0


def _product_location(product: dict[str, Any]) -> str:
    shop = product.get("shop") if isinstance(product.get("shop"), dict) else {}
    parts = [
        shop.get("location_label"),
        shop.get("floor"),
        shop.get("section"),
        shop.get("ipadrom"),
        shop.get("market_zone"),
    ]
    label = " · ".join(str(p).strip() for p in parts if p)
    return label or "Ippodrom / Abu Saxiy"


def _pack_slot_item(product: dict[str, Any] | None) -> dict[str, Any] | None:
    if not product:
        return None
    return {
        **product,
        "price": _price_uzs(product),
        "location": _product_location(product),
    }


def _enrich_product_row(product: dict[str, Any]) -> dict[str, Any]:
    """Normalize Postgres row for inventory context lines."""
    return {
        "id": str(product.get("id") or ""),
        "name": str(product.get("name") or ""),
        "price": _price_uzs(product),
        "style": str(product.get("style") or infer_product_style_tag(product)),
        "age_group": str(product.get("age_group") or infer_product_age_group(product)),
        "location": _product_location(product),
        "category": str(
            product.get("category") or product.get("root_category") or product.get("sub_category") or ""
        ),
    }


def format_inventory_context(
    db_products: list[dict[str, Any]],
    *,
    limit: int = 40,
) -> str:
    """Serialize real DB rows for Groq short-term memory (no hallucinated SKUs)."""
    lines: list[str] = []
    for product in db_products[:limit]:
        row = _enrich_product_row(product)
        if not row["id"]:
            continue
        lines.append(
            f"- ID: {row['id']} | Nomi: {row['name']} | Narxi: {row['price']} UZS | "
            f"Uslubi: {row['style']} | Yosh: {row['age_group']} | "
            f"Bozor: {row['location']} | Kategoriya: {row['category']}"
        )
    return "\n".join(lines) if lines else "(hozircha mos mahsulot yo'q)"


def build_inventory_system_prompt(
    inventory_context: str,
    meta: dict[str, Any],
    *,
    locked_outfit_block: str | None = None,
) -> str:
    style = meta.get("style", "casual")
    age_group = meta.get("age_group", "adult")
    budget_max = meta.get("budget_max")
    budget_min = meta.get("budget_min")

    guard_rules = (
        "⚠️ FAQAT quyidagi 'REAL INVENTORY' ro'yxatidagi mahsulotlarni tavsiya qil.\n"
        "Ro'yxatda bo'lmagan nom, narx, do'kon — ixtiro = XATO.\n"
        "SKU kodlarini (·0224) matnda YOZMA.\n"
    )

    if style in ("gym", "sport"):
        guard_rules += "Sport/gym so'rov — maktab formasi, bolalar kiyimi, rasmiy kostyum QOʻSHMA.\n"
    if age_group == "adult":
        guard_rules += "Faqat kattalar mahsuloti — bolalar kiyimi tavsiya qilma.\n"
    if budget_max:
        guard_rules += f"BUDJET: barcha mahsulotlar yig'indisi {budget_max:,.0f} so'mdan oshmasin!\n"
        guard_rules += "Arzonroq look topsang — qancha tejalgani ayt.\n"

    style_tip = {
        "gym": "Sport look: krossovka + sport shim/trening + sport futbolka/sviter.",
        "sport": "Sport/casual: krossovka + jinsi/sport shim + polo yoki futbolka.",
        "classic": "Klassik look: tufli + chino yoki klassik shim + ko'ylak/polo.",
        "casual": "Casual: krossovka yoki lo'fer + jinsi + polo yoki sviter.",
        "formal": "Rasmiy: klassik tufli + kostyum yoki chino + ko'ylak.",
        "wedding": "To'y/rasmiy: klassik tufli + kostyum + oq ko'ylak.",
    }.get(style, "Uslubga mos kiyim tanlang.")

    prompt = (
        "Sen Bozorliii.uz shaxsiy stilistisan — isming Aziz. "
        "Ippodrom va Abu Saxiy bozorlarida 10 yillik tajribang bor.\n"
        f"So'rov: uslub={style}, yosh={age_group}.\n"
        f"Uslub bo'yicha yo'riqnoma: {style_tip}\n"
        f"{guard_rules}\n"
        "=== DATABASE (REAL INVENTORY) ===\n"
        f"{inventory_context}\n"
        "=================================\n"
    )
    if locked_outfit_block:
        prompt += (
            "\n=== TANLANGAN KOMBINATSIYA (faqat shu mahsulotlar) ===\n"
            f"{locked_outfit_block}\n"
            "=====================================================\n"
            "Shu kombinatsiyani nomi, narxi, joylashuvi bilan tushuntir.\n"
        )
    prompt += (
        "\nJavob: tabiiy o'zbek tilida, stilist kabi — iliq, aniq, sababli. "
        "Har bir mahsulot uchun 1 sabab jumla. Jami narxni hisoblang."
    )
    return prompt


class UniversalGroqStylist:
    """Single entry: greetings vs outfit search without breaking JSON parsers."""

    def __init__(self) -> None:
        settings = get_settings()
        api_key = require_groq_api_key(settings)
        self._client = Groq(api_key=api_key)
        self.model = resolve_groq_chat_model(settings)

    # ------------------------------------------------------------------ routing
    def classify_route_local(self, user_message: str) -> RouteIntent | None:
        """Fast offline gate — avoids Groq on obvious greetings or shopping."""
        text = (user_message or "").strip().lower()
        if not text:
            return "chitchat"
        if _is_greeting_like(user_message) and not any(m in text for m in _SHOPPING_MARKERS):
            return "chitchat"
        if text in _CHITCHAT_EXACT or any(text.startswith(p) for p in _CHITCHAT_PREFIXES):
            if not any(m in text for m in _SHOPPING_MARKERS):
                return "chitchat"
        _min_p, max_p = parse_budget_from_text(user_message)
        look = parse_look_intent(user_message)
        if look.get("is_look_request") or look.get("is_wardrobe_request"):
            return "shopping"
        if max_p is not None or _min_p is not None:
            return "shopping"
        if any(m in text for m in _SHOPPING_MARKERS):
            return "shopping"
        if len(text) <= 24 and not any(m in text for m in _SHOPPING_MARKERS):
            return "chitchat"
        return None

    def _analyze_semantic_sync(self, ctx: dict[str, Any]) -> dict[str, Any]:
        """Groq reads message + conversation context (primary brain)."""
        user_message = str(ctx.get("user_message") or "")
        history = ctx.get("history") if isinstance(ctx.get("history"), list) else None
        session = ctx.get("session") if isinstance(ctx.get("session"), dict) else None
        completion = self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SEMANTIC_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_semantic_user_payload(user_message, history, session),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        return _safe_json_object(completion.choices[0].message.content)

    async def analyze_message(
        self,
        user_message: str,
        *,
        history: list[dict[str, Any]] | None = None,
        session: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Semantic analysis — intent, outfit need, style, budget UZS, DB search keywords.
        Falls back to local heuristics only if Groq fails.
        """
        text = (user_message or "").strip()
        if not text:
            return normalize_semantic_analysis(
                {"intent": "chitchat", "wants_outfit": False, "summary_uz": "Salomlashuv"},
                text,
            )

        try:
            groq_payload = await asyncio.to_thread(
                self._analyze_semantic_sync,
                {"user_message": text, "history": history, "session": session},
            )
            if groq_payload:
                analysis = normalize_semantic_analysis(groq_payload, text)
                return merge_session_into_analysis(analysis, session or {}, text)
        except Exception:
            pass

        # Offline fallback (Groq unavailable)
        local_route = self.classify_route_local(text) or "chitchat"
        _min_fx, max_fx, _ = parse_budget_with_fx(text)
        analysis = normalize_semantic_analysis(
            {
                "intent": local_route,
                "wants_outfit": local_route == "shopping" and any(
                    k in text.lower() for k in ("look", "kombin", "komplekt", "obraz")
                ),
                "style": "casual",
                "age_group": "adult",
                "budget_uzs": max_fx,
                "search_keywords": text[:64],
                "summary_uz": text,
            },
            text,
        )
        return merge_session_into_analysis(analysis, session or {}, text)

    async def classify_intent(self, user_message: str) -> RouteIntent:
        analysis = await self.analyze_message(user_message)
        intent = str(analysis.get("intent") or "chitchat")
        return "shopping" if intent == "shopping" else "chitchat"  # type: ignore[return-value]

    # ------------------------------------------------------------------ chitchat
    def _chitchat_sync(self, ctx: dict[str, Any]) -> str:
        user_message = str(ctx.get("user_message") or "")
        history = ctx.get("history") if isinstance(ctx.get("history"), list) else None
        messages = build_messages(HUMAN_STYLIST_CHITCHAT, user_message, history)
        completion = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.72,
            max_tokens=400,
        )
        return (completion.choices[0].message.content or "").strip()

    async def handle_chitchat(
        self,
        user_message: str,
        *,
        history: list[dict[str, Any]] | None = None,
    ) -> str:
        return await asyncio.to_thread(
            self._chitchat_sync,
            {"user_message": user_message, "history": history},
        )

    # ------------------------------------------------------------------ shopping
    def _extract_shopping_meta_sync(self, user_message: str) -> dict[str, Any]:
        extraction_prompt = (
            "Extract structured data from the fashion query into strict JSON only.\n"
            "Keys: style (sport, classic, gym, casual, formal), age_group (adult, kids), "
            "budget (integer UZS or null).\n"
            'Example: {"style":"gym","age_group":"adult","budget":1300000}'
        )
        try:
            completion = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": extraction_prompt},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
                temperature=0.0,
            )
            groq_meta = _safe_json_object(completion.choices[0].message.content)
        except Exception:
            groq_meta = {}
        meta = merge_guardrail_meta(groq_meta, user_message)
        meta["_user_blob"] = user_message
        return meta

    async def analyze_user_request(self, user_message: str) -> dict[str, Any]:
        """Guardrail meta — prefers Groq semantic analysis."""
        semantic = await self.analyze_message(user_message)
        meta = semantic.get("_guardrail_meta")
        if isinstance(meta, dict):
            return meta
        return await asyncio.to_thread(self._extract_shopping_meta_sync, user_message)

    def _apply_guardrails(
        self,
        db_products: list[dict[str, Any]],
        meta: dict[str, Any],
    ) -> list[dict[str, Any]]:
        return filter_db_by_guardrails(db_products, meta)

    filter_db_by_guardrails = _apply_guardrails

    async def extract_user_intent(
        self,
        user_message: str,
        *,
        analysis: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        semantic = analysis or await self.analyze_message(user_message)
        meta = semantic.get("_guardrail_meta") or {}
        style = infer_target_style(str(semantic.get("style") or "casual"), user_message)
        budget = int(semantic.get("budget_uzs") or meta.get("budget") or 2_000_000)
        return {
            "style": style,
            "age_group": semantic.get("age_group", "adult"),
            "gender": normalize_gender(
                str(semantic.get("gender") or meta.get("gender") or ""),
                user_message,
            ),
            "budget": budget,
            "_guardrail_meta": meta,
            "_semantic": semantic,
        }

    def _groq_outfit_pick_sync(self, ctx: dict[str, Any]) -> dict[str, Any]:
        """Full-AI outfit: Groq picks ustki/pastki/poyabzal from filtered inventory."""
        user_message = str(ctx.get("user_message") or "")
        safe_catalog = ctx.get("safe_catalog") or []
        meta = ctx.get("meta") or {}
        history = ctx.get("history") if isinstance(ctx.get("history"), list) else None
        session = ctx.get("session") if isinstance(ctx.get("session"), dict) else None
        inventory_context = format_inventory_context(safe_catalog, limit=64)
        budget_hint = meta.get("budget") or meta.get("_budget_uzs")
        gender = meta.get("gender") or "noma'lum"
        style = meta.get("style") or "casual"
        loc = normalize_stylist_locale(session.get("locale") if session else get_locale())
        session_block = profile_context_block(session or {})
        if session:
            session_block += (
                f"\nSessiya: uslub={session.get('style')}, jins={session.get('gender')}, "
                f"budjet={session.get('budget_uzs')} UZS."
            )
        meta_with_budget = {**meta, "budget_max": budget_hint, "budget_min": None}
        system_instruction = (
            HUMAN_STYLIST_OUTFIT_JSON
            + "\n\n"
            + locale_reply_instruction(loc)
            + "\n\n"
            + build_inventory_system_prompt(inventory_context, meta_with_budget, locked_outfit_block=None)
            + f"\n\nSo'rov konteksti: budjet={budget_hint or 'aniqmas'} so'm | jins={gender} | uslub={style}"
            + f"\n{session_block}"
            + "\n\nMUHIM: Komplekt so'ralsa look_slots da 3 ta slot: ustki + pastki + poyabzal."
            + "\nHar bir mahsulot uchun assistant_text da SABAB ayt — nima uchun aylnantanlangan."
        )
        messages = build_messages(system_instruction, user_message.strip(), history, max_turns=10)
        completion = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.25,
        )
        data = _safe_json_object(completion.choices[0].message.content)
        allowed = {str(p.get("id")): p for p in safe_catalog if p.get("id")}
        raw_slots = data.get("look_slots") or data.get("slots") or []
        if not isinstance(raw_slots, list):
            raw_slots = []

        look_groups: list[dict[str, Any]] = []
        product_ids: list[str] = []
        role_defaults = ("ustki", "pastki", "poyabzal", "aksessuar")

        for idx, slot in enumerate(raw_slots):
            if not isinstance(slot, dict):
                continue
            pid = str(slot.get("product_id") or slot.get("id") or "").strip()
            if pid not in allowed or pid in product_ids:
                continue
            role = str(slot.get("role") or role_defaults[min(idx, 3)])
            product_ids.append(pid)
            look_groups.append({"role": role, "product_id": pid})

        if len(product_ids) < 2:
            raw_ids = data.get("product_ids") or data.get("selected_product_ids") or []
            if isinstance(raw_ids, list):
                for pid in raw_ids:
                    pid_s = str(pid or "").strip()
                    if pid_s in allowed and pid_s not in product_ids:
                        product_ids.append(pid_s)

        suggestions = data.get("suggestions") or []
        if not isinstance(suggestions, list):
            suggestions = []

        assistant_text = _clean_assistant_text(str(data.get("assistant_text") or ""))
        return {
            "assistant_text": assistant_text,
            "selected_product_ids": product_ids[:6],
            "look_groups": look_groups,
            "suggestions": [str(s) for s in suggestions[:4] if s],
            "route": "shopping",
            "engine": "groq_outfit",
        }

    def _apply_pick_validation(
        self,
        result: dict[str, Any],
        safe_catalog: list[dict[str, Any]],
        meta: dict[str, Any],
        user_message: str,
    ) -> dict[str, Any]:
        """Filter Groq IDs that violate sport/gender/budget — may trigger one AI retry."""
        checked = validate_ai_picks(
            list(result.get("selected_product_ids") or []),
            safe_catalog,
            meta=meta,
            user_message=user_message,
            look_groups=result.get("look_groups") if isinstance(result.get("look_groups"), list) else None,
        )
        result["selected_product_ids"] = checked["product_ids"]
        result["look_groups"] = checked["look_groups"]
        if checked.get("rejections"):
            result["pick_rejections"] = checked["rejections"]
        return result

    def _universal_shopping_sync(self, ctx: dict[str, Any]) -> dict[str, Any]:
        user_message = str(ctx.get("user_message") or "")
        safe_catalog = ctx.get("safe_catalog") or []
        meta = ctx.get("meta") or {}
        history = ctx.get("history") if isinstance(ctx.get("history"), list) else None
        session = ctx.get("session") if isinstance(ctx.get("session"), dict) else None
        inventory_context = format_inventory_context(safe_catalog)
        budget_hint = meta.get("budget") or meta.get("_budget_uzs")
        loc = normalize_stylist_locale(session.get("locale") if session else get_locale())
        session_block = profile_context_block(session or {})
        system_instruction = (
            HUMAN_STYLIST_SHOPPING_JSON
            + "\n\n"
            + locale_reply_instruction(loc)
            + "\n\n"
            + build_inventory_system_prompt(inventory_context, meta, locked_outfit_block=None)
            + f"\nBudjet (UZS): {budget_hint or 'aniq emas'}."
            + f"\n{session_block}"
        )
        messages = build_messages(system_instruction, user_message.strip(), history, max_turns=10)
        completion = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.32,
        )
        data = _safe_json_object(completion.choices[0].message.content)
        allowed = {str(p.get("id")) for p in safe_catalog if p.get("id")}
        raw_ids = data.get("product_ids") or data.get("selected_product_ids") or []
        if not isinstance(raw_ids, list):
            raw_ids = []
        product_ids = [str(i) for i in raw_ids if str(i) in allowed][:8]
        suggestions = data.get("suggestions") or []
        if not isinstance(suggestions, list):
            suggestions = []
        return {
            "assistant_text": _clean_assistant_text(str(data.get("assistant_text") or "").strip()),
            "selected_product_ids": product_ids,
            "suggestions": [str(s) for s in suggestions[:4] if s],
            "route": "shopping",
            "engine": "groq_shopping",
        }

    async def run_chat_turn(
        self,
        user_message: str,
        db_products: list[dict[str, Any]],
        *,
        analysis: dict[str, Any] | None = None,
        history: list[dict[str, Any]] | None = None,
        session: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Universal Groq chat — chitchat or shopping with DB-backed product picks."""
        semantic = analysis or await self.analyze_message(
            user_message,
            history=history,
            session=session,
        )
        route = semantic.get("intent", "chitchat")
        loc = normalize_stylist_locale(
            (session or {}).get("locale") or get_locale(),
        )
        if route == "chitchat":
            text = await self.handle_chitchat(user_message, history=history)
            return {
                "assistant_text": text,
                "selected_product_ids": [],
                "look_groups": [],
                "route": "chitchat",
                "engine": "groq_chitchat",
                "locale": loc,
                "suggestions": semantic.get("suggestions") or locale_chitchat_suggestions(loc),
            }

        meta = semantic.get("_guardrail_meta") or {}
        if not meta.get("_user_blob"):
            meta["_user_blob"] = user_message
        if semantic.get("gender") and semantic.get("gender") != "unknown":
            meta["gender"] = semantic.get("gender")
        catalog_pool = filter_catalog_by_profile(db_products, session or {})
        safe_catalog = self._apply_guardrails(catalog_pool, meta)
        if not safe_catalog and catalog_pool:
            safe_catalog = catalog_pool[:64]
        if not safe_catalog and db_products:
            safe_catalog = db_products[:64]
        if not safe_catalog:
            return {
                "assistant_text": (
                    "Kechirasiz, hozirda bazamizda siz so'ragan talablarga mos kiyimlar topilmadi. "
                    "Boshqa uslub yoki budjet aytib ko'ring!"
                ),
                "selected_product_ids": [],
                "look_groups": [],
                "route": "shopping",
                "engine": "groq_outfit",
                "strict_error": "empty_catalog",
                "suggestions": [],
            }

        pick_ctx = {
            "user_message": user_message,
            "safe_catalog": safe_catalog,
            "meta": meta,
            "history": history,
            "session": session,
        }
        result = await asyncio.to_thread(self._groq_outfit_pick_sync, pick_ctx)
        result = self._apply_pick_validation(result, safe_catalog, meta, user_message)

        rejections = result.get("pick_rejections") or []
        if rejections and len(result.get("selected_product_ids") or []) < 2:
            fix_hint = "; ".join(str(r) for r in rejections[:5])
            retry_ctx = {
                **pick_ctx,
                "user_message": (
                    f"{user_message.strip()}\n\n"
                    f"[Tuzatish: avvalgi tanlov mos emas — {fix_hint}. "
                    "Faqat inventorydan yangi mos ID tanlang.]"
                ),
            }
            retry_pick = await asyncio.to_thread(self._groq_outfit_pick_sync, retry_ctx)
            retry_pick = self._apply_pick_validation(retry_pick, safe_catalog, meta, user_message)
            if len(retry_pick.get("selected_product_ids") or []) >= len(
                result.get("selected_product_ids") or []
            ):
                result = retry_pick
                result["engine"] = "groq_outfit_retry"

        if not result.get("selected_product_ids"):
            retry = await asyncio.to_thread(self._universal_shopping_sync, pick_ctx)
            retry = self._apply_pick_validation(retry, safe_catalog, meta, user_message)
            if retry.get("selected_product_ids"):
                result = retry
        if not result.get("assistant_text"):
            result["assistant_text"] = (
                "Sizning so'rovingiz bo'yicha mos mahsulotlar topildi — kartalarni ko'ring."
            )
        if not result.get("selected_product_ids") and safe_catalog:
            budget_raw = meta.get("budget") or meta.get("_budget_uzs")
            try:
                budget_uzs = int(float(budget_raw)) if budget_raw is not None else 0
            except (TypeError, ValueError):
                budget_uzs = 0
            ordered = sorted(
                safe_catalog,
                key=lambda row: float(row.get("price") or row.get("price_uzs") or 0),
            )
            fallback_ids: list[str] = []
            for row in ordered:
                pid = str(row.get("id") or "").strip()
                if not pid:
                    continue
                price = float(row.get("price") or row.get("price_uzs") or 0)
                if budget_uzs > 0 and price > budget_uzs * 3.5:
                    continue
                fallback_ids.append(pid)
                if len(fallback_ids) >= 4:
                    break
            if fallback_ids:
                result["selected_product_ids"] = fallback_ids
                result["engine"] = result.get("engine") or "catalog_fallback"

        if not result.get("look_groups") and result.get("selected_product_ids"):
            ids = result["selected_product_ids"]
            roles = ("ustki", "pastki", "poyabzal", "aksessuar")
            result["look_groups"] = [
                {"role": roles[i] if i < len(roles) else "aksessuar", "product_id": pid}
                for i, pid in enumerate(ids[:4])
            ]
        result["engine"] = result.get("engine") or "groq_outfit"
        result["locale"] = loc
        return result

    async def get_perfect_match(
        self,
        user_query: str,
        db_products: list[dict[str, Any]],
    ) -> str:
        """
        Inject real PostgreSQL inventory into Groq context — no off-catalog recommendations.
        """
        composed = await self.compose_look(user_query, db_products)
        return str(composed.get("assistant_text") or "").strip()

    # ------------------------------------------------------------------ unified entry
    async def handle_message(
        self,
        user_message: str,
        db_products: list[dict[str, Any]],
    ) -> str:
        """Main entrance — universal Groq chat (chitchat, maslahat, mahsulot tavsiyasi)."""
        result = await self.run_chat_turn(user_message, db_products)
        return str(result.get("assistant_text") or "").strip()

    async def compose_look(
        self,
        user_message: str,
        db_products: list[dict[str, Any]],
        *,
        look_intent: dict[str, Any] | None = None,
        analysis: dict[str, Any] | None = None,
        history: list[dict[str, Any]] | None = None,
        session: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Full-AI look composition — Groq picks slots; no rule-based strict mixer."""
        semantic = analysis or await self.analyze_message(
            user_message,
            history=history,
            session=session,
        )
        semantic = dict(semantic)
        semantic["wants_outfit"] = True
        if look_intent:
            if look_intent.get("style"):
                semantic["style"] = infer_target_style(str(look_intent["style"]), user_message)
            if look_intent.get("max_price") is not None:
                try:
                    semantic["budget_uzs"] = int(float(look_intent["max_price"]))
                except (TypeError, ValueError):
                    pass
            if look_intent.get("category_hint"):
                semantic["gender"] = str(look_intent["category_hint"])
        return await self.run_chat_turn(
            user_message,
            db_products,
            analysis=semantic,
            history=history,
            session=session,
        )


AdvancedBozorStylist = UniversalGroqStylist
GroqStylistService = UniversalGroqStylist
GuardrailGroqStylist = UniversalGroqStylist

_groq_stylist: UniversalGroqStylist | None = None


def get_groq_stylist_service() -> UniversalGroqStylist:
    global _groq_stylist
    if _groq_stylist is None:
        _groq_stylist = UniversalGroqStylist()
    return _groq_stylist
