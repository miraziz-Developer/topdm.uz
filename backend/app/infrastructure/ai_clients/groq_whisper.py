from __future__ import annotations

import io

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings

GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


class GroqWhisperClient:
    """Fast Groq Whisper — ovozli qidiruv uchun (OpenAI dan tezroq).

    Groq'ning haqiqiy audio manziliga to'g'ridan-to'g'ri boradi (Azure'da
    audio deployment yo'q) — shuning uchun har doim RAW groq_api_key
    ishlatiladi, Azure faol bo'lganda kalitni almashtiradigan
    iter_groq_api_keys()/require_groq_api_key() emas.
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        if not self._settings.groq_api_key.strip():
            raise ValueError("Missing GROQ_API_KEY — voice transcription requires Groq Cloud.")

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type((TimeoutError, httpx.HTTPError, ValueError)),
        reraise=True,
    )
    async def transcribe(self, audio_bytes: bytes, *, filename: str = "voice.webm") -> str:
        buf = io.BytesIO(audio_bytes)
        files = {"file": (filename, buf, "audio/webm")}
        data = {
            "model": "whisper-large-v3-turbo",
            "language": "uz",
            "response_format": "json",
            "temperature": "0",
        }
        headers = {"Authorization": f"Bearer {self._settings.groq_api_key.strip()}"}
        timeout = min(25.0, self._settings.external_api_timeout_seconds + 5)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(GROQ_TRANSCRIBE_URL, headers=headers, files=files, data=data)
            response.raise_for_status()
            payload = response.json()
        text = str(payload.get("text") or "").strip()
        if not text:
            raise ValueError("Empty transcription")
        return text
