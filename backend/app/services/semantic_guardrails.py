"""
Semantic guardrails — age group + style/function matrix before outfit mixing.

Prevents cross-contamination (e.g. adult gym wear with children's school uniforms).
"""

from __future__ import annotations

from typing import Any

ALLOWED_AGE_GROUPS = frozenset({"adult", "kids"})
ALLOWED_STYLE_TAGS = frozenset({"sport", "casual", "classic", "formal", "gym"})

KIDS_PRODUCT_MARKERS = (
    "bolalar",
    "bola ",
    " bola",
    "kids",
    "o'g'il bola",
    "qiz bola",
    "maktab formasi",
    "maktab",
    "school uniform",
    "o'quvchi",
    "maktab kechasi",
)
KIDS_USER_MARKERS = (
    "bolalar",
    "bola ",
    "kids",
    "maktab",
    "maktabga",
    "o'quvchi",
    "school",
)
ADULT_USER_MARKERS = ("erkak", "erkaklar", "ayol", "ayollar", "katta", "adult")

SCHOOL_UNIFORM_MARKERS = (
    "maktab",
    "maktab formasi",
    "forma",
    "school uniform",
    "o'quvchi",
    "maktab kechasi",
)
GYM_SPORT_MARKERS = (
    "gym",
    "sport",
    "trening",
    "fitnes",
    "fitness",
    "krossovka",
    "futbol",
    "workout",
    "zal",
    "jogger",
)
SPORT_PRODUCT_MARKERS = GYM_SPORT_MARKERS + (
    "majmua",
    "futbolka",
    "sport kostyum",
    "kross",
)
NON_SPORT_TOP_MARKERS = ("ko'ylak oq", "klassik ko'ylak", "ofis ko'ylak", "sarpo", "kelin")
NON_SPORT_BOTTOM_MARKERS = ("chino", "klassik shim", "kostyum shim")
GENDER_ERKAK_MARKERS = ("erkak", "erkaklar", "o'g'il bola", "men ")
GENDER_AYOL_MARKERS = ("ayol", "ayollar", "qiz ", " qiz", "kelin", "ayollar uchun")
FORMAL_MARKERS = ("rasmiy", "kostyum", "klassik tufli", "ofis", "formal")


def _blob(product: dict[str, Any]) -> str:
    parts = [
        str(product.get("name") or ""),
        str(product.get("category") or ""),
        str(product.get("root_category") or ""),
        str(product.get("sub_category") or ""),
        str(product.get("style") or ""),
        str(product.get("age_group") or ""),
    ]
    return " ".join(parts).lower()


def normalize_age_group(raw: str | None, user_message: str = "") -> str:
    value = (raw or "").strip().lower()
    if value in ALLOWED_AGE_GROUPS:
        return value
    text = (user_message or "").lower()
    if any(m in text for m in KIDS_USER_MARKERS) and not any(m in text for m in ADULT_USER_MARKERS):
        return "kids"
    return "adult"


def normalize_style_tag(raw: str | None, user_message: str = "") -> str:
    value = (raw or "").strip().lower()
    text = f"{value} {user_message}".lower()
    if value == "gym" or any(m in text for m in ("gym", "zal", "trening", "fitnes")):
        return "gym"
    if value in ("sport", "casual", "classic", "formal"):
        return value
    if any(m in text for m in GYM_SPORT_MARKERS):
        return "gym" if "gym" in text or "zal" in text else "sport"
    if any(m in text for m in FORMAL_MARKERS):
        return "formal"
    return "casual"


def infer_product_age_group(product: dict[str, Any]) -> str:
    explicit = str(product.get("age_group") or "").strip().lower()
    if explicit in ALLOWED_AGE_GROUPS:
        return explicit
    blob = _blob(product)
    if any(m in blob for m in KIDS_PRODUCT_MARKERS):
        return "kids"
    return "adult"


def infer_product_style_tag(product: dict[str, Any]) -> str:
    explicit = str(product.get("style") or "").strip().lower()
    if explicit in ALLOWED_STYLE_TAGS:
        return explicit
    blob = _blob(product)
    if any(m in blob for m in ("maktab", "forma", "school")):
        return "classic"
    if any(m in blob for m in ("krossovka", "trening", "sport", "futbolka", "gym")):
        return "gym" if "gym" in blob or "trening" in blob else "sport"
    if any(m in blob for m in ("kostyum", "tufli", "rasmiy")):
        return "formal"
    return "casual"


def parse_guardrail_meta_from_text(user_message: str) -> dict[str, Any]:
    """Deterministic pre-parse (works offline if Groq fails)."""
    age = normalize_age_group(None, user_message)
    style = normalize_style_tag(None, user_message)
    gender = normalize_gender(None, user_message)
    return {"style": style, "age_group": age, "gender": gender}


