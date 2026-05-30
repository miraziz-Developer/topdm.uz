import hashlib
import json
from dataclasses import asdict

from app.application.stylist.schemas import IntentSchema, OutfitResponse
from app.application.interfaces.ai_clients import ClaudeGateway, EmbeddingGateway, GeminiGateway
from app.core.config import get_settings
from app.domain.interfaces.cache_gateway import CacheGateway
from app.domain.interfaces.product_repository import ProductRepository
from app.domain.value_objects.search_query import SearchQuery

_EMBED_BY_OCCASION: dict[str, str] = {
    "BEACH": (
        "plyaj yozgi yengil short mayka sandal flip flop krossovka "
        "plyaj sumkasi quyoshdan himoya ko'zoynak suv sport kupalnik"
    ),
    "SPORT": "sport kiyim krossovka fitnes joging mayka shim",
    "OFFICE": "ofis klassik rasmiy ko'ylak kostyum",
    "PARTY": "kechki libos ziyofat",
    "FORMAL": "rasmiy klassik to'y libosi kostyum galstuk",
    "EVERYDAY": "kundalik qulay casual",
}

_BEACH_MARKERS = (
    "soxil",
    "sohil",
    "plyaj",
    "plaj",
    "plyos",
    "dengiz",
    "deniz",
    "suvda",
    " suvi",
    "yuzish",
    "basseyn",
    "bassein",
    "pool",
    "kurort",
    "dam ol",
    "bo'yida",
    "boyida",
)


def _normalize_query_apostrophe(text: str) -> str:
    t = text.lower()
    for ch in ("\u2019", "\u2018", "`"):
        t = t.replace(ch, "'")
    return t


def _force_beach_occasion(text: str | None, intent: dict) -> dict:
    """Override classifier when the user clearly asked for beach/sea context."""
    t = _normalize_query_apostrophe(text or "")
    if not any(m in t for m in _BEACH_MARKERS):
        return intent
    out = {**intent, "occasion": "BEACH"}
    style_u = str(out.get("style") or "").strip().upper()
    if style_u in {"FORMAL", "SMART"}:
        out["style"] = "CASUAL"
    return out


def _embedding_occasion_boost(occasion: str | None) -> str:
    key = str(occasion or "EVERYDAY").strip().upper()
    return _EMBED_BY_OCCASION.get(key, _EMBED_BY_OCCASION["EVERYDAY"])


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
        if hasattr(self.cache, "check_fixed_window"):
            allowed = await self.cache.check_fixed_window(
                f"ai:stylist:{user_id}",
                limit=15,
                window_seconds=60,
            )
            if not allowed:
                return {"error": "Rate limit exceeded", "retry_after_seconds": 60}

        filters: dict = {}
        if query.image_url:
            filters = await self.gemini.extract_attributes(query.image_url)
        if query.text and query.text.strip():
            filters["text"] = query.text.strip()

        text_for_intent = query.text or "fashion suggestion"
        intent = await self.claude.classify_intent(text_for_intent)
        intent = _force_beach_occasion(query.text, intent)

        semantic = query.semantic_key()
        text_part = semantic.split("|", 1)[0] if semantic else ""
        occ_boost = _embedding_occasion_boost(intent.get("occasion"))
        embed_source = f"{text_part} {occ_boost} {filters.get('category', '')}".strip()
        vector = await self.embedding.embed(embed_source)
        vector_hash = hashlib.sha256(
            json.dumps([round(v, 6) for v in vector[:128]], separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        settings = get_settings()
        price_key = f"{min_price}:{max_price}"
        cache_key = f"stylist:v2:{settings.groq_model}:{vector_hash}:{price_key}"
        cached = await self.cache.get(cache_key)
        if cached:
            validated_cached = OutfitResponse.model_validate(cached)
            return {"source": "cache", **validated_cached.model_dump()}

        products = await self.product_repo.hybrid_search(
            vector,
            filters,
            limit=15,
            min_price=min_price,
            max_price=max_price,
            block=block,
        )
        if not products:
            return {
                "source": "fresh",
                **OutfitResponse(
                    intent=IntentSchema(
                        intent="PRODUCT_FINDER",
                        style="general",
                        reason="no_matching_products",
                        occasion=str(intent.get("occasion") or "EVERYDAY"),
                    ),
                    lookbook=[],
                    explanation=(
                        "No matching products were found in the catalog. "
                        "Try a different search or check back later."
                    ),
                ).model_dump(),
            }
        product_payload = [asdict(p) for p in products]
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
