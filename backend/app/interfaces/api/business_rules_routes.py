from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.billing.business_rule_service import BusinessRuleService
from app.infrastructure.auth.deps import require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.db.session import get_db_session
from app.interfaces.api.admin_routes import require_admin_key
from app.models.business_rule import BusinessRuleModel

router = APIRouter(prefix="/crm/business-rules", tags=["crm-business-rules"])


class UpsertRuleBody(BaseModel):
    rule_key: str = Field(..., min_length=2, max_length=64)
    rule_value: str
    scope: str = Field(default="global", pattern="^(global|category|product|shop)$")
    scope_ref_id: UUID | None = None
    is_active: bool = True
    description: str | None = None


@router.get("")
async def list_business_rules(
    _: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = BusinessRuleService(db)
    return {"items": await svc.list_rules()}


@router.post("")
async def upsert_business_rule(
    body: UpsertRuleBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    result = await db.execute(
        select(BusinessRuleModel).where(
            BusinessRuleModel.rule_key == body.rule_key,
            BusinessRuleModel.scope == body.scope,
            BusinessRuleModel.scope_ref_id == body.scope_ref_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = BusinessRuleModel(
            rule_key=body.rule_key,
            rule_value=body.rule_value,
            scope=body.scope,
            scope_ref_id=body.scope_ref_id,
            is_active=body.is_active,
            description=body.description,
        )
        db.add(row)
    else:
        row.rule_value = body.rule_value
        row.is_active = body.is_active
        row.description = body.description
    await db.commit()
    BusinessRuleService.invalidate_cache()
    return {"status": "ok", "id": str(row.id)}


@router.get("/shop-overrides")
async def shop_rule_overrides(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    result = await db.execute(
        select(BusinessRuleModel).where(
            BusinessRuleModel.scope == "shop",
            BusinessRuleModel.scope_ref_id == shop.id,
            BusinessRuleModel.is_active.is_(True),
        )
    )
    items = [
        {
            "id": str(r.id),
            "rule_key": r.rule_key,
            "rule_value": r.rule_value,
        }
        for r in result.scalars().all()
    ]
    return {"shop_id": str(shop.id), "items": items}
