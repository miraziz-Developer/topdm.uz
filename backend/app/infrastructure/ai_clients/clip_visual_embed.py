"""Local CLIP visual embeddings via FastEmbed (ONNX) — free, no API quota."""

from __future__ import annotations

import asyncio
import io
import tempfile
import threading
from pathlib import Path

from loguru import logger
from PIL import Image

from app.core.config import get_settings

VISUAL_EMBED_DIM = 768

_model = None
_model_lock = threading.Lock()
_embed_sem: asyncio.Semaphore | None = None


def _get_embed_semaphore() -> asyncio.Semaphore:
    global _embed_sem
    if _embed_sem is None:
        _embed_sem = asyncio.Semaphore(1)
    return _embed_sem


def _get_model():
    global _model
    with _model_lock:
        if _model is None:
            from fastembed import ImageEmbedding

            settings = get_settings()
            model_name = settings.clip_image_model
            cache_dir = settings.clip_cache_dir or None
            logger.info("clip_model_loading", model=model_name, cache_dir=cache_dir)
            _model = ImageEmbedding(model_name=model_name, cache_dir=cache_dir)
            logger.info("clip_model_ready", model=model_name, dim=VISUAL_EMBED_DIM)
        return _model


def normalize_vector(vec: list[float]) -> list[float]:
    """L2 normalize — pgvector cosine similarity uchun."""
    norm = sum(v * v for v in vec) ** 0.5 or 1.0
    return [v / norm for v in vec]


class ClipVisualEmbedder:
    """Qdrant/Unicom-ViT-B-16 — 768-d, MIT, runs on CPU (ONNX)."""

    @property
    def enabled(self) -> bool:
        settings = get_settings()
        return settings.visual_search_backend == "clip"

    async def embed_image(self, image_bytes: bytes) -> list[float]:
        async with _get_embed_semaphore():
            return await asyncio.to_thread(self._embed_sync, image_bytes)

    def _embed_sync(self, image_bytes: bytes) -> list[float]:
        if not image_bytes:
            raise ValueError("Empty image for CLIP embed")
        pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        try:
            pil.save(tmp.name, format="JPEG", quality=90)
            tmp.close()
            model = _get_model()
            vec = next(model.embed([tmp.name]))
            out = normalize_vector([float(x) for x in vec])
            if len(out) != VISUAL_EMBED_DIM:
                raise ValueError(f"CLIP dim {len(out)} != {VISUAL_EMBED_DIM}")
            return out
        finally:
            try:
                Path(tmp.name).unlink(missing_ok=True)
            except OSError:
                pass


async def warmup_clip_model() -> None:
    """Load ONNX model once at startup — avoids OOM spike on first image search."""
    settings = get_settings()
    if (settings.visual_search_backend or "clip").lower() != "clip":
        return
    try:
        await asyncio.to_thread(_get_model)
        logger.info("clip_warmup_done")
    except Exception as exc:
        logger.warning("clip_warmup_failed", error=str(exc)[:200])


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
