"""Topdim.UZ Billing API — obuna, boost, banner, daromad."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.billing.boost_service import BoostService
from app.application.billing.plans import ALL_PLANS, ALL_BOOSTS, ALL_BANNER_TARIFFS
from app.application.billing.subscription_service import plan_to_dict
from app.application.billing.revenue_service import RevenueService
from app.application.billing.subscription_service import SubscriptionService
from app.infrastructure.auth.deps import require_merchant_shop
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/billing", tags=["billing"])


# ════════════════════════════════════════════════════════════════
# 1. OBUNA REJALARI
# ════════════════════════════════════════════════════════════════
@router.get("/plans")
async def list_subscription_plans() -> dict:
    """Barcha obuna rejalari (ochiq)."""
    return {"plans": [plan_to_dict(p) for p in ALL_PLANS]}


@router.get("/subscription")
async def get_my_subscription(
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Do'konning joriy obuna holati."""
    svc = SubscriptionService(db)
    try:
        return await svc.get_shop_subscription(shop_id)
    except RuntimeError as exc:
        raise HTTPException(503, detail=str(exc)) from exc


class ActivateTrialBody(BaseModel):
    plan_code: str = Field(default="starter", pattern="^(starter|pro)$")


@router.post("/trial/activate")
async def activate_trial(
    body: ActivateTrialBody,
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Yangi do'kon uchun bepul 14 kunlik sinov."""
    svc = SubscriptionService(db)
    try:
        return await svc.activate_trial(shop_id, body.plan_code)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(503, detail=str(exc)) from exc


class SubscribeBody(BaseModel):
    plan_code: str = Field(pattern="^(starter|pro)$")
    period: str = Field(default="monthly", pattern="^(monthly|yearly)$")


@router.post("/subscribe")
async def subscribe_with_coins(
    body: SubscribeBody,
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Coin bilan obuna faollashtirish."""
    svc = SubscriptionService(db)
    try:
        return await svc.subscribe_with_coins(shop_id, body.plan_code, body.period)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(503, detail=str(exc)) from exc


# ════════════════════════════════════════════════════════════════
# 2. FEATURED PRODUCT BOOST
# ════════════════════════════════════════════════════════════════
@router.get("/boost/packages")
async def list_boost_packages() -> dict:
    """Boost paketlari (ochiq)."""
    return {
        "packages": [
            {
                "code": b.code,
                "name_uz": b.name_uz,
                "price_uzs": b.price_uzs,
                "duration_days": b.duration_days,
                "coin_cost": max(1, b.price_uzs // 10_000),
                "description_uz": b.description_uz,
            }
            for b in ALL_BOOSTS
        ]
    }


@router.get("/boost/active")
async def get_active_boosts(
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = BoostService(db)
    try:
        items = await svc.get_active_boosts(shop_id)
    except RuntimeError as exc:
        raise HTTPException(503, detail=str(exc)) from exc
    return {"items": items, "count": len(items)}


class BoostProductBody(BaseModel):
    product_id: UUID
    boost_code: str


@router.post("/boost/product")
async def boost_product(
    body: BoostProductBody,
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mahsulotni featured qilish (coin bilan)."""
    svc = BoostService(db)
    try:
        return await svc.boost_product(
            shop_id=shop_id,
            product_id=body.product_id,
            boost_code=body.boost_code,
        )
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(503, detail=str(exc)) from exc


# ════════════════════════════════════════════════════════════════
# 3. BANNER TARIFFS (ochiq)
# ════════════════════════════════════════════════════════════════
@router.get("/banners/tariffs")
async def list_banner_tariffs() -> dict:
    """Banner reklama tariflari — Bronze, Silver, Gold."""
    return {
        "tariffs": [
            {
                "code": t.code,
                "name_uz": t.name_uz,
                "price_uzs": t.price_uzs,
                "coin_cost": max(1, t.price_uzs // 10_000),
                "duration_days": t.duration_days,
                "priority": t.priority,
                "display_seconds": t.display_seconds,
                "badge": t.badge,
                "description": f"{t.duration_days} kun premium karuselda, {t.priority}-o'rin",
            }
            for t in ALL_BANNER_TARIFFS
        ]
    }


# ════════════════════════════════════════════════════════════════
# 4. DAROMAD HISOBI (merchant)
# ════════════════════════════════════════════════════════════════
@router.get("/revenue")
async def my_revenue(
    days: int = 30,
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Do'kon daromadi — buyurtma GMV, komissiya, lead."""
    svc = RevenueService(db)
    return await svc.shop_revenue_summary(shop_id, days=min(days, 365))


# ════════════════════════════════════════════════════════════════
# 5. PRICING PAGE (ochiq — marketing)
# ════════════════════════════════════════════════════════════════
@router.get("/pricing")
async def pricing_page() -> dict:
    """Marketing sahifasi uchun to'liq narx jadvali."""
    return {
        "subscriptions": [plan_to_dict(p) for p in ALL_PLANS],
        "boosts": [
            {
                "code": b.code, "name_uz": b.name_uz,
                "price_uzs": b.price_uzs, "duration_days": b.duration_days,
                "description_uz": b.description_uz,
            }
            for b in ALL_BOOSTS
        ],
        "banners": [
            {
                "code": t.code, "name_uz": t.name_uz,
                "price_uzs": t.price_uzs, "duration_days": t.duration_days,
                "badge": t.badge, "priority": t.priority,
            }
            for t in ALL_BANNER_TARIFFS
        ],
        "commission": {
            "rate_pct": 2.5,
            "description": "Har buyurtmadan 2.5% platforma komissiyasi (kelajakda)",
            "note": "Hozirda 0% — merchant onboarding bosqichi",
        },
    }
