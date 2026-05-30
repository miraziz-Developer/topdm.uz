from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.marketplace.use_cases import MarketplaceUseCases
from app.core.config import get_settings
from app.infrastructure.auth.deps import AuthUser, get_current_user, get_optional_user, require_merchant
from app.infrastructure.auth.merchant_resolve import customer_phone_for_user, resolve_merchant_shop
from app.infrastructure.db.session import get_db_session
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.interfaces.api.serializers import product_to_dict, shop_to_dict

router = APIRouter()


class OrderCreateRequest(BaseModel):
    product_id: UUID
    quantity: int = Field(default=1, ge=1, le=99)
    note: str | None = None
    ref_token: str | None = None


class FeaturedUpdateRequest(BaseModel):
    featured: bool = True


class LeadStatusUpdateRequest(BaseModel):
    status: str
    note: str | None = None


class OrderStatusUpdateRequest(BaseModel):
    status: str


def marketplace_use_case(db: AsyncSession = Depends(get_db_session)) -> MarketplaceUseCases:
    return MarketplaceUseCases(
        repo=MarketplaceRepository(db),
        notifier=TelegramNotifierGateway(get_settings().telegram_bot_token),
    )


@router.get("/shops/{slug}")
async def get_shop_by_slug(slug: str, db: AsyncSession = Depends(get_db_session)) -> dict:
    repo = MarketplaceRepository(db)
    shop = await repo.get_shop_by_slug(slug)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop_to_dict(shop)


