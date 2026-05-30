"""Rich Taobao-style text fingerprint from a clothing crop (boosts text+visual fusion)."""

from __future__ import annotations

from typing import Any

from app.infrastructure.ai_clients.gemini import GeminiClient, _guess_mime
from app.infrastructure.ai_clients.groq import GroqClient
from app.core.config import get_settings


async def build_taobao_fingerprint(crop_bytes: bytes, *, label_uz: str = "", category: str = "") -> str:
    """Short multilingual search phrase: color + gender + garment + style (UZ + EN tokens)."""
    settings = get_settings()
    prompt = (
        "Taobao visual search fingerprint. Describe ONLY the clothing item in this crop. "
        "Return JSON: {\"uz\":\"...\",\"en\":\"...\",\"color\":\"sariq\",\"gender\":\"ayol\","
        "\"garment\":\"sport sviter\",\"keywords\":[\"sariq\",\"yellow\",\"women\",\"hoodie\"]}. "
        "Max 12 keywords. color in Uzbek."
    )
    payload: dict[str, Any] | None = None
    if settings.groq_api_key:
        try:
            payload = await GroqClient().chat_json(
                system_prompt="Fashion visual search. JSON only.",
                user_prompt=prompt,
                vision=True,
                image_bytes=crop_bytes,
                image_mime=_guess_mime(crop_bytes),
            )
        except Exception:
            payload = None
    if not payload:
        try:
            vision = await GeminiClient().extract_attributes(crop_bytes)
            if isinstance(vision, dict):
                parts = [
                    str(vision.get("color") or ""),
                    str(vision.get("category") or ""),
                    " ".join(str(t) for t in (vision.get("style_tags") or [])),
                ]
                return " ".join(p for p in parts if p).strip() or label_uz
        except Exception:
            pass
        return label_uz or category or "kiyim"

    if not isinstance(payload, dict):
        return label_uz or "kiyim"
    kw = payload.get("keywords") or []
    if isinstance(kw, list):
        tokens = [str(k).strip() for k in kw if str(k).strip()]
    else:
        tokens = []
    for key in ("uz", "en", "color", "garment", "gender"):
        val = str(payload.get(key) or "").strip()
        if val:
            tokens.append(val)
    if label_uz:
        tokens.append(label_uz)
    if category:
        tokens.append(category)
    return " ".join(dict.fromkeys(tokens))
