from uuid import UUID

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.agents.stylist_agent import StylistAgent
from app.application.dto.stylist_dto import StylistRequest
from app.application.use_cases.merchant_auto_listing import MerchantAutoListingUseCase
from app.infrastructure.ai.providers import ClaudeStylistLLM
from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.cache.session_store import StylistResponseCache, UserStylistSessionStore
from app.infrastructure.db.repositories.product_repository_impl import ProductRepositoryImpl
from app.infrastructure.db.session import get_db_session
from app.infrastructure.vision.gemini_vision import GeminiVisionService
from app.interfaces.schemas.stylist import MerchantAutoListingRequest, StylistApiRequest

router = APIRouter(prefix="/stylist", tags=["stylist"])


@router.post("/look")
async def create_look(
    payload: StylistApiRequest,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> dict:
    repository = ProductRepositoryImpl(db)
    agent = StylistAgent(
        llm=ClaudeStylistLLM(),
        vision=GeminiVisionService(),
        repository=repository,
        session_store=UserStylistSessionStore(redis),
        response_cache=StylistResponseCache(redis),
    )
    return await agent.run(StylistRequest.model_validate(payload.model_dump()))


@router.post("/merchant/auto-listing")
async def merchant_auto_listing(
    payload: MerchantAutoListingRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    use_case = MerchantAutoListingUseCase(
        repository=ProductRepositoryImpl(db),
        vision=GeminiVisionService(),
    )
    return await use_case.execute(
        shop_id=UUID(payload.shop_id),
        image_url=payload.image_url,
        price=payload.price,
        currency=payload.currency,
    )
