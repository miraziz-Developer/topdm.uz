from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.ai.config import default_chat_payload, groq_chat_completions_url, require_groq_api_key, resolve_groq_agent_model
from app.core.config import get_settings

ToolHandler = Callable[[str, dict[str, Any]], Awaitable[str]]

GROQ_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "query_clothing_catalog_tool",
            "description": (
                "Live PostgreSQL + pgvector clothing catalog search. REQUIRED for price budgets "
                "(e.g. 100000 so'mgacha), categories (erkaklar/ayollar/poyabzal), and broad queries. "
                "Returns real JSON: name, price, shop floor, section. Never invent products — use this."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Uzbek search intent (e.g. erkaklar uchun kiyim, qora kurtka)",
                    },
                    "category": {
                        "type": "string",
                        "description": "Optional category hint: erkak, ayol, bola, poyabzal, aksessuar",
                    },
                    "min_price": {"type": "number", "description": "Minimum price UZS"},
                    "max_price": {"type": "number", "description": "Maximum price UZS"},
                    "sale_type": {
                        "type": "string",
                        "enum": ["Chakana", "Optom"],
                        "description": "Retail vs wholesale filter",
                    },
                    "root_category": {
                        "type": "string",
                        "description": "e.g. Matolar & Tekstil, Kiyim-kechak & Moda",
                    },
                    "sub_category": {
                        "type": "string",
                        "description": "e.g. Sarpo gazmollari, Dubay atirlari optom",
                    },
                    "market_zone": {
                        "type": "string",
                        "description": "Abu Sahiy | Ippodrom | Kozgalovka",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_details",
            "description": (
                "Search the marketplace database for clothing/products similar to the query. "
                "Always call this when the user asks to find, buy, or match items. "
                "Only products returned here may be shown to the user as catalog hits."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Uzbek or Russian search intent"},
                    "filters": {
                        "type": "object",
                        "description": "Optional filters: category (string), color (string), material (string)",
                        "additionalProperties": True,
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_store_location",
            "description": (
                "Load authoritative store/shop metadata: GPS coordinates if known, floor, section, "
                "merchant comment, and indoor navigation graph node id when assigned."
            ),
            "parameters": {
                "type": "object",
                "properties": {"store_id": {"type": "string", "description": "Shop UUID"}},
                "required": ["store_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_route",
            "description": (
                "Compute shortest indoor walking route between two navigation graph node ids "
                "for a given market and floor level. Typical entrance nodes: entrance-A ... entrance-D."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "market_slug": {"type": "string"},
                    "level": {"type": "integer"},
                    "start_node_id": {"type": "string"},
                    "goal_node_id": {"type": "string"},
                },
                "required": ["market_slug", "level", "start_node_id", "goal_node_id"],
            },
        },
    },
]


class GroqToolClient:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._url = groq_chat_completions_url()

    @property
    def model(self) -> str:
        return resolve_groq_agent_model(self._settings)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((TimeoutError, httpx.HTTPError, ValueError, KeyError)),
        reraise=True,
    )
    async def _post(self, payload: dict[str, Any], *, stream: bool = False) -> dict[str, Any]:
        require_groq_api_key(self._settings)
        payload = {**payload, "stream": stream}
        headers = {
            "Authorization": f"Bearer {require_groq_api_key(self._settings)}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self._settings.external_api_timeout_seconds) as client:
            resp = await asyncio.wait_for(
                client.post(self._url, headers=headers, json=payload),
                timeout=self._settings.external_api_timeout_seconds,
            )
            resp.raise_for_status()
            return resp.json()

    async def chat_json(self, *, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        from app.infrastructure.ai_clients.groq import GroqClient

        return await GroqClient().chat_json(system_prompt=system_prompt, user_prompt=user_prompt)

    async def run_tool_loop(
        self,
        *,
        system_prompt: str,
        messages: list[dict[str, Any]],
        on_tool_call: ToolHandler,
        max_rounds: int = 8,
    ) -> list[dict[str, Any]]:
        """Mutates `messages` in place by appending assistant + tool messages until no tool_calls."""
        current = messages
        for _ in range(max_rounds):
            payload = default_chat_payload(
                model=self.model,
                messages=[{"role": "system", "content": system_prompt}, *current],
                stream=False,
                temperature=0.15,
                tools=GROQ_TOOLS,
                tool_choice="auto",
            )
            data = await self._post(payload, stream=False)
            choice = data["choices"][0]
            msg = choice["message"]
            tool_calls = msg.get("tool_calls") or []
            assistant_msg = {
                "role": "assistant",
                "content": msg.get("content") or "",
            }
            if tool_calls:
                assistant_msg["tool_calls"] = tool_calls
            current = [*current, assistant_msg]

            if not tool_calls:
                break

            for call in tool_calls:
                fn = call.get("function") or {}
                name = fn.get("name") or ""
                raw_args = fn.get("arguments") or "{}"
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args)
                except json.JSONDecodeError:
                    args = {}
                try:
                    result = await on_tool_call(name, args)
                except Exception as exc:
                    result = json.dumps({"error": type(exc).__name__, "detail": str(exc)}, ensure_ascii=True)
                current.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id") or "tool_call",
                        "content": result if isinstance(result, str) else json.dumps(result, ensure_ascii=True),
                    }
                )

        return current
