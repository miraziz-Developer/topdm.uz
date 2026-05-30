from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any

from anthropic import AsyncAnthropic
from loguru import logger
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.infrastructure.ai_clients.groq_tools import GROQ_TOOLS, ToolHandler

_ANTHROPIC_TOOLS = [
    {
        "name": t["function"]["name"],
        "description": t["function"]["description"],
        "input_schema": t["function"]["parameters"],
    }
    for t in GROQ_TOOLS
]


class AnthropicToolClient:
    """Claude 3.5 Sonnet tool-calling loop (primary agent brain when configured)."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise ValueError("Missing ANTHROPIC_API_KEY")
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.anthropic_model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((TimeoutError, ValueError)),
        reraise=True,
    )
    async def run_tool_loop(
        self,
        *,
        system_prompt: str,
        messages: list[dict[str, Any]],
        on_tool_call: ToolHandler,
        max_rounds: int = 8,
    ) -> list[dict[str, Any]]:
        anthropic_messages: list[dict[str, Any]] = []
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content")
            if role == "user":
                if isinstance(content, list):
                    anthropic_messages.append({"role": "user", "content": content})
                else:
                    anthropic_messages.append({"role": "user", "content": str(content)})
            elif role == "assistant":
                anthropic_messages.append({"role": "assistant", "content": str(content or "")})
            elif role == "tool":
                anthropic_messages.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "tool_result",
                                "tool_use_id": msg.get("tool_call_id"),
                                "content": str(content),
                            }
                        ],
                    }
                )

        for _ in range(max_rounds):
            response = await self._client.messages.create(
                model=self._model,
                max_tokens=4096,
                system=system_prompt,
                messages=anthropic_messages,
                tools=_ANTHROPIC_TOOLS,
            )
            blocks = response.content
            tool_uses = [b for b in blocks if b.type == "tool_use"]
            text_parts = [b.text for b in blocks if b.type == "text" and getattr(b, "text", None)]

            assistant_content: list[dict[str, Any]] = []
            if text_parts:
                assistant_content.append({"type": "text", "text": "\n".join(text_parts)})
            for tu in tool_uses:
                assistant_content.append(
                    {
                        "type": "tool_use",
                        "id": tu.id,
                        "name": tu.name,
                        "input": tu.input,
                    }
                )
            anthropic_messages.append({"role": "assistant", "content": assistant_content})

            if not tool_uses:
                break

            tool_results: list[dict[str, Any]] = []
            for tu in tool_uses:
                args = tu.input if isinstance(tu.input, dict) else {}
                try:
                    result = await on_tool_call(tu.name, args)
                except Exception as exc:
                    logger.warning("tool_call_failed", tool=tu.name, error=str(exc))
                    result = json.dumps({"error": type(exc).__name__, "detail": str(exc)}, ensure_ascii=True)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": result if isinstance(result, str) else json.dumps(result, ensure_ascii=True),
                    }
                )
            anthropic_messages.append({"role": "user", "content": tool_results})

        flat: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        for msg in anthropic_messages:
            flat.append(msg)
        return flat

    async def chat_json(self, *, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = "".join(b.text for b in response.content if b.type == "text")
        cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
