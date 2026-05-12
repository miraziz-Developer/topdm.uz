import base64

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ai_stylist.stylist_pipeline import StylistPipeline
from app.application.inventory.image_processor import InventoryImageProcessor
from app.domain.models.lead import LeadEvent
from app.domain.models.shop import GlobalShop
from app.infrastructure.ai_clients.claude_client import ClaudeClient
from app.infrastructure.ai_clients.embedding_client import EmbeddingClient
from app.infrastructure.ai_clients.gemini_client import GeminiClient
from app.infrastructure.cache.redis_cache import SemanticCache
from app.infrastructure.database.repositories import LeadRepository, ProductRepository, ShopRepository
from app.infrastructure.database.session import get_db
from app.infrastructure.tasks.inventory_tasks import process_merchant_image_task
from app.interfaces.api.schemas import ImageSearchRequest, LeadTrackRequest, MerchantOnboardingRequest, SearchRequest

router = APIRouter(prefix="/api/v1")


@router.post("/search")
async def semantic_search(payload: SearchRequest, db: AsyncSession = Depends(get_db)) -> dict:
    pipeline = StylistPipeline(
        claude_client=ClaudeClient(),
        embedding_client=EmbeddingClient(),
        semantic_cache=SemanticCache(),
        product_repository=ProductRepository(db),
    )
    return await pipeline.run(payload.query)


@router.post("/recommendations")
async def recommendations(payload: SearchRequest, db: AsyncSession = Depends(get_db)) -> dict:
    pipeline = StylistPipeline(
        claude_client=ClaudeClient(),
        embedding_client=EmbeddingClient(),
        semantic_cache=SemanticCache(),
        product_repository=ProductRepository(db),
    )
    return await pipeline.run(payload.query)


@router.post("/search/image")
async def image_hybrid_search(payload: ImageSearchRequest, db: AsyncSession = Depends(get_db)) -> dict:
    image_bytes = base64.b64decode(payload.image_b64.encode("utf-8"))
    processor = InventoryImageProcessor(
        gemini_client=GeminiClient(),
        claude_client=ClaudeClient(),
        embedding_client=EmbeddingClient(),
    )
    processed = await processor.process_merchant_image(image_bytes)
    products = await ProductRepository(db).hybrid_search(
        query_vector=processed["vector"],
        attributes=processed["metadata"],
        limit=payload.limit,
    )
    return {
        "metadata": processed["metadata"],
        "products": [{"id": p.id, "name": p.name, "price": p.price, "currency": p.currency} for p in products],
    }


@router.post("/merchant/onboarding")
async def merchant_onboarding(payload: MerchantOnboardingRequest, db: AsyncSession = Depends(get_db)) -> dict:
    repo = ShopRepository(db)
    shop = GlobalShop(
        name=payload.name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        block=payload.block,
        row=payload.row,
        phone=payload.phone,
        telegram_username=payload.telegram_username,
        address_note=payload.address_note,
        shop_metadata={},
    )
    created = await repo.create(shop)
    return {"shop_id": created.id, "status": "onboarded"}


@router.post("/leads/track")
async def track_lead(payload: LeadTrackRequest, db: AsyncSession = Depends(get_db)) -> dict:
    lead = LeadEvent(
        user_id=payload.user_id,
        product_id=payload.product_id,
        shop_id=payload.shop_id,
        event_type=payload.event_type,
        event_metadata=payload.metadata,
    )
    created = await LeadRepository(db).track(lead)
    return {"lead_id": created.id, "status": "tracked"}


@router.post("/inventory/process-image")
async def process_image_async(image_bytes: bytes) -> dict:
    task = process_merchant_image_task.delay(image_bytes)
    return {"task_id": task.id, "status": "queued"}
