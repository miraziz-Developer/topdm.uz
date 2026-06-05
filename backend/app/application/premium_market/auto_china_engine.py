from __future__ import annotations

import re
from typing import Any

import httpx
from loguru import logger

from app.application.premium_market.china_demo_fixtures import demo_auto_search
from app.application.premium_market.pricing import round_up_uzs
from app.application.premium_market.taobao_client import (
    TaobaoDataHubClient,
    TaobaoDataHubError,
    _collect_images,
    _parse_price,
)
from app.core.config import Settings
from app.schemas.premium_market import AutoSearchItem, MarketAutoSearchResponse


class AutoChinaMarketError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


DEFAULT_WEIGHT_KG = 0.5
CARGO_USD_TO_UZS = 12700


class AutoChinaMarketEngine:
    """O'zbekcha so'rov → tarjima → Taobao qidiruv → yakuniy narx (UZS)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._timeout = float(settings.external_api_timeout_seconds)

    def _require_rapidapi(self) -> None:
        if not self._settings.rapidapi_key.strip():
            raise AutoChinaMarketError("config_missing", "RAPIDAPI_KEY sozlanmagan")

    async def _translate_uz_to_en(self, text: str) -> str:
        """Live catalog service: Groq → Google → regex dictionary (no 500 on rate limit)."""
        from app.application.import_pipeline.live_catalog_service import LiveCatalogService

        return await LiveCatalogService(self._settings).translate_search_query(text)

    def calculate_total_price_uzs(self, price_cny: float, *, weight_kg: float = DEFAULT_WEIGHT_KG) -> int:
        """
        Total = (CNY * rate * 1.15) + (weight * cargo_usd_kg * 12700)
        Yakuniy: ceil(total/1000)*1000
        """
        rate = float(self._settings.premium_cny_to_uzs_rate)
        margin_mult = float(self._settings.premium_margin_multiplier)
        cargo_usd_kg = float(self._settings.premium_cargo_rate_usd_per_kg)
        w = max(0.1, float(weight_kg or DEFAULT_WEIGHT_KG))

        product_uzs = float(price_cny) * rate * margin_mult
        cargo_uzs = w * cargo_usd_kg * CARGO_USD_TO_UZS
        subtotal = product_uzs + cargo_uzs
        step = int(self._settings.premium_price_round_uzs)
        return round_up_uzs(subtotal, step)

    def _normalize_search_row(self, row: dict[str, Any]) -> AutoSearchItem | None:
        item_id = (
            str(row.get("itemId") or row.get("item_id") or row.get("num_iid") or row.get("id") or "")
            .strip()
        )
        if not item_id or not item_id.isdigit():
            nested = row.get("item") if isinstance(row.get("item"), dict) else None
            if nested:
                return self._normalize_search_row(nested)
            return None

        title = str(row.get("title") or row.get("name") or row.get("item_title") or "").strip()
        images = _collect_images(row) if isinstance(row, dict) else []
        image_url = images[0] if images else str(row.get("pic_url") or row.get("image") or row.get("img") or "").strip()
        price_cny = _parse_price(
            row.get("price")
            or row.get("promotion_price")
            or row.get("originPrice")
            or row.get("priceWap")
            or row.get("zk_final_price")
        )
        total = self.calculate_total_price_uzs(price_cny)
        return AutoSearchItem(
            item_id=item_id,
            title=title or f"Taobao #{item_id}",
            image_url=image_url,
            price_cny=round(price_cny, 2),
            total_price_uzs=total,
            source_url=f"https://item.taobao.com/item.htm?id={item_id}",
        )

    def _extract_search_items(self, payload: Any) -> list[dict[str, Any]]:
        if not isinstance(payload, dict):
            return []
        candidates: list[Any] = []
        for key in ("items", "item", "products", "result", "data", "list", "itemList"):
            val = payload.get(key)
            if isinstance(val, list):
                candidates.extend(val)
            elif isinstance(val, dict):
                for sub in ("items", "item", "list", "data", "products"):
                    inner = val.get(sub)
                    if isinstance(inner, list):
                        candidates.extend(inner)
        if not candidates and isinstance(payload.get("data"), dict):
            return self._extract_search_items(payload["data"])
        return [x for x in candidates if isinstance(x, dict)]

    async def auto_discover_products(
        self,
        user_query: str,
        page: int = 1,
    ) -> MarketAutoSearchResponse:
        query = (user_query or "").strip()
        if not query:
            raise AutoChinaMarketError("invalid_query", "Qidiruv so'zi bo'sh")

        if self._settings.premium_china_demo_mode:
            return demo_auto_search(self._settings, query, page)

        self._require_rapidapi()
        translated = await self._translate_uz_to_en(query)
        search_term = translated or query
        page_num = max(1, int(page))

        client = TaobaoDataHubClient(self._settings)
        try:
            raw_hits = await client.search_items(search_term, page=page_num)
        except TaobaoDataHubError as exc:
            if exc.code == "not_subscribed" and self._settings.premium_china_demo_mode:
                return demo_auto_search(self._settings, query, page_num)
            if exc.code == "not_subscribed":
                raise AutoChinaMarketError("not_subscribed", str(exc)) from exc
            if exc.code == "rate_limit":
                raise AutoChinaMarketError("rate_limit", str(exc)) from exc
            msg = (
                "Taobao qidiruv API javob bermadi. RAPIDAPI_KEY va Taobao DataHub obunasini tekshiring."
                if exc.code in ("not_found", "upstream_error", "network")
                else str(exc)
            )
            raise AutoChinaMarketError(
                "upstream_error" if exc.code != "not_found" else "not_found",
                msg,
            ) from exc

        items: list[AutoSearchItem] = []
        seen: set[str] = set()
        for row in raw_hits:
            parsed = self._normalize_search_row(row)
            if not parsed or parsed.item_id in seen:
                continue
            seen.add(parsed.item_id)
            items.append(parsed)

        return MarketAutoSearchResponse(
            query=query,
            translated_query=search_term,
            page=page_num,
            items=items,
        )