@router.get("/shops/{slug}/products")
async def list_shop_products(
    slug: str,
    page: int = 1,
    limit: int = 24,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    repo = MarketplaceRepository(db)
    shop = await repo.get_shop_by_slug(slug)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    offset = (page - 1) * limit
    products = await repo.list_shop_products(shop.id, limit=limit, offset=offset)
    return {
        "shop": shop_to_dict(shop),
        "items": [product_to_dict(product) for product in products],
        "page": page,
        "total": len(products),
    }


@router.post("/orders")
async def create_order(
    payload: OrderCreateRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    use_case: MarketplaceUseCases = Depends(marketplace_use_case),
) -> dict:
    phone = await customer_phone_for_user(db, user)
    if not phone:
        raise HTTPException(status_code=400, detail="Buyurtma uchun telefon raqamingizni profilga qo'shing")
    try:
        return await use_case.create_order(
            customer_phone=phone,
            product_id=payload.product_id,
            quantity=payload.quantity,
            note=payload.note,
            ref_token=payload.ref_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/orders/me")
async def list_my_orders(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    use_case: MarketplaceUseCases = Depends(marketplace_use_case),
) -> dict:
    phone = await customer_phone_for_user(db, user)
    if not phone:
        return {"items": []}
    items = await use_case.get_live_orders(phone)
    return {"items": items}


@router.get("/orders/{order_id}")
async def get_my_order(
    order_id: UUID,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    use_case: MarketplaceUseCases = Depends(marketplace_use_case),
) -> dict:
    phone = await customer_phone_for_user(db, user)
    if not phone:
        raise HTTPException(status_code=400, detail="Telefon raqam topilmadi")
    try:
        return await use_case.get_customer_order(phone, order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


class OrderApproachPingBody(BaseModel):
    phone: str | None = Field(default=None, max_length=20)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    local_x: float | None = None
    local_y: float | None = None
    market_slug: str = Field(default="ippodrom", max_length=64)
    level: int = Field(default=1, ge=1, le=5)


@router.post("/orders/{order_id}/approach-ping")
async def order_approach_ping(
    order_id: UUID,
    body: OrderApproachPingBody,
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.merchant.customer_approach import CustomerApproachService

    phone = body.phone
    if user:
        linked = await customer_phone_for_user(db, user)
        if linked:
            phone = linked
    if not phone and not body.lat and body.local_x is None:
        raise HTTPException(status_code=422, detail="Telefon yoki joylashuv kerak")

    service = CustomerApproachService(db)
    try:
        return await service.record_ping(
            order_id,
            customer_phone=phone,
            lat=body.lat,
            lng=body.lng,
            local_x=body.local_x,
            local_y=body.local_y,
            market_slug=body.market_slug,
            level=body.level,
        )
    except ValueError as exc:
        code = str(exc)
        if code in {"order_not_found", "shop_not_found"}:
            raise HTTPException(status_code=404, detail=code) from exc
        if code == "phone_mismatch":
            raise HTTPException(status_code=403, detail="Telefon mos kelmadi") from exc
        if code == "phone_required":
            raise HTTPException(status_code=422, detail="Telefon raqam kerak") from exc
        if code == "order_not_active":
            raise HTTPException(status_code=400, detail="Buyurtma faol emas") from exc
        raise HTTPException(status_code=400, detail=code) from exc


@router.get("/merchant/me")
async def merchant_me(user: AuthUser = Depends(require_merchant), db: AsyncSession = Depends(get_db_session)) -> dict:
    repo = MarketplaceRepository(db)
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return {"email": user.email, "phone": user.phone, "shop": shop_to_dict(shop)}


@router.get("/merchant/dashboard")
async def merchant_dashboard(
    user: AuthUser = Depends(require_merchant),
    use_case: MarketplaceUseCases = Depends(marketplace_use_case),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    repo = MarketplaceRepository(db)
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    dashboard = await use_case.get_shop_dashboard(shop.id)
    from app.application.merchant.order_pickup_completion import OrderPickupCompletionService
    from app.infrastructure.cache.redis_gateway import RedisCacheGateway

    orders = await repo.list_shop_orders(shop.id, limit=20)
    pickup_svc = OrderPickupCompletionService(db)
    cache = RedisCacheGateway()
    order_rows: list[dict] = []
    for order in orders:
        row = {
            "id": str(order.id),
            "status": order.status,
            "total_price": order.total_price,
            "quantity": order.quantity,
            "product_name": order.product.name if order.product else "",
            "customer_phone": order.customer_phone,
            "pickup_date": order.pickup_date.isoformat() if order.pickup_date else None,
            "pickup_time": order.pickup_time,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "arrival_status": None,
            "dwell_minutes": None,
        }
        approach = await cache.get(f"approach:order:{order.id}")
        if isinstance(approach, dict):
            row["arrival_status"] = approach.get("arrival_status")
            row["dwell_minutes"] = approach.get("dwell_minutes")
            row["distance_label"] = approach.get("distance_label")
        arrival = await pickup_svc.get_arrival_meta(order.id)
        if isinstance(arrival, dict) and arrival.get("first_seen_at"):
            row["arrival_status"] = row["arrival_status"] or "at_shop"
            row["dwell_minutes"] = row["dwell_minutes"] or arrival.get("dwell_minutes")
        order_rows.append(row)
    dashboard["orders"] = order_rows
    return dashboard


@router.patch("/merchant/leads/{lead_id}")
async def merchant_update_lead(
    lead_id: UUID,
    payload: LeadStatusUpdateRequest,
    user: AuthUser = Depends(require_merchant),
    use_case: MarketplaceUseCases = Depends(marketplace_use_case),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    repo = MarketplaceRepository(db)
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    try:
        return await use_case.update_lead_status(
            shop_id=shop.id,
            lead_id=lead_id,
            status=payload.status,
            note=payload.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/merchant/orders/{order_id}")
async def merchant_update_order(
    order_id: UUID,
    payload: OrderStatusUpdateRequest,
    user: AuthUser = Depends(require_merchant),
    use_case: MarketplaceUseCases = Depends(marketplace_use_case),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    repo = MarketplaceRepository(db)
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    try:
        return await use_case.update_order_status(shop_id=shop.id, order_id=order_id, status=payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class IndoorStallPositionUpdateRequest(BaseModel):
    local_x: float = Field(ge=0)
    local_y: float = Field(ge=0)
    graph_node_id: str | None = Field(default=None, max_length=64)
    snap_to_nearest_node: bool = False


class IndoorStallAssignRequest(BaseModel):
    shop_id: UUID | None = None


class MerchantPrecisionLocationRequest(BaseModel):
    market_slug: str = "ippodrom"
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)
    floor: str = Field(min_length=1, max_length=50)
    block: str = Field(min_length=1, max_length=16)
    stall: str = Field(min_length=1, max_length=32)
    comment: str = Field(min_length=3, max_length=300)
    indoor_pin_x: float = Field(ge=0)
    indoor_pin_y: float = Field(ge=0)


class MerchantWorkspaceDraftPatch(BaseModel):
    floor: str | None = None
    block: str | None = None
    stall: str | None = None
    comment: str | None = None
    product_price: int | None = Field(default=None, ge=0)
    product_size: str | None = None
    product_color: str | None = None
    indoor_pin_x: float | None = Field(default=None, ge=0)
    indoor_pin_y: float | None = Field(default=None, ge=0)


@router.patch("/merchant/indoor-stalls/{stall_id}/position")
async def merchant_update_indoor_stall_position(
    stall_id: UUID,
    payload: IndoorStallPositionUpdateRequest,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.repositories.indoor_map_repo import IndoorMapRepository

    repo = IndoorMapRepository(db)
    stall = await repo.get_stall(stall_id)
    if not stall:
        raise HTTPException(status_code=404, detail="Stall not found")
    if not user.shop_id or stall.shop_id != user.shop_id:
        raise HTTPException(status_code=403, detail="Stall is not assigned to your shop")

    from app.application.indoor_navigation.graph_snap import snap_stall_to_navigation_graph

    local_x = payload.local_x
    local_y = payload.local_y
    resolved_gid: str | None = payload.graph_node_id
    if payload.snap_to_nearest_node:
        plan = await repo.get_floor_plan_by_id(stall.floor_plan_id)
        graph = (plan.navigation_graph if plan else {}) or {}
        if graph:
            cx = payload.local_x + stall.width / 2
            cy = payload.local_y + stall.height / 2
            snap_x, snap_y, nearest = snap_stall_to_navigation_graph(graph, cx, cy)
            if nearest:
                resolved_gid = nearest
                local_x = snap_x - stall.width / 2
                local_y = snap_y - stall.height / 2

    pos_kw: dict = {}
    if payload.snap_to_nearest_node or payload.graph_node_id:
        if resolved_gid:
            pos_kw["graph_node_id"] = resolved_gid

    stall = await repo.update_stall_position(stall, local_x, local_y, **pos_kw)
    await db.commit()
    return repo.stall_to_dict(stall)


@router.patch("/merchant/indoor-stalls/{stall_id}/assign")
async def merchant_assign_indoor_stall(
    stall_id: UUID,
    payload: IndoorStallAssignRequest,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.repositories.indoor_map_repo import IndoorMapRepository

    repo = IndoorMapRepository(db)
    stall = await repo.get_stall(stall_id)
    if not stall:
        raise HTTPException(status_code=404, detail="Stall not found")
    shop = await repo.get_shop(user.shop_id) if user.shop_id else None
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    if payload.shop_id and payload.shop_id != shop.id:
        raise HTTPException(status_code=403, detail="Cannot assign stall to another shop")

    stall = await repo.assign_shop_to_stall(stall, shop if payload.shop_id is not None else None)
    await db.commit()
    return repo.stall_to_dict(stall)


@router.post("/merchant/precision-location")
async def merchant_save_precision_location(
    payload: MerchantPrecisionLocationRequest,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.merchant.precision_location import assert_gps_inside_market

    assert_gps_inside_market(payload.latitude, payload.longitude, payload.market_slug)

    from app.infrastructure.repositories.indoor_map_repo import IndoorMapRepository

    repo = IndoorMapRepository(db)
    shop = await repo.get_shop(user.shop_id) if user.shop_id else None
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")

    shop = await repo.update_shop_precision_location(
        shop,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy=payload.accuracy,
        floor=payload.floor,
        block=payload.block.upper(),
        stall=payload.stall,
        comment=payload.comment,
        pin_x=payload.indoor_pin_x,
        pin_y=payload.indoor_pin_y,
    )
    await db.commit()
    return {
        "status": "ok",
        "shop_id": str(shop.id),
        "floor": shop.floor,
        "section": shop.section,
        "location_comment": shop.location_comment,
        "indoor_pin": {"x": shop.indoor_pin_x, "y": shop.indoor_pin_y},
        "gps": {
            "latitude": shop.latitude,
            "longitude": shop.longitude,
            "accuracy": shop.location_accuracy,
        },
    }


@router.get("/merchant/workspace-draft")
async def get_merchant_workspace_draft(user: AuthUser = Depends(require_merchant)) -> dict:
    from app.application.merchant.workspace_draft import load_workspace_draft

    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    draft = await load_workspace_draft(user.shop_id)
    return {"draft": draft}


@router.patch("/merchant/workspace-draft")
async def patch_merchant_workspace_draft(
    payload: MerchantWorkspaceDraftPatch,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.merchant.ai_inspector import AIInspectorService
    from app.application.merchant.workspace_draft import merge_workspace_draft

    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    merged = await merge_workspace_draft(user.shop_id, payload.model_dump(exclude_none=True))
    price_warning: str | None = None
    if payload.product_price is not None:
        inspector = AIInspectorService(db)
        check = await inspector.check_price(
            int(payload.product_price),
            category=None,
            product_name=None,
        )
        if check.flagged:
            price_warning = check.message
    return {"draft": merged, "autosaved": True, "price_warning": price_warning}


@router.get("/merchant/analytics/heatmap")
async def merchant_analytics_heatmap(
    market_slug: str = "ippodrom",
    level: int = 1,
    days: int = 30,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.merchant.market_stats_service import MarketStatsService

    _ = user
    service = MarketStatsService(db)
    payload = await service.heatmap(market_slug, level=level, days=days)
    return payload.to_dict()


@router.get("/platform/checkout-payment-options")
async def checkout_payment_options() -> dict:
    """Public payment capabilities for customer checkout UI."""
    settings = get_settings()
    enabled = settings.enable_online_checkout
    click_ready = enabled and bool(settings.click_service_id and settings.click_secret_key)
    payme_ready = enabled and bool(settings.payme_merchant_id and settings.payme_secret_key)
    return {
        "in_store": ["cash", "terminal"],
        "online": {
            "click": click_ready,
            "payme": payme_ready,
            "bridge": enabled,
        },
    }


@router.get("/platform/payment-redirect")
async def customer_payment_redirect(
    provider: str,
    amount: int,
    order_id: UUID | None = None,
    checkout_id: UUID | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Build Click/Payme redirect URL for a pickup reservation (guest checkout)."""
    from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
    from app.infrastructure.repositories.order_payment_repo import OrderPaymentRepository

    settings = get_settings()
    if not settings.enable_online_checkout:
        raise HTTPException(status_code=403, detail="online_checkout_disabled")

    prov = provider.strip().lower()
    if prov not in ("click", "payme"):
        raise HTTPException(status_code=400, detail="invalid_provider")

    if amount < 1_000:
        raise HTTPException(status_code=400, detail="invalid_amount")

    if not checkout_id and not order_id:
        raise HTTPException(status_code=400, detail="checkout_or_order_required")

    pay_target: UUID
    bridge_query: str

    if checkout_id:
        checkout = await OrderPaymentRepository(db).get_checkout(checkout_id)
        if not checkout:
            raise HTTPException(status_code=404, detail="checkout_not_found")
        if int(checkout.amount_uzs) != int(amount):
            raise HTTPException(status_code=400, detail="amount_mismatch")
        if checkout.provider != prov:
            raise HTTPException(status_code=400, detail="provider_mismatch")
        pay_target = checkout_id
        bridge_query = f"checkout_id={checkout_id}&amount={amount}"
    else:
        repo = MarketplaceRepository(db)
        order = await repo.get_order_by_id(order_id)  # type: ignore[arg-type]
        if not order:
            raise HTTPException(status_code=404, detail="order_not_found")
        if int(order.total_price) != int(amount):
            raise HTTPException(status_code=400, detail="amount_mismatch")
        pay_target = order_id  # type: ignore[assignment]
        bridge_query = f"order_id={order_id}&amount={amount}"

    site = (settings.payment_checkout_base_url or settings.site_url or "https://topdim.uz").rstrip("/")

    if prov == "click":
        if not settings.click_service_id:
            return {
                "url": None,
                "bridge_url": f"{site}/checkout/click?{bridge_query}",
                "message": "Click sozlanmagan — do'konda to'lang yoki qo'llab-quvvatlash.",
            }
        return {
            "url": (
                f"https://my.click.uz/services/pay"
                f"?service_id={settings.click_service_id}"
                f"&merchant_id={settings.click_merchant_id or settings.click_service_id}"
                f"&amount={amount}"
                f"&transaction_param={pay_target}"
            ),
            "bridge_url": f"{site}/checkout/click?{bridge_query}",
        }

    if not settings.payme_merchant_id:
        return {
            "url": None,
            "bridge_url": f"{site}/checkout/payme?{bridge_query}",
            "message": "Payme sozlanmagan — do'konda to'lang.",
        }

    amount_tiyin = amount * 100
    merchant_param = f"{settings.payme_merchant_id};{pay_target};{amount_tiyin}"
    return {
        "url": f"https://checkout.paycom.uz/{merchant_param}",
        "bridge_url": f"{site}/checkout/payme?{bridge_query}",
    }
