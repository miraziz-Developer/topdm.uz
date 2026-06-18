from __future__ import annotations

import asyncio
import base64
import binascii
import io
import json
import re
import warnings

from loguru import logger
from PIL import Image
with warnings.catch_warnings():
    warnings.simplefilter("ignore", category=FutureWarning)
    import google.generativeai as genai
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.infrastructure.ai_clients.groq import GroqClient


class GeminiClient:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._groq = GroqClient()
        self._gemini_enabled = bool(self._settings.google_api_key)
        if self._gemini_enabled:
            genai.configure(api_key=self._settings.google_api_key)
            self._gemini_model = genai.GenerativeModel(self._settings.gemini_model)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((TimeoutError, ValueError)),
        reraise=True,
    )
    async def extract_attributes(self, image: bytes | str | Image.Image) -> dict:
        if not image:
            if self._settings.is_production:
                raise ValueError("Empty image payload")
            return _local_fallback_from_bytes(b"")

        raw_bytes, pil_image = _normalize_image_input(image)
        if not raw_bytes:
            if self._settings.is_production:
                raise ValueError("Could not decode image payload")
            return _local_fallback_from_bytes(b"")

        if self._gemini_enabled:
            try:
                return await self._extract_with_gemini(pil_image or raw_bytes)
            except Exception as exc:
                logger.warning(
                    f"gemini_vision_failed kind={type(exc).__name__} detail={str(exc)[:200]}"
                )

        if self._settings.groq_api_key:
            try:
                return await self._extract_with_groq(raw_bytes, pil_image)
            except Exception as exc:
                logger.warning(
                    f"groq_vision_failed kind={type(exc).__name__} detail={str(exc)[:200]}"
                )

        return _local_fallback_from_bytes(raw_bytes, pil_image)

    async def _extract_with_groq(self, raw_bytes: bytes, pil_image: Image.Image | None) -> dict:
        dominant = _dominant_hex(pil_image) if pil_image else "#808080"
        user_prompt = (
            "Analyze this clothing/product photo. Return strict JSON with keys: "
            "category, color_hex (array of hex strings), material, style_tags (array)."
        )
        mime = _guess_mime(raw_bytes)
        payload = await self._groq.chat_json(
            system_prompt="You are a fashion vision analyzer. Output JSON only.",
            user_prompt=user_prompt,
            vision=True,
            image_bytes=raw_bytes,
            image_mime=mime,
        )
        return _normalize_vision_payload(payload, fallback_color=dominant)

    async def _extract_with_gemini(self, image: bytes | str | Image.Image) -> dict:
        prompt = (
            "Extract clothing metadata and return strict JSON with keys: "
            "category, color_hex (array), material, style_tags (array)."
        )

        def _run() -> dict:
            if isinstance(image, str):
                resp = self._gemini_model.generate_content([prompt, image])
            elif isinstance(image, Image.Image):
                resp = self._gemini_model.generate_content([prompt, image.convert("RGB")])
            else:
                pil_image = Image.open(io.BytesIO(image)).convert("RGB")
                resp = self._gemini_model.generate_content([prompt, pil_image])
            text = (resp.text or "").strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            payload = json.loads(text)
            return _normalize_vision_payload(payload)

        return await asyncio.wait_for(asyncio.to_thread(_run), timeout=25.0)


def _normalize_image_input(image: bytes | str | Image.Image) -> tuple[bytes, Image.Image | None]:
    if isinstance(image, Image.Image):
        buf = io.BytesIO()
        image.convert("RGB").save(buf, format="JPEG", quality=85)
        return buf.getvalue(), image.convert("RGB")
    if isinstance(image, str):
        decoded = _decode_data_url(image)
        if decoded is None:
            return b"", None
        image = decoded
    try:
        pil = Image.open(io.BytesIO(image)).convert("RGB")
        buf = io.BytesIO()
        pil.save(buf, format="JPEG", quality=85)
        return buf.getvalue(), pil
    except Exception:
        return bytes(image), None


def _normalize_vision_payload(payload: dict, *, fallback_color: str = "#808080") -> dict:
    color_hex = payload.get("color_hex") or [fallback_color]
    if isinstance(color_hex, str):
        color_hex = [color_hex]
    return {
        "category": str(payload.get("category") or "kiyim"),
        "color": str(payload.get("color") or color_hex[0] or fallback_color),
        "color_hex": [str(c) for c in color_hex if c],
        "material": str(payload.get("material") or "unknown"),
        "style_tags": [str(t) for t in (payload.get("style_tags") or []) if t],
    }


def _local_fallback_from_bytes(raw_bytes: bytes, pil_image: Image.Image | None = None) -> dict:
    try:
        pil = pil_image or Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        dominant = _dominant_hex(pil)
    except Exception:
        dominant = "#808080"
    return {
        "category": "kiyim",
        "color": dominant,
        "color_hex": [dominant],
        "material": "unknown",
        "style_tags": ["visual-search"],
    }


def _guess_mime(raw: bytes) -> str:
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if raw[:3] == b"GIF":
        return "image/gif"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


def _decode_data_url(value: str) -> bytes | None:
    if not value.startswith("data:"):
        return None
    match = re.match(r"data:image/[^;]+;base64,(.+)", value, flags=re.DOTALL)
    if not match:
        return None
    try:
        return base64.b64decode(match.group(1), validate=True)
    except (ValueError, binascii.Error):
        return None


def _dominant_hex(image: Image.Image) -> str:
    small = image.resize((1, 1))
    r, g, b = small.getpixel((0, 0))
    return f"#{r:02X}{g:02X}{b:02X}"
