from __future__ import annotations

import asyncio
from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.premium_market.china_demo_fixtures import demo_catalog, demo_product
from app.application.premium_market.china_showcase import DEFAULT_CHINA_CATALOG_IDS
from app.application.premium_market.pricing import calculate_china_total, calculate_local_total
from app.application.premium_market.taobao_client import (
    TaobaoDataHubClient,
    TaobaoDataHubError,
    normalize_taobao_item,
)
from app.application.merchant.product_variants import parse_variant_catalog
from app.core.config import Settings, get_settings
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.schemas.premium_market import (
    ChinaCatalogItem,
    ChinaProductPayload,
    LocalProductPayload,
    LocalShopInfo,
    MarketChinaCatalogResponse,
    MarketChinaResponse,
    MarketLocalResponse,
    SkuVariant,
)


class PremiumMarketError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


class PremiumMarketService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._repo = MarketplaceRepository(session)

    def _configured_china_ids(self) -> list[str]:
        raw = [
            x.strip()
            for x in (self._settings.premium_china_catalog_ids or "").split(",")
            if x.strip()
        ]
        return raw if raw else list(DEFAULT_CHINA_CATALOG_IDS)

    def _require_taobao_client(self) -> TaobaoDataHubClient:
        if not self._settings.rapidapi_key.strip():
            raise PremiumMarketError("config_missing", "RAPIDAPI_KEY sozlanmagan")
        return TaobaoDataHubClient(self._settings)

    async def _import_catalog_item(self, client: TaobaoDataHubClient, raw_id: str) -> ChinaCatalogItem:
        resolved = await client.resolve_item_id(raw_id)
        raw = await client.fetch_item_detail(resolved)
        norm = normalize_taobao_item(raw, resolved_id=resolved)
        pricing = calculate_china_total(
            self._settings,
            base_price_cny=float(norm["base_price_cny"] or 0),
            weight_kg=float(norm["weight_kg"] or 0.5),
        )
        images = norm["images"] or []
        return ChinaCatalogItem(
            item_id=resolved,
            title=str(norm["title"] or ""),
            image_url=images[0] if images else "",
            total_price_uzs=int(pricing.total_price_uzs),
            base_price_cny=float(norm["base_price_cny"] or 0),
            source_url=norm.get("source_url"),
        )

    async def import_china_catalog_item(self, item_id: str) -> ChinaCatalogItem:
        client = self._require_taobao_client()
        try:
            return await self._import_catalog_item(client, item_id)
        except TaobaoDataHubError as exc:
            code = "not_found" if exc.code == "not_found" else "upstream_error"
            raise PremiumMarketError(code, str(exc)) from exc

    async def list_china_catalog(self, extra_ids: list[str] | None = None) -> MarketChinaCatalogResponse:
        """Taobao API orqali ID bo'yicha import — vitrina + qo'shimcha qidiruv IDlari."""
        if self._settings.premium_china_demo_mode:
            return demo_catalog(self._settings)
        client = self._require_taobao_client()

        base_ids = self._configured_china_ids()
        merged: list[str] = []
        seen: set[str] = set()
        for token in [*base_ids, *(extra_ids or [])]:
            t = token.strip()
            if not t or t in seen:
                continue
            seen.add(t)
            merged.append(t)

        sem = asyncio.Semaphore(3)
        errors: list[str] = []

        async def one(raw_id: str) -> ChinaCatalogItem | None:
            async with sem:
                try:
                    return await self._import_catalog_item(client, raw_id)
                except TaobaoDataHubError as exc:
                    errors.append(f"{raw_id}: {exc}")
                    logger.warning("china_catalog_import_failed id={} err={}", raw_id, exc)
                    return None
                except Exception as exc:
                    errors.append(f"{raw_id}: import xatosi")
                    logger.exception("china_catalog_import_failed id={}", raw_id)
                    return None

        results = await asyncio.gather(*(one(i) for i in merged[:24]))
        items = [row for row in results if row is not None]
        return MarketChinaCatalogResponse(items=items, errors=errors)

    async def get_china_product(self, item_id: str) -> MarketChinaResponse:
        if self._settings.premium_china_demo_mode:
            demo = demo_product(self._settings, item_id.strip())
            if demo:
                return demo
            raise PremiumMarketError("not_found", "Demo tovar topilmadi")
        client = self._require_taobao_client()
        try:
            resolved = await client.resolve_item_id(item_id)
            raw = await client.fetch_item_detail(resolved)
        except TaobaoDataHubError as exc:
            code = "not_found" if exc.code == "not_found" else "upstream_error"
            raise PremiumMarketError(code, str(exc)) from exc

        norm = normalize_taobao_item(raw, resolved_id=resolved)
        pricing = calculate_china_total(
            self._settings,
            base_price_cny=float(norm["base_price_cny"] or 0),
            weight_kg=float(norm["weight_kg"] or 0.5),
        )

        item = ChinaProductPayload(
            item_id=resolved,
            title=norm["title"],
            images=norm["images"],
            description=norm["description"],
            colors=norm["colors"],
            sizes=norm["sizes"],
            skus=[SkuVariant(**s) for s in norm["skus"]],
            weight_kg=float(norm["weight_kg"]),
            base_price_cny=float(norm["base_price_cny"]),
            pricing=pricing,
            source_url=norm.get("source_url"),
        )
        return MarketChinaResponse(item=item)

    async def get_local_product(self, item_id: str) -> MarketLocalResponse:
        try:
            pid = UUID(item_id)
        except ValueError as exc:
            raise PremiumMarketError("invalid_id", "Mahalliy tovar ID noto'g'ri") from exc

        product = await self._repo.get_product_by_id(pid)
        if not product:
            raise PremiumMarketError("not_found", "Mahsulot topilmadi")

        attrs = dict(product.attributes or {})
        catalog = parse_variant_catalog(attrs)
        colors = [c["name"] for c in catalog.get("colors", []) if c.get("name")]
        size_matrix = {
            str(c["name"]): list(c.get("sizes") or [])
            for c in catalog.get("colors", [])
            if c.get("name")
        }
        all_sizes: list[str] = list(catalog.get("all_sizes") or [])
        if not all_sizes:
            all_sizes = list(size_matrix.get(colors[0], [])) if colors else []

        shop = product.shop
        product_price = int(product.price or 0)
        courier, _, pricing = calculate_local_total(self._settings, product_price_uzs=product_price)

        item = LocalProductPayload(
            item_id=str(product.id),
            name=product.name,
            images=list(product.images or []),
            description=product.description,
            stock_count=int(getattr(product, "stock_count", 0) or 0),
            is_available=bool(product.is_available),
            colors=colors,
            sizes=all_sizes,
            size_matrix=size_matrix,
            shop=LocalShopInfo(
                id=str(shop.id) if shop else "",
                name=shop.name if shop else "",
                slug=shop.slug if shop else "",
                location_label=getattr(shop, "location_comment", None) if shop else None,
                floor=shop.floor if shop else None,
                stall=shop.section if shop else None,
            ),
            product_price_uzs=product_price,
            courier_fee_uzs=courier,
            pricing=pricing,
        )
        return MarketLocalResponse(item=item)
