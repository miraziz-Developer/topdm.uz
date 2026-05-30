"""Gemini multimodal image embeddings (Taobao-grade visual search)."""

from __future__ import annotations

import asyncio

import google.generativeai as genai
from loguru import logger

from app.core.config import get_settings
from app.infrastructure.ai_clients.gemini import _guess_mime

VISUAL_EMBED_DIM = 768


class GeminiVisualEmbedder:
    """Uses models/gemini-embedding-2 — text + image → 768-d vector."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._model = getattr(self._settings, "gemini_embedding_model", None) or "models/gemini-embedding-2"

    @property
    def enabled(self) -> bool:
        return bool(self._settings.google_api_key)

    async def embed_image(self, image_bytes: bytes, *, hint: str = "fashion product clothing") -> list[float]:
        if not self.enabled:
            raise RuntimeError("GOOGLE_API_KEY required for Gemini visual embeddings")
        mime = _guess_mime(image_bytes)
        return await asyncio.to_thread(self._embed_sync, image_bytes, mime, hint)

    def _embed_sync(self, image_bytes: bytes, mime: str, hint: str) -> list[float]:
        genai.configure(api_key=self._settings.google_api_key)
        # Image + short hint improves retrieval vs image-only
        content = {
            "parts": [
                {"text": hint},
                {"inline_data": {"mime_type": mime, "data": image_bytes}},
            ]
        }
        result = genai.embed_content(
            model=self._model,
            content=content,
            output_dimensionality=VISUAL_EMBED_DIM,
        )
        if isinstance(result, dict):
            vector = list(result.get("embedding") or [])
        else:
            vector = list(getattr(result, "embedding", []) or [])
        if len(vector) != VISUAL_EMBED_DIM:
            raise ValueError(f"Gemini visual embedding dim {len(vector)} != {VISUAL_EMBED_DIM}")
        return vector


def average_normalized_vectors(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return []
    if len(vectors) == 1:
        return vectors[0]
    dim = len(vectors[0])
    acc = [0.0] * dim
    for vec in vectors:
        for i, v in enumerate(vec):
            acc[i] += v
    n = float(len(vectors))
    acc = [v / n for v in acc]
    norm = sum(v * v for v in acc) ** 0.5 or 1.0
    return [v / norm for v in acc]


async def embed_product_catalog_image(
    image_bytes: bytes | None,
    *,
    text_hint: str,
    fallback_signature_fn,
) -> tuple[list[float], str]:
    """
    Returns (vector, source) where source is 'gemini' | 'signature'.
    """
    settings = get_settings()
    embedder = GeminiVisualEmbedder()
    if embedder.enabled and image_bytes:
        try:
            return await embedder.embed_image(image_bytes, hint=text_hint), "gemini"
        except Exception as exc:
            if settings.is_production:
                raise RuntimeError("Gemini visual embedding failed in production") from exc
            logger.warning("gemini_visual_embed_failed", error=str(exc)[:200])
    if settings.is_production:
        raise RuntimeError("GOOGLE_API_KEY required for product visual embeddings in production")
    if image_bytes:
        return fallback_signature_fn(image_bytes), "signature"
    return fallback_signature_fn(text_hint.encode("utf-8")), "signature"
