"""Live catalog query translation with AI fallback (Groq/Gemini → regex/dictionary)."""
from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import quote

import httpx

from app.application.agents.bozor_chat_catalog import parse_bazaar_intent, parse_category_hint
from app.application.ai.llm_errors import is_rate_limit_error
from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

# Lightweight uz/en token map when cloud translation is unavailable.
_STATIC_UZ_EN: dict[str, str] = {
    "mayka": "t-shirt",
    "futbolka": "t-shirt",
    "tursik": "underwear",
    "shim": "pants",
    "koylak": "dress",
    "ko'ylak": "dress",
    "kurtka": "jacket",
    "poyabzal": "shoes",
    "krossovka": "sneakers",
    "sumka": "bag",
    "atir": "perfume",
    "erkak": "men",
    "ayol": "women",
    "bolalar": "kids",
    "arzon": "cheap",
    "qimmat": "premium",
}


def _regex_dictionary_translate(text: str) -> str:
    lowered = (text or "").strip().lower()
    if not lowered:
        return ""
    if re.search(r"[a-zA-Z]", lowered) and not re.search(r"[\u0400-\u04FF\u0600-\u06FF]", lowered):
        return text.strip()
    tokens = re.findall(r"[\w']+", lowered, flags=re.UNICODE)
    out: list[str] = []
    for tok in tokens:
        out.append(_STATIC_UZ_EN.get(tok, tok))
    return " ".join(out).strip() or text.strip()


def _capture_sentry(exc: BaseException, *, operation: str) -> None:
    try:
        import sentry_sdk

        sentry_sdk.capture_exception(
            exc,
            tags={"pipeline": "live_catalog", "operation": operation},
        )
    except Exception:
        logger.debug("sentry_capture_skipped", exc_info=True)


class LiveCatalogService:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._timeout = float(self._settings.external_api_timeout_seconds)

    def parse_catalog_intent(self, query: str) -> dict[str, Any]:
        """Regex/dictionary bazaar filters — never raises."""
        text = (query or "").strip()
        intent = parse_bazaar_intent(text)
        category = parse_category_hint(text)
        if category and not intent.get("category_hint"):
            intent["category_hint"] = category
        intent["normalized_query"] = _regex_dictionary_translate(text) or text
        return intent

    async def _google_translate(self, text: str, *, target: str) -> str | None:
        url = (
            "https://translate.googleapis.com/translate_a/single"
            f"?client=gtx&sl=auto&tl={target}&dt=t&q={quote(text)}"
        )
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(url)
        if resp.status_code >= 400:
            return None
        data = resp.json()
        if isinstance(data, list) and data and isinstance(data[0], list):
            parts = [row[0] for row in data[0] if isinstance(row, list) and row[0]]
            joined = "".join(str(p) for p in parts).strip()
            return joined or None
        return None

    async def _groq_translate(self, text: str) -> str | None:
        keys = [
            k.strip()
            for k in (
                self._settings.groq_api_key,
                getattr(self._settings, "groq_api_key_backup", ""),
            )
            if k.strip()
        ]
        if not keys:
            return None
        from app.ai.config import groq_chat_completions_url, resolve_groq_chat_model

        payload = {
            "model": resolve_groq_chat_model(self._settings),
            "messages": [
                {
                    "role": "system",
                    "content": "Translate Uzbek/Russian shopping queries to concise English search keywords. Reply with keywords only.",
                },
                {"role": "user", "content": text},
            ],
            "temperature": 0,
        }
        url = groq_chat_completions_url()
        last_exc: BaseException | None = None
        for api_key in keys:
            try:
                headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 429:
                    raise httpx.HTTPStatusError("rate limit", request=resp.request, response=resp)
                if resp.status_code == 401:
                    raise ValueError("invalid_api_key")
                resp.raise_for_status()
                data = resp.json()
                content = (
                    (data.get("choices") or [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )
                cleaned = str(content).strip()
                return cleaned or None
            except Exception as exc:
                last_exc = exc
                if is_rate_limit_error(exc) or "invalid_api_key" in str(exc).lower():
                    continue
                raise
        if last_exc:
            raise last_exc
        return None

    async def translate_search_query(self, query: str) -> str:
        """
        Best-effort uz → en for live catalog / Taobao search.
        On rate-limit or missing keys: log to Sentry and fall back to regex dictionary.
        """
        raw = (query or "").strip()
        if not raw:
            return ""
        if re.search(r"[a-zA-Z]", raw) and not re.search(r"[\u0400-\u04FF\u0600-\u06FF]", raw):
            return raw

        try:
            groq_hit = await self._groq_translate(raw)
            if groq_hit:
                return groq_hit
        except Exception as exc:
            _capture_sentry(exc, operation="groq_translate")
            logger.warning(
                "live_catalog_groq_translate_failed",
                extra={"error": str(exc), "rate_limit": is_rate_limit_error(exc)},
            )

        try:
            for target in ("en", "zh-CN"):
                hit = await self._google_translate(raw, target=target)
                if hit:
                    return hit
        except httpx.HTTPError as exc:
            _capture_sentry(exc, operation="google_translate")
            logger.warning("live_catalog_google_translate_failed", extra={"error": str(exc)})

        fallback = _regex_dictionary_translate(raw)
        logger.info("live_catalog_translate_fallback", extra={"query_len": len(raw)})
        return fallback or raw
