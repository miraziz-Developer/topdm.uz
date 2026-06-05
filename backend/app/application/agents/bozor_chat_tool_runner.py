from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.agents.bozor_chat_catalog import (
    build_catalog_search_query,
    build_jonli_katalog_natijasi,
    parse_bazaar_intent,
    parse_budget_from_text,
    filter_catalog_items_for_intent,
    parse_category_hint,
    parse_garment_slot_keywords,
    parse_look_intent,
    parse_sale_type,
)
from app.application.indoor_navigation.market_map_loader import load_market_map
from app.application.indoor_navigation.pathfinding import build_route
from app.infrastructure.ai_clients.embedding import EmbeddingClient
from app.infrastructure.db.models import IpadromModel
from app.infrastructure.repositories.indoor_map_repo import IndoorMapRepository
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.product_repo import ProductRepo
from app.interfaces.api.serializers import product_to_dict


def vision_search_hint(attributes: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ("category", "color", "material"):
        value = attributes.get(key)
        if value:
            parts.append(str(value))
    for tag in attributes.get("style_tags") or []:
        if tag:
            parts.append(str(tag))
    return " ".join(parts).strip() or "Rasm bo'yicha qidiruv"


class BozorToolRunner:
    """Executes Bozorliii agent tools against Postgres + indoor map fixtures."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session
        self._products = ProductRepo(session)
        self._market = MarketplaceRepository(session)
        self._indoor = IndoorMapRepository(session)
        self._embed = EmbeddingClient()
        self.allowed_product_ids: set[str] = set()
        self.product_snapshots: dict[str, dict[str, Any]] = {}
        self.tool_events: list[dict[str, Any]] = []
        self.last_route: dict[str, Any] | None = None
        self.last_route_meta: dict[str, Any] = {}
        self.last_catalog_context: dict[str, Any] = {}
        self.recommended_product_ids: set[str] = set()

    def _log_event(self, name: str, args: dict[str, Any], result: dict[str, Any]) -> None:
        self.tool_events.append({"name": name, "arguments": args, "result": result})

    async def bootstrap_from_vision(self, vision: dict[str, Any]) -> None:
        q = vision_search_hint(vision)
        filters = {k: vision[k] for k in ("color", "material") if vision.get(k)}
        await self.handle_tool("get_product_details", {"query": q, "filters": filters})

    async def bootstrap_from_text(self, query: str) -> None:
        q = query.strip()
        if not q:
            return
        if not self.last_catalog_context.get("count"):
            await self.query_clothing_catalog_from_text(q)
        await self.handle_tool("get_product_details", {"query": q, "filters": {}})

    async def query_clothing_catalog_from_text(self, text: str) -> dict[str, Any]:
        min_p, max_p = parse_budget_from_text(text)
        category = parse_category_hint(text)
        bazaar = parse_bazaar_intent(text)
        search_q = build_catalog_search_query(text, category)
        out = await self._query_clothing_catalog(
            {
                "query": search_q,
                "category": category,
                "min_price": min_p,
                "max_price": max_p,
                "sale_type": parse_sale_type(text),
                "_source_text": text,
                **{k: v for k, v in bazaar.items() if v},
            }
        )
        self.last_catalog_context = out
        return out

    async def handle_tool(self, name: str, args: dict[str, Any]) -> str:
        if name == "query_clothing_catalog_tool":
            out = await self._query_clothing_catalog(args)
            self.last_catalog_context = out
        elif name == "get_product_details":
            out = await self._get_product_details(args)
        elif name == "get_store_location":
            out = await self._get_store_location(args)
        elif name == "calculate_route":
            out = await self._calculate_route(args)
        else:
            out = {"error": "unknown_tool", "name": name}
        self._log_event(name, args, out)
        return json.dumps(out, ensure_ascii=True)

    def _register_catalog_items(self, items: list[dict[str, Any]]) -> None:
        for d in items:
            pid = str(d.get("id") or "")
            if not pid:
                continue
            self.allowed_product_ids.add(pid)
            self.product_snapshots[pid] = d

    async def _query_clothing_catalog(self, args: dict[str, Any]) -> dict[str, Any]:
        query = str(args.get("query") or "").strip()
        category = str(args.get("category") or "").strip() or None
        sale_type = str(args.get("sale_type") or "").strip() or None
        root_category = str(args.get("root_category") or "").strip() or None
        sub_category = str(args.get("sub_category") or "").strip() or None
        market_zone = str(args.get("market_zone") or "").strip() or None
        min_price = args.get("min_price")
        max_price = args.get("max_price")
        try:
            min_p = float(min_price) if min_price is not None else None
        except (TypeError, ValueError):
            min_p = None
        try:
            max_p = float(max_price) if max_price is not None else None
        except (TypeError, ValueError):
            max_p = None

        if not query and not category:
            return {"error": "missing_query_or_category", "count": 0, "items": []}

        search_text = query or category or "kiyim"
        exclude = list(self.recommended_product_ids)
        source_text = str(args.get("_source_text") or "")
        if parse_look_intent(source_text).get("is_pagination"):
            exclude = list(self.recommended_product_ids)
        filters: dict[str, Any] = {"text": search_text, "exclude_ids": exclude}
        if category:
            filters["category_hint"] = category
        garment_slots = parse_garment_slot_keywords(source_text or search_text)
        if garment_slots:
            filters["slot_category_keywords"] = garment_slots
        if sale_type in ("Chakana", "Optom"):
            filters["sale_type"] = sale_type
        if root_category:
            filters["root_category"] = root_category
        if sub_category:
            filters["sub_category"] = sub_category

        vector = await self._embed.embed(search_text)
        matches = await self._products.hybrid_search(
            vector,
            filters,
            limit=12,
            min_price=min_p,
            max_price=max_p,
        )

        relaxed = False
        if not matches and max_p is not None:
            relaxed = True
            matches = await self._products.hybrid_search(
                vector,
                filters,
                limit=12,
                min_price=min_p,
                max_price=int(max_p * 1.2),
            )

        if not matches and max_p is not None:
            relaxed = True
            band_min = int(max_p * 0.85)
            band_max = int(max_p * 1.35)
            matches = await self._products.hybrid_search(
                vector,
                filters,
                limit=12,
                min_price=band_min,
                max_price=band_max,
            )

        if not matches and category and max_p is None:
            broad_filters = {**filters, "category_hint": category}
            matches = await self._products.hybrid_search(vector, broad_filters, limit=10, min_price=min_p)

        items: list[dict[str, Any]] = []
        for m in matches:
            pid = str(m.id)
            full = await self._market.get_product_by_id(UUID(pid))
            if not full:
                continue
            d = product_to_dict(full)
            if max_p is not None and float(d.get("price") or 0) > float(max_p) * 1.2:
                continue
            items.append(d)

        items = filter_catalog_items_for_intent(items, source_text or search_text)

        vector_neighbors: list[dict[str, Any]] = []
        if not items:
            vector_neighbors = await self._vector_neighbor_products(
                vector=vector,
                search_text=search_text,
                category=category,
                sale_type=sale_type,
                root_category=root_category,
                sub_category=sub_category,
                max_p=max_p,
            )
            self._register_catalog_items(vector_neighbors)
            vector_neighbors = filter_catalog_items_for_intent(vector_neighbors, source_text or search_text)

        jonli = build_jonli_katalog_natijasi(exact_items=items, vector_neighbors=vector_neighbors)
        all_for_llm = list(jonli.get("vector_neighbors") or [])
        self._register_catalog_items(all_for_llm)

        look_intent = parse_look_intent(str(args.get("_source_text") or search_text))
        payload: dict[str, Any] = {
            "count": len(items),
            "items": items,
            "query": search_text,
            "category": category,
            "min_price": min_p,
            "max_price": max_p,
            "sale_type": sale_type,
            "market_zone": market_zone,
            "root_category": root_category,
            "sub_category": sub_category,
            "price_relaxed": relaxed,
            "jonli_katalog_natijasi": jonli,
            "[jonli_katalog_natijalari]": jonli,
            "is_fallback": bool(jonli.get("is_fallback")),
            "look_intent": look_intent,
        }
        return payload

    async def _vector_neighbor_products(
        self,
        *,
        vector: list[float],
        search_text: str,
        category: str | None,
        sale_type: str | None,
        root_category: str | None,
        sub_category: str | None,
        max_p: float | None,
    ) -> list[dict[str, Any]]:
        exclude = list(self.recommended_product_ids)
        matches = await self._products.vector_similarity_fallback(
            vector,
            limit=12,
            max_cosine_distance=0.78,
            category_hint=category or search_text,
            color_hint=None,
            style_tags=None,
            exclude_ids=exclude,
        )
        if not matches:
            matches = await self._products.vector_similarity_fallback(
                vector,
                limit=12,
                max_cosine_distance=0.9,
                exclude_ids=exclude,
            )
        if not matches:
            featured = await self._market.list_featured_products(limit=8)
            out: list[dict[str, Any]] = []
            for row in featured:
                out.append(product_to_dict(row))
            return out

        out = []
        for m in matches:
            full = await self._market.get_product_by_id(UUID(str(m.id)))
            if not full:
                continue
            d = product_to_dict(full)
            if max_p is not None and float(d.get("price") or 0) > float(max_p) * 1.5:
                continue
            out.append(d)
        return out

    async def _get_product_details(self, args: dict[str, Any]) -> dict[str, Any]:
        query = str(args.get("query") or "").strip()
        filters = args.get("filters") if isinstance(args.get("filters"), dict) else {}
        if query:
            filters = {**filters, "text": query}
        if not query:
            return {"error": "missing_query"}
        vector = await self._embed.embed(query + " " + str(filters.get("category", "")))
        matches = await self._products.hybrid_search(vector, filters, limit=10)
        items: list[dict[str, Any]] = []
        for m in matches:
            pid = str(m.id)
            full = await self._market.get_product_by_id(UUID(pid))
            if not full:
                continue
            d = product_to_dict(full)
            items.append(d)
        self._register_catalog_items(items)
        return {"count": len(items), "items": items}

    async def _ipadrom_slug(self, ipadrom_id: UUID | None) -> str:
        if not ipadrom_id:
            return "ippodrom"
        row = await self._db.get(IpadromModel, ipadrom_id)
        if not row:
            return "ippodrom"
        return row.name.lower().strip().replace(" ", "-")

    async def _get_store_location(self, args: dict[str, Any]) -> dict[str, Any]:
        raw = str(args.get("store_id") or "").strip()
        if not raw:
            return {"error": "missing_store_id"}
        try:
            shop_id = UUID(raw)
        except ValueError:
            return {"error": "invalid_store_id"}
        shop = await self._market.get_shop(shop_id)
        if not shop:
            return {"error": "not_found"}
        stall_node: str | None = None
        if shop.indoor_stall_id:
            stall = await self._indoor.get_stall(shop.indoor_stall_id)
            if stall:
                stall_node = stall.graph_node_id
        market_slug = await self._ipadrom_slug(shop.ipadrom_id)
        payload: dict[str, Any] = {
            "store_id": str(shop.id),
            "name": shop.name,
            "slug": shop.slug,
            "floor": shop.floor,
            "section": shop.section,
            "latitude": shop.latitude,
            "longitude": shop.longitude,
            "location_comment": shop.location_comment,
            "indoor_pin": (
                {"x": shop.indoor_pin_x, "y": shop.indoor_pin_y}
                if shop.indoor_pin_x is not None and shop.indoor_pin_y is not None
                else None
            ),
            "goal_graph_node_id": stall_node,
            "market_slug": market_slug,
        }
        return payload

    async def _calculate_route(self, args: dict[str, Any]) -> dict[str, Any]:
        market_slug = str(args.get("market_slug") or "ippodrom").strip()
        level = int(args.get("level") or 1)
        start_node_id = str(args.get("start_node_id") or "").strip()
        goal_node_id = str(args.get("goal_node_id") or "").strip()
        if not start_node_id or not goal_node_id:
            return {"error": "missing_nodes"}
        payload = await load_market_map(market_slug, self._db)
        level_payload = next((item for item in payload["levels"] if item["level"] == level), None)
        if not level_payload:
            return {"error": "floor_not_found", "market_slug": market_slug, "level": level}
        graph = level_payload["navigation_graph"]
        route = build_route(graph, start_node_id, goal_node_id)
        if not route.get("node_ids"):
            reason = route.get("error") or "route_not_found"
            hints = {
                "unknown_start_node": "Boshlang'ich nuqta noto'g'ri — entrance-A, entrance-B dan foydalaning.",
                "unknown_goal_node": "Do'kon grafigida topilmadi — avval get_store_location chaqiring.",
                "disconnected_graph": "Yo'l uzilib qolgan — boshqa kirish yoki qavatni sinab ko'ring.",
            }
            return {
                "error": reason,
                "hint": hints.get(str(reason), "entrance-* va stall-* tugunlaridan foydalaning."),
            }
        from app.application.indoor_navigation.route_analytics import record_calculated_route

        await record_calculated_route(
            self._db,
            market_slug=market_slug,
            level=level,
            start_node_id=start_node_id,
            goal_node_id=goal_node_id,
            node_ids=[str(n) for n in route["node_ids"]],
            source="chat_agent",
        )
        self.last_route = route
        self.last_route_meta = {
            "market_slug": market_slug,
            "level": level,
            "start_node_id": start_node_id,
            "goal_node_id": goal_node_id,
        }
        return {
            "market_slug": market_slug,
            "level": level,
            "start_node_id": start_node_id,
            "goal_node_id": goal_node_id,
            "route": route,
        }
