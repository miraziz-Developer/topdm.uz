from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings


class GroqClient:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._base_url = "https://api.groq.com/openai/v1/chat/completions"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((TimeoutError, httpx.HTTPError, ValueError)),
        reraise=True,
    )
    async def chat_json(self, *, system_prompt: str, user_prompt: str, vision: bool = False) -> dict[str, Any]:
        if not self._settings.groq_api_key:
            raise ValueError("Missing GROQ_API_KEY")
        model = self._settings.groq_vision_model if vision else self._settings.groq_model
        payload = {
            "model": model,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        headers = {
            "Authorization": f"Bearer {self._settings.groq_api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self._settings.external_api_timeout_seconds) as client:
            response = await asyncio.wait_for(
                client.post(self._base_url, headers=headers, json=payload),
                timeout=self._settings.external_api_timeout_seconds,
            )
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        cleaned = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
