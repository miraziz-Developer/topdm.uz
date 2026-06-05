from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.models.business_rule import BusinessRuleModel

_CACHE: dict[str, tuple[float, dict[str, str]]] = {}
_CACHE_TTL_SEC = 30.0


class BusinessRuleService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()

    async def get_decimal(
        self,
        rule_key: str,
        *,
        default: Decimal,
        scope: str = "global",
        scope_ref_id: UUID | None = None,
    ) -> Decimal:
        raw = await self.get_value(rule_key, scope=scope, scope_ref_id=scope_ref_id)
        if raw is None:
            return default
        try:
            return Decimal(str(raw).strip())
        except Exception:
            return default

    async def get_float(
        self,
        rule_key: str,
        *,
        default: float,
        scope: str = "global",
        scope_ref_id: UUID | None = None,
    ) -> float:
        value = await self.get_decimal(rule_key, default=Decimal(str(default)), scope=scope, scope_ref_id=scope_ref_id)
        return float(value)

    async def get_int(
        self,
        rule_key: str,
        *,
        default: int,
        scope: str = "global",
        scope_ref_id: UUID | None = None,
    ) -> int:
        raw = await self.get_value(rule_key, scope=scope, scope_ref_id=scope_ref_id)
        if raw is None:
            return default
        try:
            return int(float(str(raw).strip()))
        except Exception:
            return default

    async def get_value(
        self,
        rule_key: str,
        *,
        scope: str = "global",
        scope_ref_id: UUID | None = None,
    ) -> str | None:
        rules = await self._load_active_rules()
        key = rule_key.strip().lower()
        if scope_ref_id:
            scoped = f"{key}:{scope}:{scope_ref_id}"
            if scoped in rules:
                return rules[scoped]
        scoped_row = f"{key}:{scope}:"
        if scoped_row in rules:
            return rules[scoped_row]
        return rules.get(f"{key}:global:")

    async def _load_active_rules(self) -> dict[str, str]:
        import time

        cache_key = "all"
        now = time.time()
        hit = _CACHE.get(cache_key)
        if hit and now - hit[0] < _CACHE_TTL_SEC:
            return hit[1]

        result = await self._session.execute(
            select(BusinessRuleModel).where(BusinessRuleModel.is_active.is_(True))
        )
        out: dict[str, str] = {}
        for row in result.scalars().all():
            ref = str(row.scope_ref_id) if row.scope_ref_id else ""
            out[f"{row.rule_key.strip().lower()}:{row.scope}:{ref}"] = row.rule_value
        _CACHE[cache_key] = (now, out)
        return out

    async def group_discount_rate(self, *, product_id: UUID | None = None, category: str | None = None) -> float:
        if product_id:
            scoped = await self.get_value("group_discount_rate", scope="product", scope_ref_id=product_id)
            if scoped is not None:
                return min(max(float(scoped), 0.0), 0.9)
        if category:
            scoped = await self.get_value("group_discount_rate", scope="category", scope_ref_id=None)
            if scoped is not None:
                return min(max(float(scoped), 0.0), 0.9)
        return await self.get_float("group_discount_rate", default=0.267)

    async def platform_markup_pct(self) -> float:
        env_default = float(self._settings.platform_product_markup_pct)
        return await self.get_float("platform_product_markup_pct", default=env_default)

    async def debt_block_threshold_uzs(self) -> int:
        return await self.get_int(
            "merchant_debt_block_threshold_uzs",
            default=int(self._settings.merchant_debt_block_threshold_uzs),
        )

    async def list_rules(self) -> list[dict]:
        result = await self._session.execute(
            select(BusinessRuleModel).order_by(BusinessRuleModel.rule_key, BusinessRuleModel.scope)
        )
        return [
            {
                "id": str(r.id),
                "rule_key": r.rule_key,
                "rule_value": r.rule_value,
                "scope": r.scope,
                "scope_ref_id": str(r.scope_ref_id) if r.scope_ref_id else None,
                "is_active": bool(r.is_active),
                "description": r.description,
            }
            for r in result.scalars().all()
        ]

    @staticmethod
    def invalidate_cache() -> None:
        _CACHE.clear()
