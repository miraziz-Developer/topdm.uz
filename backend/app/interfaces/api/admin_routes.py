from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.market_analytics import AdminMarketAnalyticsService
from app.core.config import get_settings
from app.infrastructure.db.session import get_db_session
from app.infrastructure.repositories.finance_repo import FinanceRepository
from app.interfaces.api.serializers import shop_to_dict
from app.models.delivery_claim import MerchantPayoutRequestModel

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin_key(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")) -> None:
    import hmac

    settings = get_settings()
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="ADMIN_API_KEY is not configured")
    if not x_admin_key or not hmac.compare_digest(x_admin_key, settings.admin_api_key):
        raise HTTPException(status_code=401, detail="Invalid admin key")


@router.get("/analytics/markets/{market_slug}")
async def admin_market_analytics(
    market_slug: str,
    days: int = 7,
    level: int = 1,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = AdminMarketAnalyticsService(db)
    report = await service.build_report(market_slug, days=days, level=level)
    return report.to_dict()


class FeaturedShopBody(BaseModel):
    featured: bool = True
    days: int = 30


@router.patch("/shops/{shop_id}/featured")
async def admin_set_shop_featured(
    shop_id: UUID,
    body: FeaturedShopBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from datetime import datetime, timedelta, timezone

    from app.infrastructure.db.models import ShopModel

    shop = await db.get(ShopModel, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_featured = body.featured
    shop.featured_until = (
        datetime.now(timezone.utc) + timedelta(days=body.days) if body.featured else None
    )
    await db.commit()
    await db.refresh(shop)
    return shop_to_dict(shop)


@router.get("/shops/pending")
async def admin_list_pending_shops(
    limit: int = 50,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ShopModel

    result = await db.execute(
        select(ShopModel)
        .where(ShopModel.is_active == True, ShopModel.is_verified == False)
        .order_by(ShopModel.name.asc())
        .limit(min(limit, 200))
    )
    shops = list(result.scalars().all())
    return {"items": [shop_to_dict(s) for s in shops], "count": len(shops)}


class VerifyShopBody(BaseModel):
    verified: bool = True


@router.get("/shops/{shop_id}/share-kit")
async def admin_shop_share_kit(
    shop_id: UUID,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.merchant.share_kit import build_share_kit
    from app.application.merchant.workspace_draft import load_workspace_draft
    from app.core.config import get_settings
    from app.infrastructure.db.models import ShopModel

    shop = await db.get(ShopModel, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    draft = await load_workspace_draft(shop_id)
    hours = draft.get("operating_hours") or {"open": "09:00", "close": "20:00", "busy_note": ""}
    return build_share_kit(shop, settings=get_settings(), operating_hours=hours)


@router.patch("/shops/{shop_id}/verify")
async def admin_verify_shop(
    shop_id: UUID,
    body: VerifyShopBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ShopModel

    shop = await db.get(ShopModel, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_verified = body.verified
    await db.commit()
    await db.refresh(shop)
    return shop_to_dict(shop)


class PayoutActionBody(BaseModel):
    reference: str | None = Field(default=None, max_length=128)
    note: str | None = Field(default=None, max_length=500)


@router.get("/payouts/pending")
async def admin_list_pending_payouts(
    limit: int = 50,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    result = await db.execute(
        select(MerchantPayoutRequestModel)
        .where(MerchantPayoutRequestModel.status == "pending")
        .order_by(MerchantPayoutRequestModel.created_at.asc())
        .limit(min(limit, 200))
    )
    rows = list(result.scalars().all())
    return {
        "items": [
            {
                "id": str(r.id),
                "shop_id": str(r.shop_id),
                "amount_uzs": float(r.amount_uzs),
                "status": r.status,
                "destination": r.destination,
                "reference": r.reference,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "count": len(rows),
    }


@router.post("/payouts/{payout_id}/complete")
async def admin_complete_payout(
    payout_id: UUID,
    body: PayoutActionBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.get(MerchantPayoutRequestModel, payout_id)
    if not row:
        raise HTTPException(status_code=404, detail="Payout not found")
    if row.status not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail="invalid_payout_status")

    finance = FinanceRepository(db)
    amount = Decimal(str(row.amount_uzs))
    try:
        await finance.debit_frozen_balance(row.shop_id, amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    row.status = "completed"
    row.reference = body.reference or row.reference
    row.processed_at = datetime.now(timezone.utc)
    meta = dict(row.meta or {})
    if body.note:
        meta["admin_note"] = body.note
    row.meta = meta
    await db.commit()
    return {"id": str(row.id), "status": row.status, "processed_at": row.processed_at.isoformat()}


@router.post("/payouts/{payout_id}/reject")
async def admin_reject_payout(
    payout_id: UUID,
    body: PayoutActionBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.get(MerchantPayoutRequestModel, payout_id)
    if not row:
        raise HTTPException(status_code=404, detail="Payout not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="invalid_payout_status")

    finance = FinanceRepository(db)
    amount = Decimal(str(row.amount_uzs))
    try:
        await finance.release_frozen_to_current(row.shop_id, amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    row.status = "rejected"
    row.processed_at = datetime.now(timezone.utc)
    meta = dict(row.meta or {})
    if body.note:
        meta["reject_reason"] = body.note
    row.meta = meta
    await db.commit()
    return {"id": str(row.id), "status": row.status}


# --- Platform foydasi (komissiya) → shaxsiy kartaga sweep -------------------


class ProfitSweepBody(BaseModel):
    amount_uzs: float = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)


@router.get("/platform-profit")
async def admin_platform_profit(
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Yechib olinadigan platforma foydasi (escrow hisobga olinmaydi)."""
    from app.application.billing.platform_profit_service import PlatformProfitService

    return await PlatformProfitService(db).summary()


@router.get("/platform-profit/sweeps")
async def admin_list_profit_sweeps(
    limit: int = 50,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.billing.platform_profit_service import PlatformProfitService

    return await PlatformProfitService(db).list_sweeps(limit=min(limit, 200))


@router.post("/platform-profit/sweep")
async def admin_create_profit_sweep(
    body: ProfitSweepBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Foydadan summa 'band' qiladi. Keyin Click'da o'tkazib, /complete bilan tasdiqlanadi."""
    from app.application.billing.platform_profit_service import (
        PlatformProfitError,
        PlatformProfitService,
    )

    try:
        return await PlatformProfitService(db).create_sweep(
            amount_uzs=Decimal(str(body.amount_uzs)),
            note=body.note,
        )
    except PlatformProfitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/platform-profit/sweeps/{sweep_id}/complete")
async def admin_complete_profit_sweep(
    sweep_id: UUID,
    body: PayoutActionBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Shaxsiy kartaga o'tkazib bo'lingach tasdiqlash."""
    from app.application.billing.platform_profit_service import (
        PlatformProfitError,
        PlatformProfitService,
    )

    try:
        return await PlatformProfitService(db).complete_sweep(
            sweep_id, reference=body.reference, note=body.note
        )
    except PlatformProfitError as exc:
        status = 404 if str(exc) == "sweep_not_found" else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc


@router.post("/platform-profit/sweeps/{sweep_id}/cancel")
async def admin_cancel_profit_sweep(
    sweep_id: UUID,
    body: PayoutActionBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Band qilingan summani bekor qilish (foydaga qaytadi)."""
    from app.application.billing.platform_profit_service import (
        PlatformProfitError,
        PlatformProfitService,
    )

    try:
        return await PlatformProfitService(db).cancel_sweep(sweep_id, note=body.note)
    except PlatformProfitError as exc:
        status = 404 if str(exc) == "sweep_not_found" else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
