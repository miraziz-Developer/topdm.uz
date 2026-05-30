from __future__ import annotations

from typing import Any


RATE_LIMIT_SUGGESTIONS = [
    "Kutib turing yoki do'konlar ro'yxatiga o'ting",
    "Qisqa savol bilan qayta urinib ko'ring",
    "Katalogdan filtrlash orqali qidiruvni davom ettiring",
]

GENERIC_SUGGESTIONS = [
    "Kutib turing yoki do'konlar ro'yxatiga o'ting",
    "Mahsulot nomi yoki rangini aniqroq yozing",
    "Boshqa kalit so'z bilan qidiring",
]


def is_rate_limit_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    return any(token in text for token in ("rate limit", "429", "quota", "too many requests"))


def build_llm_error_payload(
    *,
    code: str = "llm_unavailable",
    message: str = "AI xizmati vaqtincha band. Iltimos, birozdan keyin qayta urinib ko'ring.",
    exc: BaseException | None = None,
) -> dict[str, Any]:
    suggestions = RATE_LIMIT_SUGGESTIONS if exc and is_rate_limit_error(exc) else GENERIC_SUGGESTIONS
    return {
        "detail": message,
        "code": code,
        "suggestions": suggestions,
        "retryable": True,
    }
