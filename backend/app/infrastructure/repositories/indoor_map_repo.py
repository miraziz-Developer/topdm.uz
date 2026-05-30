from __future__ import annotations

import math
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import IndoorFloorPlanModel, IndoorStallModel, IpadromModel, ShopModel

_UNSET = object()


class IndoorMapRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_market_by_slug(self, slug: str) -> IpadromModel | None:
        normalized = slug.lower()
        result = await self.session.execute(
            select(IpadromModel).where(IpadromModel.is_active.is_(True)),
        )
        for market in result.scalars().all():
            if market.name.lower().replace(" ", "-") == normalized or str(market.id) == normalized:
                return market
        return None

    async def get_floor_plan(self, market_id: uuid.UUID, level: int) -> IndoorFloorPlanModel | None:
        result = await self.session.execute(
            select(IndoorFloorPlanModel).where(
                IndoorFloorPlanModel.market_id == market_id,
                IndoorFloorPlanModel.level == level,
                IndoorFloorPlanModel.is_active.is_(True),
            ),
        )
        return result.scalar_one_or_none()

    async def list_floor_plans(self, market_id: uuid.UUID) -> list[IndoorFloorPlanModel]:
        result = await self.session.execute(
            select(IndoorFloorPlanModel)
            .where(IndoorFloorPlanModel.market_id == market_id, IndoorFloorPlanModel.is_active.is_(True))
            .order_by(IndoorFloorPlanModel.level.asc()),
        )
        return list(result.scalars().all())

    async def list_stalls(self, floor_plan_id: uuid.UUID) -> list[IndoorStallModel]:
        result = await self.session.execute(
            select(IndoorStallModel).where(IndoorStallModel.floor_plan_id == floor_plan_id).order_by(IndoorStallModel.stall_code.asc()),
        )
        return list(result.scalars().all())

    async def get_stall(self, stall_id: uuid.UUID) -> IndoorStallModel | None:
        result = await self.session.execute(select(IndoorStallModel).where(IndoorStallModel.id == stall_id))
        return result.scalar_one_or_none()

    async def get_shop(self, shop_id: uuid.UUID) -> ShopModel | None:
        result = await self.session.execute(select(ShopModel).where(ShopModel.id == shop_id))
        return result.scalar_one_or_none()

    async def update_stall_position(
        self,
        stall: IndoorStallModel,
        x: float,
        y: float,
        graph_node_id: Any = _UNSET,
    ) -> IndoorStallModel:
        stall.local_x = x
        stall.local_y = y
        stall.geometry = {
            "type": "Point",
            "coordinates": [x, y],
        }
        if graph_node_id is not _UNSET and graph_node_id is not None:
            stall.graph_node_id = str(graph_node_id)
        await self.session.flush()
        return stall

    async def find_shop_for_route_goal(self, market_slug: str, level: int, goal_node_id: str) -> ShopModel | None:
        market = await self.get_market_by_slug(market_slug)
        if not market:
            return None
        plan = await self.get_floor_plan(market.id, level)
        if not plan:
            return None
        result = await self.session.execute(
            select(IndoorStallModel).where(
                IndoorStallModel.floor_plan_id == plan.id,
                IndoorStallModel.graph_node_id == goal_node_id,
                IndoorStallModel.shop_id.is_not(None),
            )
        )
        stall = result.scalar_one_or_none()
        if stall and stall.shop_id:
            return await self.get_shop(stall.shop_id)

        import re

        match = re.match(r"stall-([A-Za-z])-(\w+)$", goal_node_id.strip())
        if match:
            block_code, stall_code = match.group(1).upper(), match.group(2)
            result = await self.session.execute(
                select(IndoorStallModel).where(
                    IndoorStallModel.floor_plan_id == plan.id,
                    IndoorStallModel.block_code == block_code,
                    IndoorStallModel.stall_code == stall_code,
                    IndoorStallModel.shop_id.is_not(None),
                )
            )
            stall = result.scalar_one_or_none()
            if stall and stall.shop_id:
                return await self.get_shop(stall.shop_id)

        nodes = (plan.navigation_graph or {}).get("nodes") or {}
        goal = nodes.get(goal_node_id)
        if not goal:
            return None
        gx, gy = float(goal.get("x", 0)), float(goal.get("y", 0))
        stalls = await self.list_stalls(plan.id)
        best: tuple[float, uuid.UUID] | None = None
        for s in stalls:
            if not s.shop_id:
                continue
            sn = nodes.get(s.graph_node_id)
            if not sn:
                continue
            dist = math.hypot(float(sn["x"]) - gx, float(sn["y"]) - gy)
            if best is None or dist < best[0]:
                best = (dist, s.shop_id)
        if best:
            return await self.get_shop(best[1])
        return None

    async def get_floor_plan_by_id(self, floor_plan_id: uuid.UUID) -> IndoorFloorPlanModel | None:
        return await self.session.get(IndoorFloorPlanModel, floor_plan_id)

    async def assign_shop_to_stall(self, stall: IndoorStallModel, shop: ShopModel | None) -> IndoorStallModel:
        stall.shop_id = shop.id if shop else None
        stall.status = "occupied" if shop else "vacant"
        if shop:
            shop.indoor_stall_id = stall.id
        await self.session.flush()
        return stall

    async def update_shop_precision_location(
        self,
        shop: ShopModel,
        *,
        latitude: float,
        longitude: float,
        accuracy: float | None,
        floor: str,
        block: str,
        stall: str,
        comment: str,
        pin_x: float,
        pin_y: float,
    ) -> ShopModel:
        shop.latitude = latitude
        shop.longitude = longitude
        shop.location_accuracy = accuracy
        shop.floor = floor
        shop.section = f"{block}-blok • rasta {stall}"
        shop.location_comment = comment
        shop.indoor_pin_x = pin_x
        shop.indoor_pin_y = pin_y
        await self.session.flush()
        return shop

    def floor_plan_to_dict(self, plan: IndoorFloorPlanModel, stalls: list[IndoorStallModel]) -> dict[str, Any]:
        return {
            "id": str(plan.id),
            "market_id": str(plan.market_id),
            "level": plan.level,
            "name": plan.name,
            "slug": plan.slug,
            "view_box": plan.view_box,
            "geojson": plan.geojson,
            "navigation_graph": plan.navigation_graph,
            "svg_overlay_url": plan.svg_overlay_url,
            "stalls": [self.stall_to_dict(stall) for stall in stalls],
        }

    def stall_to_dict(self, stall: IndoorStallModel) -> dict[str, Any]:
        return {
            "id": str(stall.id),
            "stall_code": stall.stall_code,
            "block_code": stall.block_code,
            "status": stall.status,
            "local_x": stall.local_x,
            "local_y": stall.local_y,
            "width": stall.width,
            "height": stall.height,
            "graph_node_id": stall.graph_node_id,
            "shop_id": str(stall.shop_id) if stall.shop_id else None,
            "geometry": stall.geometry,
        }