def normalize_gender(raw: str | None, user_message: str = "") -> str:
    value = (raw or "").strip().lower()
    text = (user_message or "").lower()
    if value in ("erkak", "male", "men"):
        return "erkak"
    if value in ("ayol", "female", "women", "woman"):
        return "ayol"
    if any(m in text for m in GENDER_AYOL_MARKERS) and not any(m in text for m in GENDER_ERKAK_MARKERS):
        return "ayol"
    if any(m in text for m in GENDER_ERKAK_MARKERS):
        return "erkak"
    return "unisex"


def infer_product_gender(product: dict[str, Any]) -> str:
    attrs = product.get("attributes")
    if isinstance(attrs, dict):
        g = str(attrs.get("gender") or "").strip().lower()
        if g in ("erkak", "male", "men"):
            return "erkak"
        if g in ("ayol", "female", "women", "woman"):
            return "ayol"
        if g == "bolalar":
            return "kids"
    blob = _blob(product)
    if any(m in blob for m in ("ayol", "kelin", "kechki libos", "platye")):
        return "ayol"
    if any(m in blob for m in ("erkak", "o'g'il")):
        return "erkak"
    if any(m in blob for m in KIDS_PRODUCT_MARKERS):
        return "kids"
    return "unisex"


def merge_guardrail_meta(groq_meta: dict[str, Any], user_message: str) -> dict[str, Any]:
    local = parse_guardrail_meta_from_text(user_message)
    style = normalize_style_tag(
        str(groq_meta.get("style") or groq_meta.get("target_style") or local["style"]),
        user_message,
    )
    age = normalize_age_group(str(groq_meta.get("age_group") or local["age_group"]), user_message)
    gender = normalize_gender(str(groq_meta.get("gender") or groq_meta.get("category_hint") or ""), user_message)
    budget = groq_meta.get("budget") or groq_meta.get("max_budget")
    out: dict[str, Any] = {"style": style, "age_group": age, "gender": gender}
    if budget is not None:
        try:
            out["budget"] = int(float(budget))
        except (TypeError, ValueError):
            pass
    return out


def filter_db_by_guardrails(
    db_products: list[dict[str, Any]],
    meta: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Hard shield: drop catalog rows that violate age group or style/function intent.
    """
    target_age = normalize_age_group(str(meta.get("age_group") or "adult"))
    target_style = normalize_style_tag(str(meta.get("style") or "casual"))
    target_gender = normalize_gender(str(meta.get("gender") or ""), str(meta.get("_user_blob") or ""))
    sport_like = target_style in ("gym", "sport")
    school_like = target_style in ("classic", "formal") and any(
        m in str(meta.get("_user_blob") or "").lower() for m in ("maktab", "school", "forma")
    )

    filtered: list[dict[str, Any]] = []
    for product in db_products:
        blob = _blob(product)
        p_age = infer_product_age_group(product)
        p_style = infer_product_style_tag(product)

        # Age group walls
        if target_age == "adult" and p_age == "kids":
            continue
        if target_age == "kids" and p_age == "adult":
            continue

        # Gym/sport must not pull school uniforms or office wear
        if sport_like and any(m in blob for m in SCHOOL_UNIFORM_MARKERS):
            continue
        if sport_like and any(m in blob for m in NON_SPORT_TOP_MARKERS + NON_SPORT_BOTTOM_MARKERS):
            if not any(m in blob for m in SPORT_PRODUCT_MARKERS):
                continue
        if sport_like and "ko'ylak" in blob and "sport" not in blob and "futbolka" not in blob:
            continue
        if sport_like and "sviter" in blob and "sport" not in blob and "trening" not in blob:
            continue
        if sport_like and ("chino" in blob or "klassik shim" in blob) and "sport" not in blob:
            continue

        # Gender consistency (erkak / ayol aralashmasin)
        if target_gender in ("erkak", "ayol"):
            p_gender = infer_product_gender(product)
            if p_gender == "kids":
                continue
            if p_gender in ("erkak", "ayol") and p_gender != target_gender:
                continue

        # School/formal intent must not pull gym kits
        if school_like and any(m in blob for m in ("trening", "fitnes", "gym", "sport kostyum")):
            continue
        if school_like and p_style in ("gym", "sport") and not any(m in blob for m in SCHOOL_UNIFORM_MARKERS):
            continue

        # Kids request: block adult-only keywords in title
        if target_age == "kids" and any(m in blob for m in ("erkaklar kostyumi", "erkak kostyum")):
            continue

        # Style tag mismatch (soft — only when both sides are explicit and conflicting)
        if (
            target_style in ("gym", "sport")
            and p_style in ("formal",)
            and not any(m in blob for m in GYM_SPORT_MARKERS)
        ):
            continue

        filtered.append(product)

    return filtered
