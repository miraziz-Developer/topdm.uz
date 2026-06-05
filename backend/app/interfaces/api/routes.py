from loguru import logger

from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import Form
from fastapi import HTTPException
from fastapi import UploadFile
from pydantic import AliasChoices, BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.application.marketplace.use_cases import MarketplaceUseCases
from app.application.stylist.use_case import StylistUseCase
from app.domain.value_objects.search_query import SearchQuery
from app.infrastructure.ai_clients.claude import ClaudeClient
from app.infrastructure.ai_clients.embedding import EmbeddingClient
from app.infrastructure.ai_clients.gemini import GeminiClient
from app.core.config import get_settings
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from app.infrastructure.db.session import get_db_session
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.product_repo import ProductRepo
from app.interfaces.api.serializers import product_to_dict, shop_to_dict

router = APIRouter()


class StylistRequest(BaseModel):
    user_id: str
    text: str | None = None
    image_url: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    block: str | None = None


class ProductCreateRequest(BaseModel):
    shop_id: UUID
    category_id: UUID | None = None
    name: str
    description: str | None = None
    price: int
    images: list[str] = Field(default_factory=list)
    attributes: dict = Field(default_factory=dict)
    embedding: list[float]


class LeadCreateRequest(BaseModel):
    product_id: UUID
    shop_id: UUID | None = None
    customer_phone: str = Field(validation_alias=AliasChoices("customer_phone", "phone"))
    customer_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("customer_name", "customerName", "name"),
    )
    note: str | None = Field(default=None, max_length=300)
    ref_token: str | None = Field(default=None, validation_alias=AliasChoices("ref_token", "refToken"))


class TrackEventRequest(BaseModel):
    event_type: str
    product_id: UUID | None = None
    shop_id: UUID | None = None
    ref_token: str | None = None
    session_id: str | None = None
    metadata: dict = Field(default_factory=dict)

    @field_validator("product_id", "shop_id", mode="before")
    @classmethod
    def empty_str_to_none_uuid(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

def vision_search_hint(attributes: dict) -> str:
    parts: list[str] = []
    for key in ("category", "color", "material"):
        value = attributes.get(key)
        if value:
            parts.append(str(value))
    for tag in attributes.get("style_tags") or []:
        if tag:
            parts.append(str(tag))
    return " ".join(parts).strip() or "Rasm bo'yicha qidiruv"


class VisualSearchRefineRequest(BaseModel):
    label_uz: str = Field(min_length=1, max_length=120)
    search_query: str = Field(min_length=1, max_length=500)
    selected_category: str | None = Field(default=None, max_length=64)
    category: str | None = Field(default=None, max_length=64)
    color: str | None = Field(default=None, max_length=64)
    material: str | None = Field(default=None, max_length=64)
    intent_text: str | None = Field(default=None, max_length=500)
    min_price: int | None = None
    max_price: int | None = None
    limit: int = Field(default=24, ge=4, le=48)
    crop_base64: str | None = Field(default=None, max_length=500_000)


class LookSearchRequest(BaseModel):
    q: str = Field(min_length=2, max_length=500)


class StylistChatPayload(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


@router.post("/search/transcribe")
async def transcribe_voice_search(file: UploadFile = File(...)) -> dict:
    """Ovozli qidiruv — Groq Whisper (tez), keyin OpenAI Whisper."""
    from app.core.config import get_settings

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty audio")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio must be 5MB or smaller")

    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("audio/") and "webm" not in content_type and "ogg" not in content_type:
        raise HTTPException(status_code=400, detail="Only audio uploads are supported")

    filename = file.filename or "voice.webm"
    settings = get_settings()

    if settings.groq_api_key:
        try:
            from app.infrastructure.ai_clients.groq_whisper import GroqWhisperClient

            text = await GroqWhisperClient().transcribe(raw, filename=filename)
            return {"text": text}
        except Exception as exc:
            logger.warning("groq_voice_transcribe_failed", error=str(exc)[:180])

    try:
        from app.infrastructure.ai_clients.whisper import WhisperClient

        client = WhisperClient()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="voice_transcription_unavailable") from exc

    try:
        text = await client.transcribe(raw, filename=filename)
    except Exception as exc:
        logger.exception("voice_transcribe_failed")
        raise HTTPException(status_code=502, detail="voice_transcription_failed") from exc

    return {"text": text}


