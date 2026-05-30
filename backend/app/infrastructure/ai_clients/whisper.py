from __future__ import annotations

import io
import logging

from openai import AsyncOpenAI
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class WhisperClient:
    """OpenAI Whisper transcription for merchant voice notes."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.openai_api_key:
            raise ValueError("Missing OPENAI_API_KEY for Whisper transcription")
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._model = settings.openai_whisper_model

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type((TimeoutError, ValueError)),
        reraise=True,
    )
    async def transcribe(self, audio_bytes: bytes, *, filename: str = "voice.ogg") -> str:
        buf = io.BytesIO(audio_bytes)
        buf.name = filename
        bazaar_prompt = (
            "Uzbek bazaar merchant listing prices and sizes for clothing. "
            "Background noise, crowd, music. Numbers in so'm, sizes S M L XL."
        )
        response = await self._client.audio.transcriptions.create(
            model=self._model,
            file=buf,
            language="uz",
            prompt=bazaar_prompt,
        )
        text = (response.text or "").strip()
        if not text:
            raise ValueError("Empty transcription")
        return text
