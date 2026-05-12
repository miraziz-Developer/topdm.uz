from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from pydantic import AliasChoices, BaseModel, Field
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
from app.infrastructure.messaging.telegram_notifier import TelegramNotifier
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.product_repo import ProductRepo

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
    ref_token: str | None = Field(default=None, validation_alias=AliasChoices("ref_token", "refToken"))


class TrackEventRequest(BaseModel):
    event_type: str
    product_id: UUID | None = None
    shop_id: UUID | None = None
    ref_token: str | None = None
    session_id: str | None = None
    metadata: dict = Field(default_factory=dict)

class OTPSendRequest(BaseModel):
    phone: str

class OTPVerifyRequest(BaseModel):
    phone: str
    otp: str

def product_to_dict(p):
    s = p.shop if hasattr(p, 'shop') else None
    return {
        "id": str(p.id),
        "name": p.name,
        "price": p.price,
        "images": p.images,
        "category": str(p.category_id) if p.category_id else None,
        "is_available": p.is_available,
        "view_count": p.view_count,
        "shop": {
            "id": str(s.id) if s else "",
            "name": s.name if s else "",
            "ipadrom": str(s.ipadrom_id) if s and s.ipadrom_id else "Noma'lum",
            "floor": s.floor if s else "",
        } if s else {}
    }


@router.post("/stylist/lookbook")
async def stylist_lookbook(payload: StylistRequest, db: AsyncSession = Depends(get_db_session)) -> dict:
    use_case = StylistUseCase(
        product_repo=ProductRepo(db),
        cache=RedisCacheGateway(),
        claude=ClaudeClient(),
        gemini=GeminiClient(),
        embedding=EmbeddingClient(),
    )
    return await use_case.execute(
        user_id=payload.user_id,
        query=SearchQuery(text=payload.text, image_url=payload.image_url),
        min_price=payload.min_price,
        max_price=payload.max_price,
        block=payload.block,
    )


@router.post("/products")
async def create_product(payload: ProductCreateRequest, db: AsyncSession = Depends(get_db_session)) -> dict:
    use_case = MarketplaceUseCases(
        repo=MarketplaceRepository(db),
        notifier=TelegramNotifier(get_settings().telegram_bot_token),
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
    use_case = MarketplaceUseCases(repo=repo, notifier=TelegramNotifier(get_settings().telegram_bot_token))
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
            ref_token=payload.ref_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/tracking/events")
async def create_tracking_event(payload: TrackEventRequest, db: AsyncSession = Depends(get_db_session)) -> dict:
    use_case = MarketplaceUseCases(
        repo=MarketplaceRepository(db),
        notifier=TelegramNotifier(get_settings().telegram_bot_token),
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
        notifier=TelegramNotifier(get_settings().telegram_bot_token),
    )
    return await use_case.get_shop_dashboard(shop_id)

@router.get("/products/search")
async def search_products(q: str | None = None, page: int = 1, limit: int = 12, db: AsyncSession = Depends(get_db_session)) -> dict:
    repo = MarketplaceRepository(db)
    offset = (page - 1) * limit
    products = await repo.search_products(q, limit, offset)
    total = await repo.count_products(q)
    return {
        "items": [product_to_dict(p) for p in products],
        "total": total,
        "page": page
    }

@router.get("/products/{id}")
async def get_product(id: UUID, db: AsyncSession = Depends(get_db_session)) -> dict:
    repo = MarketplaceRepository(db)
    await repo.increment_product_view_count(id)
    p = await repo.get_product_by_id(id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_dict(p)

@router.get("/products/{id}/similar")
async def get_similar(id: UUID, db: AsyncSession = Depends(get_db_session)) -> dict:
    repo = MarketplaceRepository(db)
    products = await repo.get_similar_products(id)
    return {"items": [product_to_dict(p) for p in products]}

@router.post("/auth/otp/send")
async def otp_send(payload: OTPSendRequest):
    import random
    from app.infrastructure.messaging.eskiz_sms import EskizSMSClient
    otp = str(random.randint(1000, 9999))
    cache = RedisCacheGateway()
    await cache.set(f"otp:{payload.phone}", {"otp": otp}, 300)
    client = EskizSMSClient()
    success = await client.send_sms(payload.phone, f"Bozor AI tasdiqlash kodi: {otp}")
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send SMS")
    return {"status": "ok"}

@router.post("/auth/otp/verify")
async def otp_verify(payload: OTPVerifyRequest):
    cache = RedisCacheGateway()
    data = await cache.get(f"otp:{payload.phone}")
    if not data or data.get("otp") != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    await cache.delete(f"otp:{payload.phone}")
    from app.infrastructure.auth.jwt import create_access_token

    token = create_access_token(subject=payload.phone)
    return {"status": "ok", "token": token}

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
