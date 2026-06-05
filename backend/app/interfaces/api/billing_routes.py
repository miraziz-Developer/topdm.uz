"""Bozorliii.uz Billing API — obuna, boost, banner, daromad."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.billing.boost_service import BoostService
from app.application.billing.plans import ALL_PLANS, ALL_BOOSTS, ALL_BANNER_TARIFFS, BannerTariff
from app.application.billing.subscription_service import plan_to_dict
from app.application.billing.revenue_service import RevenueService
from app.application.billing.subscription_service import SubscriptionService
from app.core.config import get_settings
from app.application.billing.merchant_debt_service import MerchantDebtService
from app.infrastructure.auth.deps import require_merchant_shop
from app.interfaces.api.admin_routes import require_admin_key
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/billing", tags=["billing"])
vendors_router = APIRouter(prefix="/vendors", tags=["vendors"])


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
    if not get_settings().subscriptions_enabled:
        raise HTTPException(
            status_code=403,
            detail="Oylik obuna o'chirilgan. Daromad mahsulot narxiga +15% ustama orqali.",
        )
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
    if not get_settings().subscriptions_enabled:
        raise HTTPException(
            status_code=403,
            detail="Oylik obuna o'chirilgan. Daromad mahsulot narxiga +15% ustama orqali.",
        )
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
    """Banner reklama — bosh sahifa karusel, kun bo'yicha narx."""
    from app.application.crm_banners.pricing import BANNER_DAY_OPTIONS, banner_price_for_days, banner_price_per_day_uzs

    class _Tariff:
        def __init__(self, t: BannerTariff) -> None:
            self.code = t.code
            self.name_uz = t.name_uz
            self.duration_days = t.duration_days
            self.price_uzs_monthly = t.price_uzs
            self.priority_weight = t.priority
            self.coin_cost = None

    return {
        "placement": "bozorliii.uz bosh sahifasidagi premium karusel (aylanma banner)",
        "day_options": list(BANNER_DAY_OPTIONS),
        "tariffs": [
            {
                "code": t.code,
                "name_uz": t.name_uz,
                "reference_price_uzs": t.price_uzs,
                "reference_days": t.duration_days,
                "price_per_day_uzs": banner_price_per_day_uzs(_Tariff(t)),
                "price_uzs": t.price_uzs,
                "duration_days": t.duration_days,
                "priority": t.priority,
                "carousel_slot": t.priority,
                "display_seconds": t.display_seconds,
                "badge": t.badge,
                "description": (
                    f"Karusel {t.priority}-o'rin · ~{banner_price_per_day_uzs(_Tariff(t)):,} so'm/kun "
                    f"(30 kun ≈ {t.price_uzs:,} so'm)"
                ).replace(",", " "),
            }
            for t in ALL_BANNER_TARIFFS
        ],
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
            "rate_pct": get_settings().platform_product_markup_pct,
            "description": "Mahsulot narxiga +15% ustama (mijoz to'lovi)",
            "note": "Naqd/terminal pickup: komissiya qarz balansiga yoziladi",
        },
    }


# ════════════════════════════════════════════════════════════════
# 6. DO'KON QARZI (naqd pickup 15%)
# ════════════════════════════════════════════════════════════════
@router.get("/debt")
async def get_merchant_debt(
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """CRM: joriy qarz va blok holati."""
    svc = MerchantDebtService(db)
    try:
        return await svc.get_shop_debt_status(shop_id)
    except ValueError as exc:
        raise HTTPException(404, detail=str(exc)) from exc


class PayDebtBody(BaseModel):
    amount_uzs: int = Field(gt=0, le=50_000_000)


class DebtCheckoutBody(BaseModel):
    provider: str = Field(..., pattern="^(click|payme)$")


@router.post("/debt/checkout")
async def create_debt_checkout(
    body: DebtCheckoutBody,
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Click/Payme orqali qarzni to'lash — checkout_id qaytadi."""
    from app.application.payments.payment_gateway_service import PaymentGatewayService

    svc = MerchantDebtService(db)
    gateway = PaymentGatewayService(db)
    try:
        gateway.assert_online_enabled()
        checkout = await svc.create_debt_checkout(shop_id, provider=body.provider)
        checkout["redirect_url"] = gateway.build_redirect_url(
            UUID(checkout["checkout_id"]),
            body.provider,
        )
        return checkout
    except ValueError as exc:
        code = str(exc)
        status = 403 if code == "online_checkout_disabled" else 400
        raise HTTPException(status_code=status, detail=code) from exc


@router.post("/pay-debt")
@vendors_router.post("/pay-debt")
async def pay_merchant_debt(
    body: PayDebtBody,
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Do'konchi qarzini qisman/to'liq yopish (Click/Payme tasdiqlangandan keyin ham chaqiriladi)."""
    svc = MerchantDebtService(db)
    try:
        return await svc.apply_debt_payment(shop_id, body.amount_uzs)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc)) from exc


class ClearDebtWebhookBody(BaseModel):
    shop_id: UUID
    amount_uzs: int = Field(gt=0)
    provider: str | None = None
    external_reference: str | None = None


@router.post("/clear-debt-webhook")
async def vendor_clear_debt_webhook(
    body: ClearDebtWebhookBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Click/Payme billing webhook — do'kon qarzini kamaytirish.
    X-Admin-Key talab qilinadi (productionda IP + imzo qo'shing).
    """
    svc = MerchantDebtService(db)
    try:
        result = await svc.apply_debt_payment(body.shop_id, body.amount_uzs)
        return {"error_code": 0, **result}
    except ValueError:
        return {"error_code": 1, "status": "shop_not_found"}
