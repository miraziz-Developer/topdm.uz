from __future__ import annotations

import asyncio
import hashlib

import httpx
import google.generativeai as genai
from loguru import logger
from openai import AsyncOpenAI
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings

_TEXT_EMBED_DIM = 1536


def _deterministic_embed(text: str, dim: int = 1536) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    base = [b / 255.0 for b in digest]
    repeated = (base * ((dim // len(base)) + 1))[:dim]
    return repeated


class EmbeddingClient:
    """Production embeddings via OpenAI; deterministic fallback for local dev without keys."""

    _fallback_warning_emitted: bool = False

    def __init__(self) -> None:
        self._settings = get_settings()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((TimeoutError, httpx.HTTPError, ValueError)),
        reraise=True,
    )
    async def embed(self, text: str) -> list[float]:
        cleaned = (text or "").strip()
        if not cleaned:
            cleaned = "empty"
        if self._settings.openai_api_key:
            client = AsyncOpenAI(api_key=self._settings.openai_api_key)
            response = await client.embeddings.create(
                model=self._settings.embedding_model,
                input=cleaned,
                dimensions=_TEXT_EMBED_DIM,
            )
            vector = list(response.data[0].embedding)
            if len(vector) != _TEXT_EMBED_DIM:
                raise ValueError(f"Unexpected embedding dimension: {len(vector)}")
            return vector
        if self._settings.google_api_key:
            return await asyncio.to_thread(self._embed_gemini_text_sync, cleaned)
        if self._settings.is_production:
            raise ValueError(
                "Production requires OPENAI_API_KEY or GOOGLE_API_KEY for text embeddings"
            )
        if not EmbeddingClient._fallback_warning_emitted:
            logger.warning(
                "embedding_fallback_deterministic reason=OPENAI_API_KEY missing; "
                "subsequent calls suppressed"
            )
            EmbeddingClient._fallback_warning_emitted = True
        return _deterministic_embed(cleaned)

    def _embed_gemini_text_sync(self, text: str) -> list[float]:
        genai.configure(api_key=self._settings.google_api_key)
        model = self._settings.gemini_embedding_model or "models/gemini-embedding-2"
        result = genai.embed_content(
            model=model,
            content=text,
            output_dimensionality=_TEXT_EMBED_DIM,
        )
        if isinstance(result, dict):
            vector = list(result.get("embedding") or [])
        else:
            vector = list(getattr(result, "embedding", []) or [])
        if len(vector) != _TEXT_EMBED_DIM:
            raise ValueError(f"Gemini text embedding dim {len(vector)} != {_TEXT_EMBED_DIM}")
        return vector
