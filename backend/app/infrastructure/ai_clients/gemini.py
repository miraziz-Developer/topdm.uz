import io
from PIL import Image
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
            return {}

        if self._gemini_enabled:
            try:
                return await self._extract_with_gemini(image)
            except Exception:
                # fallback to Groq vision path if Gemini fails
                pass

        if isinstance(image, str):
            user_prompt = (
                "Analyze clothing from this image URL and return strict JSON with keys: "
                "category, color_hex (array), material, style_tags (array). "
                f"image_url={image}"
            )
            payload = await self._groq.chat_json(
                system_prompt="You are a fashion vision analyzer. Output JSON only.",
                user_prompt=user_prompt,
                vision=True,
            )
            return {
                "category": payload.get("category", "outfit"),
                "color": (payload.get("color_hex") or ["#808080"])[0],
                "color_hex": payload.get("color_hex", ["#808080"]),
                "material": payload.get("material", "unknown"),
                "style_tags": payload.get("style_tags", []),
            }

        pil_image = image.convert("RGB") if isinstance(image, Image.Image) else Image.open(io.BytesIO(image)).convert("RGB")
        dominant = _dominant_hex(pil_image)
        user_prompt = (
            "Extract clothing metadata from an uploaded image described by dominant color "
            f"{dominant}. Return strict JSON with category, color_hex, material, style_tags."
        )
        payload = await self._groq.chat_json(
            system_prompt="You are a fashion vision analyzer. Output JSON only.",
            user_prompt=user_prompt,
            vision=True,
        )
        return {
            "category": payload.get("category", "outfit"),
            "color": (payload.get("color_hex") or [dominant])[0],
            "color_hex": payload.get("color_hex", [dominant]),
            "material": payload.get("material", "unknown"),
            "style_tags": payload.get("style_tags", []),
        }

    async def _extract_with_gemini(self, image: bytes | str | Image.Image) -> dict:
        prompt = (
            "Extract clothing metadata and return strict JSON with keys: "
            "category, color_hex (array), material, style_tags (array)."
        )
        if isinstance(image, str):
            resp = self._gemini_model.generate_content([prompt, image])
        else:
            pil_image = image.convert("RGB") if isinstance(image, Image.Image) else Image.open(io.BytesIO(image)).convert("RGB")
            resp = self._gemini_model.generate_content([prompt, pil_image])
        text = (resp.text or "").strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        import json

        payload = json.loads(text)
        return {
            "category": payload.get("category", "outfit"),
            "color": (payload.get("color_hex") or ["#808080"])[0],
            "color_hex": payload.get("color_hex", ["#808080"]),
            "material": payload.get("material", "unknown"),
            "style_tags": payload.get("style_tags", []),
        }


def _dominant_hex(image: Image.Image) -> str:
    small = image.resize((1, 1))
    r, g, b = small.getpixel((0, 0))
    return f"#{r:02X}{g:02X}{b:02X}"
