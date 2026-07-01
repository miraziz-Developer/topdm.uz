from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.ai.config import (
    default_chat_payload,
    groq_chat_completions_url,
    iter_groq_api_keys,
    require_groq_api_key,
    resolve_groq_chat_model,
    resolve_groq_vision_model,
)
from app.core.config import get_settings


class GroqClient:
    """Groq Cloud OpenAI-compatible client — JSON, text, and SSE token streaming."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._url = groq_chat_completions_url()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((TimeoutError, httpx.TimeoutException, httpx.ConnectError, ValueError)),
        reraise=True,
    )
    async def chat_completion(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str | None = None,
        vision: bool = False,
        stream: bool = False,
        temperature: float = 0.1,
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        keys = iter_groq_api_keys(self._settings)
        if not keys:
            raise ValueError("Missing GROQ_API_KEY — Bozorliii stylist requires Groq Cloud.")
        resolved = resolve_groq_vision_model(self._settings) if vision else (model or resolve_groq_chat_model(self._settings))
        payload = default_chat_payload(
            model=resolved,
            messages=messages,
            stream=stream,
            temperature=temperature,
            response_format=response_format,
        )
        timeout = self._settings.external_api_timeout_seconds
        last_auth_error: httpx.HTTPStatusError | None = None
        for api_key in keys:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await asyncio.wait_for(
                    client.post(self._url, headers=headers, json=payload),
                    timeout=timeout,
                )
                if response.status_code in {401, 403}:
                    last_auth_error = httpx.HTTPStatusError(
                        "groq_auth_failed",
                        request=response.request,
                        response=response,
                    )
                    continue
                response.raise_for_status()
                return response.json()
        if last_auth_error is not None:
            raise last_auth_error
        raise ValueError("Missing GROQ_API_KEY — Bozorliii stylist requires Groq Cloud.")

    async def stream_completion(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str | None = None,
        vision: bool = False,
        temperature: float = 0.15,
    ) -> AsyncIterator[str]:
        """Yield assistant text deltas (stream=True) for sub-second token delivery."""
        require_groq_api_key(self._settings)
        resolved = resolve_groq_vision_model(self._settings) if vision else (model or resolve_groq_chat_model(self._settings))
        payload = default_chat_payload(
            model=resolved,
            messages=messages,
            stream=True,
            temperature=temperature,
        )
        headers = {
            "Authorization": f"Bearer {require_groq_api_key(self._settings)}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }
        timeout = self._settings.external_api_timeout_seconds
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", self._url, headers=headers, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    piece = delta.get("content")
                    if piece:
                        yield str(piece)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((TimeoutError, httpx.HTTPError, ValueError)),
        reraise=True,
    )
    async def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        vision: bool = False,
        image_bytes: bytes | None = None,
        image_mime: str = "image/jpeg",
        model: str | None = None,
    ) -> dict[str, Any]:
        if vision and image_bytes:
            import base64

            b64 = base64.b64encode(image_bytes).decode("ascii")
            user_content: str | list[dict[str, Any]] = [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": f"data:{image_mime};base64,{b64}"}},
            ]
        else:
            user_content = user_prompt
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]
        # Vision models often reject response_format=json_object — parse JSON from text instead.
        data = await self.chat_completion(
            messages=messages,
            model=model,
            vision=vision,
            stream=False,
            temperature=0.1,
            response_format=None if vision else {"type": "json_object"},
        )
        content = data["choices"][0]["message"]["content"]
        cleaned = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)

    async def chat_json_stream_collect(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
    ) -> tuple[str, dict[str, Any]]:
        """Stream tokens, then parse accumulated JSON (stylist structured responses)."""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        parts: list[str] = []
        async for token in self.stream_completion(messages=messages, model=model, temperature=0.1):
            parts.append(token)
        raw = "".join(parts).strip()
        cleaned = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return raw, json.loads(cleaned)
