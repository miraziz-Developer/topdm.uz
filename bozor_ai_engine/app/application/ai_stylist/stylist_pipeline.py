from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.application.schemas import StylistLookResponse
from app.domain.services.stylist_logic import StylistDomainService
from app.infrastructure.ai_clients.claude_client import ClaudeClient
from app.infrastructure.ai_clients.embedding_client import EmbeddingClient
from app.infrastructure.cache.redis_cache import SemanticCache
from app.infrastructure.database.repositories import ProductRepository


class StylistState(TypedDict, total=False):
    query: str
    signature: str
    cached: dict | None
    intent: dict
    vector: list[float]
    products: list[dict]
    reasoning: str
    result: dict


class StylistPipeline:
    def __init__(
        self,
        claude_client: ClaudeClient,
        embedding_client: EmbeddingClient,
        semantic_cache: SemanticCache,
        product_repository: ProductRepository,
    ) -> None:
        self.claude = claude_client
        self.embedder = embedding_client
        self.cache = semantic_cache
        self.products = product_repository
        self.domain_stylist = StylistDomainService()
        self.graph = self._build_graph()

    async def run(self, user_query: str) -> dict:
        signature = self._semantic_signature(user_query)
        state = await self.graph.ainvoke({"query": user_query, "signature": signature})
        return state["result"]

    def _build_graph(self):
        graph = StateGraph(StylistState)
        graph.add_node("cache_lookup", self._cache_lookup)
        graph.add_node("intent_recognition", self._intent_recognition)
        graph.add_node("semantic_retrieval", self._semantic_retrieval)
        graph.add_node("stylist_reasoning", self._stylist_reasoning)
        graph.add_node("cache_store", self._cache_store)
        graph.add_edge(START, "cache_lookup")
        graph.add_conditional_edges("cache_lookup", self._route_after_cache, {"cached": END, "new": "intent_recognition"})
        graph.add_edge("intent_recognition", "semantic_retrieval")
        graph.add_edge("semantic_retrieval", "stylist_reasoning")
        graph.add_edge("stylist_reasoning", "cache_store")
        graph.add_edge("cache_store", END)
        return graph.compile()

    @staticmethod
    def _semantic_signature(query: str) -> str:
        q = query.lower().strip()
        synonym_map = {"dark dress": "qora ko'ylak", "black dress": "qora ko'ylak", "dark pants": "qora shim"}
        return synonym_map.get(q, q)

    async def _cache_lookup(self, state: StylistState) -> StylistState:
        cached = await self.cache.get("stylist", state["signature"])
        if cached:
            return {"cached": cached, "result": {"source": "semantic_cache", **cached}}
        return {"cached": None}

    @staticmethod
    def _route_after_cache(state: StylistState) -> str:
        return "cached" if state.get("cached") else "new"

    async def _intent_recognition(self, state: StylistState) -> StylistState:
        intent = await self.claude.classify_intent(state["query"])
        vector = await self.embedder.get_embedding(state["query"])
        return {"intent": intent.model_dump(), "vector": vector}

    async def _semantic_retrieval(self, state: StylistState) -> StylistState:
        candidates = await self.products.vector_search(state["vector"], limit=15)
        products = [{"id": p.id, "name": p.name, "price": p.price, "currency": p.currency} for p in candidates]
        return {"products": products}

    async def _stylist_reasoning(self, state: StylistState) -> StylistState:
        look = self.domain_stylist.build_look(state["products"], state["intent"]["style"])
        result = {
            "intent": state["intent"],
            "reasoning": "Items are matched by style coherence, material harmony, and color contrast balance.",
            "products": look,
        }
        validated = StylistLookResponse.model_validate(result)
        return {"reasoning": validated.reasoning, "result": {"source": "fresh_generation", **validated.model_dump()}}

    async def _cache_store(self, state: StylistState) -> StylistState:
        payload = {
            "intent": state["result"]["intent"],
            "reasoning": state["result"]["reasoning"],
            "products": state["result"]["products"],
        }
        await self.cache.set("stylist", state["signature"], payload)
        return {}
