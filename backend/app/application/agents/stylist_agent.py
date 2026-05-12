import hashlib
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from app.application.dto.stylist_dto import StylistRequest
from app.domain.repositories.product_repository import ProductRepository
from app.infrastructure.ai.providers import ClaudeStylistLLM, deterministic_embedding
from app.infrastructure.cache.session_store import StylistResponseCache, UserStylistSessionStore
from app.infrastructure.vision.gemini_vision import GeminiVisionService


class StylistState(TypedDict, total=False):
    request: StylistRequest
    cache_key: str
    cached: dict | None
    image_attributes: dict | None
    intent: str
    embedding: list[float]
    products: list[dict[str, Any]]
    look: dict


class StylistAgent:
    def __init__(
        self,
        llm: ClaudeStylistLLM,
        vision: GeminiVisionService,
        repository: ProductRepository,
        session_store: UserStylistSessionStore,
        response_cache: StylistResponseCache,
    ) -> None:
        self._llm = llm
        self._vision = vision
        self._repository = repository
        self._session_store = session_store
        self._response_cache = response_cache
        self._graph = self._build_graph()

    async def run(self, request: StylistRequest) -> dict:
        seed = f"{request.user_id}:{request.query}:{request.image_url}:{request.currency}"
        cache_key = hashlib.md5(seed.encode("utf-8")).hexdigest()
        result = await self._graph.ainvoke({"request": request, "cache_key": cache_key})
        return result["look"]

    def _build_graph(self):
        graph = StateGraph(StylistState)
        graph.add_node("read_cache", self._read_cache)
        graph.add_node("extract_vision", self._extract_vision)
        graph.add_node("detect_intent", self._detect_intent)
        graph.add_node("retrieve_products", self._retrieve_products)
        graph.add_node("build_look", self._build_look)
        graph.add_node("store_cache", self._store_cache)
        graph.add_node("store_session", self._store_session)

        graph.add_edge(START, "read_cache")
        graph.add_conditional_edges("read_cache", self._route_after_cache, {"cache_hit": END, "cache_miss": "extract_vision"})
        graph.add_edge("extract_vision", "detect_intent")
        graph.add_edge("detect_intent", "retrieve_products")
        graph.add_edge("retrieve_products", "build_look")
        graph.add_edge("build_look", "store_cache")
        graph.add_edge("store_cache", "store_session")
        graph.add_edge("store_session", END)
        return graph.compile()

    async def _read_cache(self, state: StylistState) -> StylistState:
        cached = await self._response_cache.get(state["cache_key"])
        return {"cached": cached, "look": cached} if cached else {"cached": None}

    @staticmethod
    def _route_after_cache(state: StylistState) -> str:
        return "cache_hit" if state.get("cached") else "cache_miss"

    async def _extract_vision(self, state: StylistState) -> StylistState:
        request = state["request"]
        if not request.image_url:
            return {"image_attributes": None}
        return {"image_attributes": await self._vision.extract_fashion_attributes(request.image_url)}

    async def _detect_intent(self, state: StylistState) -> StylistState:
        request = state["request"]
        query_text = request.query or "fashion recommendation"
        intent = await self._llm.detect_intent(query_text, state.get("image_attributes"))
        embedding = deterministic_embedding(query_text)
        return {"intent": intent, "embedding": embedding}

    async def _retrieve_products(self, state: StylistState) -> StylistState:
        if state.get("image_attributes"):
            products = await self._repository.multimodal_search(state["embedding"], state["image_attributes"], limit=20)
        else:
            products = await self._repository.vector_search(state["embedding"], limit=20)

        normalized = [
            {
                "id": str(p.id),
                "name": p.name,
                "price": float(p.price),
                "currency": p.currency,
                "tags": p.ai_generated_tags,
            }
            for p in products
        ]
        return {"products": normalized}

    async def _build_look(self, state: StylistState) -> StylistState:
        look = await self._llm.generate_look(state["intent"], state["products"])
        return {"look": look}

    async def _store_cache(self, state: StylistState) -> StylistState:
        await self._response_cache.set(state["cache_key"], state["look"])
        return {}

    async def _store_session(self, state: StylistState) -> StylistState:
        request = state["request"]
        await self._session_store.set(
            request.user_id,
            {
                "last_query": request.query,
                "last_image_url": request.image_url,
                "last_intent": state.get("intent"),
            },
        )
        return {}
