from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import String, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.market_analytics import AdminMarketAnalyticsService
from app.application.admin.shop_moderation import AdminShopModerationService, PENDING_STATUSES
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


@router.get("/dashboard")
async def admin_dashboard(
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Platforma CRM — boshqaruv paneli agregat."""
    from sqlalchemy import func

    from app.application.billing.platform_profit_service import PlatformProfitService
    from app.infrastructure.db.models import AppUserModel, OrderModel, ProductModel, ShopModel

    mod = AdminShopModerationService(db)
    counts = await mod.dashboard_counts()
    profit = await PlatformProfitService(db).summary()

    total_shops = int((await db.execute(select(func.count()).select_from(ShopModel))).scalar_one() or 0)
    active_shops = int(
        (await db.execute(select(func.count()).select_from(ShopModel).where(ShopModel.is_active.is_(True)))).scalar_one()
        or 0
    )
    total_products = int((await db.execute(select(func.count()).select_from(ProductModel))).scalar_one() or 0)
    total_users = int((await db.execute(select(func.count()).select_from(AppUserModel))).scalar_one() or 0)
    total_orders = int((await db.execute(select(func.count()).select_from(OrderModel))).scalar_one() or 0)
    pending_orders = int(
        (
            await db.execute(
                select(func.count()).select_from(OrderModel).where(OrderModel.status.in_(("pending", "confirmed")))
            )
        ).scalar_one()
        or 0
    )

    recent_orders = await db.execute(
        select(OrderModel).order_by(OrderModel.created_at.desc()).limit(8)
    )
    orders = list(recent_orders.scalars().all())

    return {
        "counts": counts,
        "profit": profit,
        "totals": {
            "shops": total_shops,
            "active_shops": active_shops,
            "products": total_products,
            "users": total_users,
            "orders": total_orders,
            "pending_orders": pending_orders,
        },
        "recent_orders": [
            {
                "id": str(o.id),
                "status": o.status,
                "total_uzs": float(o.total_price or 0),
                "shop_id": str(o.shop_id) if o.shop_id else None,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ],
    }


@router.get("/users")
async def admin_list_users(
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import AppUserModel

    base = select(AppUserModel)
    count_q = select(func.count()).select_from(AppUserModel)
    if q and q.strip():
        needle = f"%{q.strip()}%"
        filt = (
            AppUserModel.phone.ilike(needle)
            | AppUserModel.display_name.ilike(needle)
            | AppUserModel.email.ilike(needle)
        )
        base = base.where(filt)
        count_q = count_q.where(filt)
    total = int((await db.execute(count_q)).scalar_one() or 0)
    result = await db.execute(
        base.order_by(AppUserModel.created_at.desc()).offset(offset).limit(min(limit, 200))
    )
    users = list(result.scalars().all())
    return {
        "items": [
            {
                "id": str(u.id),
                "phone": u.phone,
                "email": u.email,
                "telegram_id": u.telegram_id,
                "full_name": u.display_name,
                "role": "user",
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "count": len(users),
        "total": total,
    }


@router.get("/orders")
async def admin_list_orders(
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
    q: str | None = None,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import OrderModel, ShopModel

    base = select(OrderModel)
    count_q = select(func.count()).select_from(OrderModel)
    if status:
        base = base.where(OrderModel.status == status)
        count_q = count_q.where(OrderModel.status == status)
    if q and q.strip():
        needle = f"%{q.strip()}%"
        filt = (
            OrderModel.customer_phone.ilike(needle)
            | OrderModel.customer_email.ilike(needle)
            | func.cast(OrderModel.id, String).ilike(needle)
        )
        base = base.where(filt)
        count_q = count_q.where(filt)
    total = int((await db.execute(count_q)).scalar_one() or 0)
    result = await db.execute(base.order_by(OrderModel.created_at.desc()).offset(offset).limit(min(limit, 200)))
    orders = list(result.scalars().all())
    shop_ids = {o.shop_id for o in orders if o.shop_id}
    shops: dict = {}
    if shop_ids:
        shop_rows = await db.execute(select(ShopModel).where(ShopModel.id.in_(shop_ids)))
        shops = {s.id: s for s in shop_rows.scalars().all()}
    return {
        "items": [
            {
                "id": str(o.id),
                "status": o.status,
                "total_uzs": float(o.total_price or 0),
                "shop_id": str(o.shop_id) if o.shop_id else None,
                "shop_name": shops[o.shop_id].name if o.shop_id and o.shop_id in shops else None,
                "user_id": str(o.customer_user_id) if o.customer_user_id else None,
                "customer_phone": o.customer_phone,
                "customer_email": o.customer_email,
                "payment_method": o.payment_method,
                "fulfillment_type": o.fulfillment_type,
                "delivery_address": o.delivery_address,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ],
        "count": len(orders),
        "total": total,
    }


@router.get("/orders/{order_id}")
async def admin_get_order(
    order_id: UUID,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel

    order = await db.get(OrderModel, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    shop = await db.get(ShopModel, order.shop_id) if order.shop_id else None
    product = await db.get(ProductModel, order.product_id) if order.product_id else None
    return {
        "id": str(order.id),
        "status": order.status,
        "total_uzs": float(order.total_price or 0),
        "quantity": order.quantity,
        "shop_id": str(order.shop_id) if order.shop_id else None,
        "shop_name": shop.name if shop else None,
        "product_name": product.name if product else None,
        "customer_phone": order.customer_phone,
        "customer_email": order.customer_email,
        "payment_method": order.payment_method,
        "fulfillment_type": order.fulfillment_type,
        "delivery_address": order.delivery_address,
        "delivery_cost_uzs": order.delivery_cost_uzs,
        "note": order.note,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
    }


@router.get("/support/tickets")
async def admin_list_support_tickets(
    limit: int = 50,
    status: str | None = None,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ShopModel
    from app.models.merchant_support import MerchantSupportTicketModel

    q = select(MerchantSupportTicketModel).order_by(MerchantSupportTicketModel.created_at.desc())
    if status:
        q = q.where(MerchantSupportTicketModel.status == status)
    result = await db.execute(q.limit(min(limit, 200)))
    tickets = list(result.scalars().all())
    shop_ids = {t.shop_id for t in tickets}
    shops: dict = {}
    if shop_ids:
        shop_rows = await db.execute(select(ShopModel).where(ShopModel.id.in_(shop_ids)))
        shops = {s.id: s for s in shop_rows.scalars().all()}
    return {
        "items": [
            {
                "id": str(t.id),
                "shop_id": str(t.shop_id),
                "shop_name": shops.get(t.shop_id).name if shops.get(t.shop_id) else None,
                "category": t.category,
                "message": t.message,
                "status": t.status,
                "admin_note": t.admin_note,
                "merchant_phone": t.merchant_phone,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tickets
        ],
        "count": len(tickets),
    }


class SupportTicketUpdateBody(BaseModel):
    status: str | None = Field(default=None, max_length=32)
    admin_note: str | None = Field(default=None, max_length=2000)


@router.patch("/support/tickets/{ticket_id}")
async def admin_update_support_ticket(
    ticket_id: UUID,
    body: SupportTicketUpdateBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.models.merchant_support import MerchantSupportTicketModel

    ticket = await db.get(MerchantSupportTicketModel, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if body.status:
        ticket.status = body.status.strip()
    if body.admin_note is not None:
        ticket.admin_note = body.admin_note.strip() or None
    await db.commit()
    await db.refresh(ticket)
    return {
        "id": str(ticket.id),
        "status": ticket.status,
        "admin_note": ticket.admin_note,
    }


@router.get("/analytics/overview")
async def admin_analytics_overview(
    days: int = 7,
    market_slug: str = "ippodrom",
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Platforma biznes analitikasi — vaqt qatori, holatlar, top do'konlar + bozor."""
    from datetime import timedelta

    from sqlalchemy import func

    from app.application.billing.platform_profit_service import PlatformProfitService
    from app.infrastructure.db.models import AppUserModel, OrderModel, ShopModel

    days = min(max(days, 1), 90)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    order_day = func.date_trunc("day", OrderModel.created_at)
    order_rows = await db.execute(
        select(
            order_day.label("day"),
            func.count(OrderModel.id),
            func.coalesce(func.sum(OrderModel.total_price), 0),
        )
        .where(OrderModel.created_at >= since)
        .group_by(order_day)
        .order_by(order_day)
    )
    orders_series = [
        {
            "date": row.day.date().isoformat() if row.day else "",
            "orders": int(row[1] or 0),
            "revenue_uzs": float(row[2] or 0),
        }
        for row in order_rows.all()
    ]

    status_rows = await db.execute(
        select(OrderModel.status, func.count(OrderModel.id))
        .where(OrderModel.created_at >= since)
        .group_by(OrderModel.status)
        .order_by(func.count(OrderModel.id).desc())
    )
    orders_by_status = [{"status": s, "count": int(c)} for s, c in status_rows.all()]

    user_day = func.date_trunc("day", AppUserModel.created_at)
    user_rows = await db.execute(
        select(user_day.label("day"), func.count(AppUserModel.id))
        .where(AppUserModel.created_at >= since)
        .group_by(user_day)
        .order_by(user_day)
    )
    users_series = [
        {"date": row.day.date().isoformat() if row.day else "", "users": int(row[1] or 0)}
        for row in user_rows.all()
    ]

    shop_rows = await db.execute(
        select(
            ShopModel.id,
            ShopModel.name,
            func.count(OrderModel.id),
            func.coalesce(func.sum(OrderModel.total_price), 0),
        )
        .join(OrderModel, OrderModel.shop_id == ShopModel.id)
        .where(OrderModel.created_at >= since)
        .group_by(ShopModel.id, ShopModel.name)
        .order_by(func.coalesce(func.sum(OrderModel.total_price), 0).desc())
        .limit(10)
    )
    top_shops = [
        {
            "shop_id": str(r[0]),
            "shop_name": r[1],
            "orders": int(r[2] or 0),
            "revenue_uzs": float(r[3] or 0),
        }
        for r in shop_rows.all()
    ]

    period_orders = sum(p["orders"] for p in orders_series)
    period_revenue = sum(p["revenue_uzs"] for p in orders_series)
    period_users = sum(p["users"] for p in users_series)
    avg_order = round(period_revenue / period_orders, 0) if period_orders else 0

    profit = await PlatformProfitService(db).summary()
    market = await AdminMarketAnalyticsService(db).build_report(market_slug, days=days)

    return {
        "days": days,
        "market_slug": market_slug,
        "summary": {
            "orders": period_orders,
            "revenue_uzs": period_revenue,
            "new_users": period_users,
            "avg_order_uzs": avg_order,
            "platform_profit_uzs": float(profit.get("earned_profit_uzs") or 0),
            "total_routes": market.total_routes,
            "total_searches": market.total_searches,
        },
        "orders_series": orders_series,
        "users_series": users_series,
        "orders_by_status": orders_by_status,
        "top_shops": top_shops,
        "market": market.to_dict(),
    }


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


@router.get("/shops")
async def admin_list_shops(
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    verified: bool | None = None,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ShopModel

    base = select(ShopModel).where(ShopModel.is_active.is_(True))
    count_q = select(func.count()).select_from(ShopModel).where(ShopModel.is_active.is_(True))
    if verified is not None:
        base = base.where(ShopModel.is_verified.is_(verified))
        count_q = count_q.where(ShopModel.is_verified.is_(verified))
    if q and q.strip():
        needle = f"%{q.strip()}%"
        filt = ShopModel.name.ilike(needle) | ShopModel.owner_phone.ilike(needle) | ShopModel.slug.ilike(needle)
        base = base.where(filt)
        count_q = count_q.where(filt)
    total = int((await db.execute(count_q)).scalar_one() or 0)
    result = await db.execute(base.order_by(ShopModel.name.asc()).offset(offset).limit(min(limit, 200)))
    shops = list(result.scalars().all())
    return {"items": [shop_to_dict(s) for s in shops], "count": len(shops), "total": total}


@router.get("/shops/pending")
async def admin_list_pending_shops(
    limit: int = 50,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ShopModel

    result = await db.execute(
        select(ShopModel)
        .where(
            ShopModel.is_active == True,
            ShopModel.is_verified == False,
            ShopModel.verification_status.in_(PENDING_STATUSES),
        )
        .order_by(ShopModel.name.asc())
        .limit(min(limit, 200))
    )
    shops = list(result.scalars().all())
    return {"items": [shop_to_dict(s) for s in shops], "count": len(shops)}


class VerifyShopBody(BaseModel):
    verified: bool = True
    reason: str | None = Field(default=None, max_length=500)


class RejectShopBody(BaseModel):
    reason: str = Field(default="Moderator talablariga mos emas.", max_length=500)


@router.get("/shops/{shop_id}")
async def admin_get_shop(
    shop_id: UUID,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ProductModel, ShopModel

    shop = await db.get(ShopModel, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    product_count = int(
        (
            await db.execute(
                select(func.count())
                .select_from(ProductModel)
                .where(ProductModel.shop_id == shop_id, ProductModel.is_available.is_(True))
            )
        ).scalar_one()
        or 0
    )
    payload = shop_to_dict(shop)
    payload.update(
        {
            "owner_email": shop.owner_email,
            "verification_reason": shop.verification_reason,
            "registration_source": shop.registration_source,
            "is_blocked": bool(shop.is_blocked),
            "is_active": bool(shop.is_active),
            "product_count": product_count,
            "telegram_connected": bool(shop.telegram_chat_id),
            "ai_reviewed_at": shop.ai_reviewed_at.isoformat() if shop.ai_reviewed_at else None,
        }
    )
    return payload


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
    from app.application.admin.shop_moderation import ShopModerationError

    svc = AdminShopModerationService(db)
    try:
        if body.verified:
            shop = await svc.approve(shop_id, note=body.reason)
        else:
            shop = await svc.reject(shop_id, reason=body.reason or "Rad etildi.")
    except ShopModerationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return shop_to_dict(shop)


@router.post("/shops/{shop_id}/reject")
async def admin_reject_shop(
    shop_id: UUID,
    body: RejectShopBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.admin.shop_moderation import ShopModerationError

    svc = AdminShopModerationService(db)
    try:
        shop = await svc.reject(shop_id, reason=body.reason)
    except ShopModerationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return shop_to_dict(shop)


class PayoutActionBody(BaseModel):
    reference: str | None = Field(default=None, max_length=128)
    note: str | None = Field(default=None, max_length=500)


@router.get("/payments/incoming")
async def admin_list_incoming_payments(
    limit: int = 50,
    offset: int = 0,
    days: int = 30,
    status: str | None = None,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mijozlardan kelgan to'lovlar (Click va boshqalar) — platforma kirimi."""
    from app.infrastructure.db.models import OrderModel, ShopModel
    from app.models.finance import PlatformTransactionModel
    from app.models.order_checkout_payment import OrderCheckoutPaymentModel

    cutoff = datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 365)))
    lim = min(limit, 200)

    tx_filters = [PlatformTransactionModel.created_at >= cutoff]
    if status:
        tx_filters.append(PlatformTransactionModel.status == status)

    summary_row = (
        await db.execute(
            select(
                func.count(PlatformTransactionModel.id),
                func.coalesce(func.sum(PlatformTransactionModel.total_amount_received), 0),
                func.coalesce(func.sum(PlatformTransactionModel.platform_commission), 0),
            ).where(*tx_filters)
        )
    ).one()

    rows = (
        await db.execute(
            select(PlatformTransactionModel, OrderModel, ShopModel)
            .join(OrderModel, OrderModel.id == PlatformTransactionModel.order_id)
            .join(ShopModel, ShopModel.id == PlatformTransactionModel.shop_id)
            .where(*tx_filters)
            .order_by(PlatformTransactionModel.created_at.desc())
            .offset(offset)
            .limit(lim)
        )
    ).all()

    items = [
        {
            "id": str(tx.id),
            "order_id": str(tx.order_id),
            "shop_id": str(tx.shop_id),
            "shop_name": shop.name,
            "customer_phone": order.customer_phone,
            "amount_uzs": float(tx.total_amount_received),
            "platform_commission_uzs": float(tx.platform_commission),
            "merchant_share_uzs": float(tx.merchant_share),
            "provider": tx.gateway_provider or order.payment_method or "click",
            "reference": tx.gateway_reference,
            "status": tx.status,
            "paid_at": tx.created_at.isoformat() if tx.created_at else None,
        }
        for tx, order, shop in rows
    ]

    # Click checkout — platform_transaction bo'lmagan (kam holat)
    seen_orders = {item["order_id"] for item in items}
    checkout_rows = (
        await db.execute(
            select(OrderCheckoutPaymentModel)
            .where(
                OrderCheckoutPaymentModel.status == "success",
                OrderCheckoutPaymentModel.paid_at >= cutoff,
            )
            .order_by(OrderCheckoutPaymentModel.paid_at.desc())
            .limit(lim)
        )
    ).scalars().all()

    for checkout in checkout_rows:
        order_ids = [str(oid) for oid in (checkout.order_ids or [])]
        if order_ids and order_ids[0] in seen_orders:
            continue
        shop_name = None
        if checkout.shop_id:
            shop = await db.get(ShopModel, checkout.shop_id)
            shop_name = shop.name if shop else None
        items.append(
            {
                "id": str(checkout.id),
                "order_id": order_ids[0] if order_ids else None,
                "shop_id": str(checkout.shop_id) if checkout.shop_id else None,
                "shop_name": shop_name,
                "customer_phone": checkout.customer_phone,
                "amount_uzs": float(checkout.amount_uzs),
                "platform_commission_uzs": None,
                "merchant_share_uzs": None,
                "provider": checkout.provider,
                "reference": checkout.provider_trans_id,
                "status": "paid",
                "paid_at": checkout.paid_at.isoformat() if checkout.paid_at else None,
            }
        )

    items.sort(key=lambda x: x.get("paid_at") or "", reverse=True)
    items = items[:lim]

    return {
        "items": items,
        "count": len(items),
        "summary": {
            "days": days,
            "payments": int(summary_row[0] or 0),
            "total_incoming_uzs": float(summary_row[1] or 0),
            "platform_commission_uzs": float(summary_row[2] or 0),
        },
    }


@router.get("/payouts/pending")
async def admin_list_pending_payouts(
    limit: int = 50,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ShopModel

    result = await db.execute(
        select(MerchantPayoutRequestModel)
        .where(MerchantPayoutRequestModel.status == "pending")
        .order_by(MerchantPayoutRequestModel.created_at.asc())
        .limit(min(limit, 200))
    )
    rows = list(result.scalars().all())
    shop_ids = {r.shop_id for r in rows}
    shops: dict = {}
    if shop_ids:
        shop_rows = await db.execute(select(ShopModel).where(ShopModel.id.in_(shop_ids)))
        shops = {s.id: s for s in shop_rows.scalars().all()}
    total_pending = sum(float(r.amount_uzs) for r in rows)
    return {
        "items": [
            {
                "id": str(r.id),
                "shop_id": str(r.shop_id),
                "shop_name": shops.get(r.shop_id).name if shops.get(r.shop_id) else None,
                "amount_uzs": float(r.amount_uzs),
                "status": r.status,
                "destination": r.destination,
                "reference": r.reference,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "count": len(rows),
        "total_pending_uzs": total_pending,
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


# --- Do'kon qarzi (debt) boshqaruvi -------------------------------------------


@router.get("/shops/{shop_id}/debt")
async def admin_get_shop_debt(
    shop_id: UUID,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Do'konning joriy qarz holati."""
    from app.application.billing.merchant_debt_service import MerchantDebtService

    try:
        return await MerchantDebtService(db).get_shop_debt_status(shop_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


class ClearDebtBody(BaseModel):
    amount_uzs: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)


@router.post("/shops/{shop_id}/clear-debt")
async def admin_clear_shop_debt(
    shop_id: UUID,
    body: ClearDebtBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Do'kon qarzini qo'lda kamaytirish (admin to'lovni tasdiqlaydi)."""
    from app.application.billing.merchant_debt_service import MerchantDebtService

    try:
        return await MerchantDebtService(db).apply_debt_payment(
            shop_id,
            body.amount_uzs,
            reference_type="admin_manual",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# --- Pending mahsulotlar (admin moderatsiya) -----------------------------------


@router.get("/products/pending")
async def admin_list_pending_products(
    limit: int = 50,
    offset: int = 0,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Barcha do'konlardan pending mahsulotlar."""
    from app.infrastructure.db.models import MerchantPendingProductModel, ShopModel

    result = await db.execute(
        select(MerchantPendingProductModel)
        .where(MerchantPendingProductModel.status == "pending")
        .order_by(MerchantPendingProductModel.created_at.desc())
        .offset(offset)
        .limit(min(limit, 200))
    )
    items = list(result.scalars().all())
    shop_ids = {i.shop_id for i in items}
    shops: dict = {}
    if shop_ids:
        shop_rows = await db.execute(select(ShopModel).where(ShopModel.id.in_(shop_ids)))
        shops = {s.id: s for s in shop_rows.scalars().all()}
    total = int(
        (
            await db.execute(
                select(func.count()).select_from(MerchantPendingProductModel).where(
                    MerchantPendingProductModel.status == "pending"
                )
            )
        ).scalar_one()
        or 0
    )
    return {
        "items": [
            {
                "id": str(i.id),
                "shop_id": str(i.shop_id),
                "shop_name": shops.get(i.shop_id).name if shops.get(i.shop_id) else None,
                "status": i.status,
                "vision_attributes": i.vision_attributes,
                "moderation_reason": i.moderation_reason,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in items
        ],
        "count": len(items),
        "total": total,
    }


# --- Business rules (admin CRUD) ----------------------------------------------


@router.get("/business-rules")
async def admin_list_business_rules(
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Barcha biznes qoidalar."""
    from app.application.billing.business_rule_service import BusinessRuleService

    svc = BusinessRuleService(db)
    return {"items": await svc.list_rules()}


class AdminUpsertRuleBody(BaseModel):
    rule_key: str = Field(..., min_length=2, max_length=64)
    rule_value: str
    scope: str = Field(default="global", pattern="^(global|category|product|shop)$")
    is_active: bool = True
    description: str | None = None


@router.post("/business-rules")
async def admin_upsert_business_rule(
    body: AdminUpsertRuleBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Biznes qoidani yaratish yoki yangilash."""
    from app.application.billing.business_rule_service import BusinessRuleService
    from app.models.business_rule import BusinessRuleModel

    result = await db.execute(
        select(BusinessRuleModel).where(
            BusinessRuleModel.rule_key == body.rule_key,
            BusinessRuleModel.scope == body.scope,
            BusinessRuleModel.scope_ref_id.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = BusinessRuleModel(
            rule_key=body.rule_key,
            rule_value=body.rule_value,
            scope=body.scope,
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
    return {"status": "ok", "id": str(row.id), "rule_key": row.rule_key}


@router.delete("/business-rules/{rule_id}")
async def admin_delete_business_rule(
    rule_id: UUID,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Biznes qoidani o'chirish."""
    from app.application.billing.business_rule_service import BusinessRuleService
    from app.models.business_rule import BusinessRuleModel

    row = await db.get(BusinessRuleModel, rule_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(row)
    await db.commit()
    BusinessRuleService.invalidate_cache()
    return {"status": "deleted", "id": str(rule_id)}


# --- Broadcast (barcha do'konlarga xabar) -------------------------------------


class BroadcastBody(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    body: str = Field(..., min_length=2, max_length=2000)
    target: str = Field(default="all", pattern="^(all|verified|blocked)$")


@router.post("/broadcast")
async def admin_broadcast(
    payload: BroadcastBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Barcha (yoki tanlangan) do'konlarga push xabar yuborish."""
    from app.infrastructure.db.models import ShopModel
    from app.infrastructure.messaging.merchant_workspace_hub import MerchantWorkspaceHub

    q = select(ShopModel).where(ShopModel.is_active.is_(True))
    if payload.target == "verified":
        q = q.where(ShopModel.is_verified.is_(True))
    elif payload.target == "blocked":
        q = q.where(ShopModel.is_blocked.is_(True))

    result = await db.execute(q)
    shops = list(result.scalars().all())
    hub = MerchantWorkspaceHub(db)
    sent = 0
    for shop in shops:
        try:
            await hub.push_alert(
                shop.id,
                {
                    "type": "admin_broadcast",
                    "title": payload.title,
                    "body": payload.body,
                },
            )
            sent += 1
        except Exception:
            pass
    return {"status": "ok", "sent": sent, "total": len(shops), "target": payload.target}
