import hashlib
import json

from app.application.stylist.schemas import OutfitResponse
from app.application.interfaces.ai_clients import ClaudeGateway, EmbeddingGateway, GeminiGateway
from app.domain.interfaces.cache_gateway import CacheGateway
from app.domain.interfaces.product_repository import ProductRepository
from app.domain.value_objects.search_query import SearchQuery


class StylistUseCase:
    def __init__(
        self,
        product_repo: ProductRepository,
        cache: CacheGateway,
        claude: ClaudeGateway,
        gemini: GeminiGateway,
        embedding: EmbeddingGateway,
    ) -> None:
        self.product_repo = product_repo
        self.cache = cache
        self.claude = claude
        self.gemini = gemini
        self.embedding = embedding

    async def execute(
        self,
        user_id: str,
        query: SearchQuery,
        min_price: float | None = None,
        max_price: float | None = None,
        block: str | None = None,
    ) -> dict:
        if hasattr(self.cache, "check_rate_limit"):
            allowed = await self.cache.check_rate_limit(user_id)
            if not allowed:
                return {"error": "Rate limit exceeded", "retry_after_seconds": 60}

        pre_vector = await self.embedding.embed(query.semantic_key())
        vector_hash = hashlib.sha256(
            json.dumps([round(v, 6) for v in pre_vector[:128]], separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        cache_key = f"stylist:{vector_hash}"
        cached = await self.cache.get(cache_key)
        if cached:
            validated_cached = OutfitResponse.model_validate(cached)
            return {"source": "cache", **validated_cached.model_dump()}

        intent = await self.claude.classify_intent(query.text or "fashion suggestion")
        filters = {}
        if query.image_url:
            filters = await self.gemini.extract_attributes(query.image_url)
        vector = await self.embedding.embed((query.text or "") + " " + filters.get("category", ""))
        products = await self.product_repo.hybrid_search(
            vector,
            filters,
            limit=15,
            min_price=min_price,
            max_price=max_price,
            block=block,
        )
        product_payload = [p.__dict__ for p in products]
        raw = await self.claude.compose_lookbook(intent, product_payload)
        validated = self._validate_outfit(raw, product_payload)
        await self.cache.set(cache_key, validated.model_dump())
        return {"source": "fresh", **validated.model_dump()}

    @staticmethod
    def _validate_outfit(payload: dict, products: list[dict]) -> OutfitResponse:
        validated = OutfitResponse.model_validate(payload)
        allowed_ids = {str(p["id"]) for p in products}
        for item in validated.lookbook:
            if item.product_id not in allowed_ids:
                raise ValueError(f"Unknown product_id from AI response: {item.product_id}")
        return validated