@router.post("/products/search-by-image")
async def search_products_by_image(
    file: UploadFile = File(...),
    q: str | None = Form(None),
    page: int = 1,
    limit: int = 24,
    fast: bool = True,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.visual_search.outfit_search import search_outfit_from_image

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image file")
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be 8MB or smaller")

    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported")

    try:
        payload = await search_outfit_from_image(
            db,
            raw,
            limit_per_item=max(4, limit // 4),
            max_items=6,
            intent_text=(q or "").strip() or None,
            fast=fast,
        )
    except Exception as exc:
        logger.exception("search_by_image_failed")
        raise HTTPException(status_code=502, detail="Image search failed") from exc

    payload["page"] = page
    return payload


@router.post("/products/search-visual-refine")
async def search_visual_refine(
    body: VisualSearchRefineRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.visual_search.outfit_search import refine_visual_search_category

    try:
        return await refine_visual_search_category(
            db,
            label_uz=body.label_uz.strip(),
            search_query=body.search_query.strip(),
            category=(body.selected_category or body.category or "").strip() or None,
            color=body.color,
            material=body.material,
            intent_text=body.intent_text,
            min_price=body.min_price,
            max_price=body.max_price,
            limit=body.limit,
            crop_base64=body.crop_base64,
        )
    except Exception as exc:
        logger.exception("search_visual_refine_failed")
        raise HTTPException(status_code=502, detail="Visual category search failed") from exc


@router.post("/products/search-look")
async def search_products_look(
    body: LookSearchRequest,
    page: int = 1,
    limit: int = 24,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.visual_search.outfit_search import search_look_from_text

    try:
        payload = await search_look_from_text(db, body.q.strip(), limit=limit)
    except Exception as exc:
        logger.exception("search_look_failed")
        raise HTTPException(status_code=502, detail="Look search failed") from exc

    payload["page"] = page
    return payload


@router.post("/stylist/lookbook")
async def stylist_lookbook(payload: StylistRequest, db: AsyncSession = Depends(get_db_session)) -> dict:
    from app.application.stylist.budget_from_text import merge_payload_budget

    eff_min, eff_max = merge_payload_budget(payload.text, payload.min_price, payload.max_price)
    use_case = StylistUseCase(
        product_repo=ProductRepo(db),
        cache=RedisCacheGateway(),
        claude=ClaudeClient(),
        gemini=GeminiClient(),
        embedding=EmbeddingClient(),
    )
    result = await use_case.execute(
        user_id=payload.user_id,
        query=SearchQuery(text=payload.text, image_url=payload.image_url),
        min_price=eff_min,
        max_price=eff_max,
        block=payload.block,
    )
    if result.get("error"):
        message = str(result["error"])
        if "rate limit" in message.lower():
            raise HTTPException(status_code=429, detail=message)
        raise HTTPException(status_code=503, detail=message)

    marketplace_repo = MarketplaceRepository(db)
    enriched: list[dict] = []
    for item in result.get("lookbook") or []:
        product_id = UUID(str(item["product_id"]))
        product = await marketplace_repo.get_product_by_id(product_id)
        if product is None:
            continue
        enriched.append({**item, "product": product_to_dict(product)})
    if eff_min is not None or eff_max is not None:
        enriched = [
            item
            for item in enriched
            if item.get("product")
            and (eff_min is None or item["product"]["price"] >= int(eff_min))
            and (eff_max is None or item["product"]["price"] <= int(eff_max))
        ]
    result["lookbook"] = enriched
    return result


@router.post("/stylist/chat")
async def chat_with_stylist(
    payload: StylistChatPayload,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Groq-only universal stylist (same pipeline as /chat/agent/turn)."""
    from app.ai.config import require_groq_api_key
    from app.application.stylist.catalog_fetch import fetch_stylist_catalog
    from app.application.stylist.groq_chat_turn import execute_groq_chat_turn

    try:
        require_groq_api_key()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    message = payload.message.strip()
    try:
        from app.infrastructure.cache.chat_history_store import ChatHistoryStore
        from app.application.stylist.stylist_session import StylistSessionStore
        from app.services.groq_stylist import get_groq_stylist_service

        user_key = "stylist-chat"
        history = await ChatHistoryStore().load(user_key, user_key, max_messages=20)
        session = await StylistSessionStore().load(user_key, user_key)
        stylist = get_groq_stylist_service()
        analysis = await stylist.analyze_message(message, history=history, session=session)
        catalog = (
            []
            if analysis.get("intent") == "chitchat"
            else await fetch_stylist_catalog(db, message, limit=64, analysis=analysis)
        )
        result = await execute_groq_chat_turn(
            message,
            catalog,
            analysis=analysis,
            history=history,
            session=session,
        )
    except Exception as exc:
        logger.exception("stylist_chat_failed")
        raise HTTPException(status_code=502, detail="Stylist chat failed") from exc

    product_ids: list[str] = []
    for block in result.get("blocks") or []:
        if isinstance(block, dict) and block.get("type") == "product_cards":
            product_ids.extend(str(i) for i in block.get("product_ids") or [])

    return {
        "reply": str(result.get("assistant_text") or "").strip(),
        "route": result.get("route"),
        "selected_product_ids": product_ids,
        "blocks": result.get("blocks") or [],
        "suggestions": result.get("suggestions") or [],
        "strict_error": result.get("strict_error"),
    }


@router.post("/products")
async def create_product(payload: ProductCreateRequest, db: AsyncSession = Depends(get_db_session)) -> dict:
    use_case = MarketplaceUseCases(
        repo=MarketplaceRepository(db),
        notifier=TelegramNotifierGateway(get_settings().telegram_bot_token),
    )
    try:
        return await use_case.create_product(
            shop_id=payload.shop_id,
            category_id=payload.category_id,
            name=payload.name,
            description=payload.description,
            price=payload.price,
            images=payload.images,
            attributes=payload.attributes,
            embedding=payload.embedding,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/leads")
async def create_lead(payload: LeadCreateRequest, db: AsyncSession = Depends(get_db_session)) -> dict:
    repo = MarketplaceRepository(db)
    use_case = MarketplaceUseCases(repo=repo, notifier=TelegramNotifierGateway(get_settings().telegram_bot_token))
    try:
        shop_id = payload.shop_id
        if not shop_id:
            p = await repo.get_product_by_id(payload.product_id)
            if not p:
                raise HTTPException(status_code=404, detail="Product not found")
            shop_id = p.shop_id
        return await use_case.create_lead(
            product_id=payload.product_id,
            shop_id=shop_id,
            customer_phone=payload.customer_phone,
            customer_name=payload.customer_name,
            note=payload.note,
            ref_token=payload.ref_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/tracking/events")
async def create_tracking_event(payload: TrackEventRequest, db: AsyncSession = Depends(get_db_session)) -> dict:
    use_case = MarketplaceUseCases(
        repo=MarketplaceRepository(db),
        notifier=TelegramNotifierGateway(get_settings().telegram_bot_token),
    )
    try:
        return await use_case.track_event(
            event_type=payload.event_type,
            product_id=payload.product_id,
            shop_id=payload.shop_id,
            ref_token=payload.ref_token,
            session_id=payload.session_id,
            metadata=payload.metadata,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/dashboard/shop/{shop_id}")
async def shop_dashboard(shop_id: UUID, db: AsyncSession = Depends(get_db_session)) -> dict:
    use_case = MarketplaceUseCases(
        repo=MarketplaceRepository(db),
        notifier=TelegramNotifierGateway(get_settings().telegram_bot_token),
    )
    return await use_case.get_shop_dashboard(shop_id)

@router.get("/products/search")
async def search_products(
    q: str | None = None,
    page: int = 1,
    limit: int = 12,
    category_id: UUID | None = None,
    ipadrom_id: UUID | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    sale_type: str | None = None,
    market_zone: str | None = None,
    block_sector: str | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    repo = MarketplaceRepository(db)
    offset = (page - 1) * limit
    products = await repo.search_products(
        q,
        limit,
        offset,
        category_id=category_id,
        ipadrom_id=ipadrom_id,
        min_price=min_price,
        max_price=max_price,
        sale_type=sale_type,
        market_zone=market_zone,
        block_sector=block_sector,
    )
    total = await repo.count_products(
        q,
        category_id=category_id,
        ipadrom_id=ipadrom_id,
        min_price=min_price,
        max_price=max_price,
        sale_type=sale_type,
        market_zone=market_zone,
        block_sector=block_sector,
    )
    if q and q.strip():
        try:
            use_case = MarketplaceUseCases(
                repo=repo,
                notifier=TelegramNotifierGateway(get_settings().telegram_bot_token),
            )
            await use_case.track_event(
                event_type="search",
                product_id=None,
                shop_id=None,
                ref_token=None,
                session_id=None,
                metadata={"q": q.strip(), "page": page},
            )
        except ValueError:
            logger.debug("search_track_event_skipped", query=q)
    from app.application.marketplace.product_list_enrichment import products_to_public_dicts

    return {
        "items": await products_to_public_dicts(db, products),
        "total": total,
        "page": page,
    }

@router.get("/products/featured")
async def list_featured_products(limit: int = 12, db: AsyncSession = Depends(get_db_session)) -> dict:
    """Featured products for the home page (declared above /products/{id} to avoid path collision)."""
    from app.application.marketplace.product_list_enrichment import products_to_public_dicts

    repo = MarketplaceRepository(db)
    products = await repo.list_featured_products(limit=limit)
    return {"items": await products_to_public_dicts(db, products)}


@router.get("/products/deals/lightning")
async def list_lightning_deals(limit: int = 16, db: AsyncSession = Depends(get_db_session)) -> dict:
    from app.application.marketplace.product_list_enrichment import products_to_public_dicts

    repo = MarketplaceRepository(db)
    products = await repo.list_lightning_deal_products(limit=min(limit, 24))
    return {"items": await products_to_public_dicts(db, products)}


@router.get("/products/deals/clearance")
async def list_clearance_deals(limit: int = 16, db: AsyncSession = Depends(get_db_session)) -> dict:
    from app.application.marketplace.product_list_enrichment import products_to_public_dicts

    repo = MarketplaceRepository(db)
    products = await repo.list_clearance_deal_products(limit=min(limit, 24))
    return {"items": await products_to_public_dicts(db, products)}


@router.get("/products/{id}")
async def get_product(id: UUID, db: AsyncSession = Depends(get_db_session)) -> dict:
    from sqlalchemy import func, select

    from app.infrastructure.db.models import OrderModel

    repo = MarketplaceRepository(db)
    await repo.increment_product_view_count(id)
    p = await repo.get_product_by_id(id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    shop = getattr(p, "shop", None)
    if shop and (not shop.is_active or getattr(shop, "is_blocked", False)):
        raise HTTPException(status_code=404, detail="Product not found")
    sold_count = await db.scalar(
        select(func.coalesce(func.sum(OrderModel.quantity), 0)).where(
            OrderModel.product_id == id,
            OrderModel.status == "completed",
        )
    )
    setattr(p, "sold_count", int(sold_count or 0))
    from app.application.marketplace.product_review_service import ProductReviewService

    review_summary = await ProductReviewService(db).get_summary(id)
    payload = product_to_dict(p)
    payload["review_summary"] = review_summary
    return payload

@router.get("/products/{id}/similar")
async def get_similar(id: UUID, db: AsyncSession = Depends(get_db_session)) -> dict:
    from app.application.marketplace.product_list_enrichment import products_to_public_dicts

    repo = MarketplaceRepository(db)
    products = await repo.get_similar_products(id)
    return {"items": await products_to_public_dicts(db, products)}

@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db_session)) -> list[dict]:
    from app.infrastructure.db.models import CategoryModel
    from sqlalchemy import select
    result = await db.execute(select(CategoryModel).order_by(CategoryModel.sort_order))
    cats = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "name_ru": c.name_ru,
            "icon": c.icon,
            "parent_id": str(c.parent_id) if c.parent_id else None,
            "sort_order": c.sort_order,
        }
        for c in cats
    ]

@router.get("/ipadroms")
async def list_ipadroms(db: AsyncSession = Depends(get_db_session)) -> list[dict]:
    from app.infrastructure.db.models import IpadromModel
    from sqlalchemy import select
    result = await db.execute(select(IpadromModel).where(IpadromModel.is_active == True))
    return [
        {
            "id": str(i.id),
            "name": i.name,
            "city": i.city,
            "address": i.address,
        }
        for i in result.scalars().all()
    ]


@router.get("/shops/featured")
async def list_featured_shops(
    ipadrom_id: UUID | None = None,
    market_slug: str | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import IpadromModel

    resolved_ipadrom_id = ipadrom_id
    if market_slug and not resolved_ipadrom_id:
        slug = market_slug.lower().strip()
        row = await db.execute(select(IpadromModel).where(func.lower(IpadromModel.name).contains(slug)))
        match = row.scalars().first()
        if match:
            resolved_ipadrom_id = match.id

    repo = MarketplaceRepository(db)
    shops = await repo.list_featured_shops(ipadrom_id=resolved_ipadrom_id)
    return {"items": [shop_to_dict(s) for s in shops]}


from app.interfaces.api.auth_routes import router as auth_router
from app.interfaces.api.admin_routes import router as admin_router
from app.interfaces.api.merchant_pending_routes import router as merchant_pending_router
from app.interfaces.api.merchant_chat_routes import router as merchant_chat_router
from app.interfaces.api.media_routes import router as media_router
from app.interfaces.api.chat_routes import router as shop_chat_router
from app.api.map import router as map_router
from app.api.orders import router as orders_router
from app.interfaces.api.merchant_workspace_routes import router as merchant_workspace_router
from app.interfaces.api.merchant_product_routes import router as merchant_product_router
from app.interfaces.api.merchant_shop_routes import router as merchant_shop_router
from app.interfaces.api.platform_routes import router as platform_router
from app.interfaces.api.indoor_map_routes import router as indoor_map_router
from app.interfaces.api.chat_agent_routes import router as chat_agent_router
from app.interfaces.api.moderation_routes import router as moderation_router
from app.interfaces.api.merchant_stories_routes import router as merchant_stories_router
from app.interfaces.api.market_stories_routes import router as market_stories_router
from app.interfaces.api.experience_routes import router as experience_router
from app.interfaces.api.home_routes import router as home_router
from app.interfaces.api.premium_admin_routes import router as premium_admin_router
from app.interfaces.api.crm_banner_routes import router as crm_banner_router
from app.interfaces.api.crm_shop_trust_routes import router as crm_shop_trust_router
from app.interfaces.api.payment_routes import router as payment_router
from app.interfaces.api.delivery_routes import router as delivery_router
from app.interfaces.api.premium_market_routes import router as premium_market_router
from app.interfaces.api.topdmbozor_routes import router as topdmbozor_router
from app.interfaces.api.product_review_routes import router as product_review_router
from app.interfaces.api.crm_review_routes import router as crm_review_router
from app.interfaces.api.business_rules_routes import router as business_rules_router
from app.interfaces.api.crm_campaign_routes import router as crm_campaign_router

router.include_router(auth_router)
router.include_router(map_router)
router.include_router(orders_router)
router.include_router(platform_router)
router.include_router(merchant_product_router)
router.include_router(merchant_shop_router)
router.include_router(indoor_map_router)
router.include_router(chat_agent_router)
router.include_router(merchant_pending_router)
router.include_router(merchant_chat_router)
router.include_router(merchant_workspace_router)
router.include_router(media_router)
router.include_router(shop_chat_router)
router.include_router(admin_router)
router.include_router(moderation_router)
router.include_router(merchant_stories_router)
router.include_router(market_stories_router)
router.include_router(home_router)
router.include_router(experience_router)
router.include_router(premium_admin_router)
router.include_router(crm_banner_router)
router.include_router(crm_shop_trust_router)
router.include_router(payment_router)
router.include_router(delivery_router)
router.include_router(premium_market_router)
router.include_router(topdmbozor_router)
router.include_router(product_review_router)
router.include_router(crm_review_router)
router.include_router(business_rules_router)
router.include_router(crm_campaign_router)
