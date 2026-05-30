"""Parallel wardrobe vector synthesis — tops + bottoms budget bands."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.agents.look_synthesizer import compose_elite_look
from app.ai.intent_analyzer import analyze_stylist_intent
from app.ai.wardrobe_session import WardrobeSessionStore
from app.application.agents.bozor_chat_catalog import build_jonli_katalog_natijasi
from app.application.agents.bozor_chat_tool_runner import BozorToolRunner
from app.infrastructure.ai_clients.embedding import EmbeddingClient
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.product_repo import ProductRepo
from app.interfaces.api.serializers import product_to_dict


def build_search_deeplink(intent: dict[str, Any]) -> dict[str, str]:
    max_p = intent.get("max_price")
    vibes = intent.get("vibe_tags") or []
    style = "classic"
    lowered = " ".join(vibes).lower()
    if "streetwear" in lowered:
        style = "streetwear"
    elif "quiet luxury" in lowered:
        style = "quiet-luxury"
    cats: list[str] = []
    if any("polo" in v.lower() for v in vibes):
        cats.append("polo")
    if any("shim" in v.lower() for v in vibes):
        cats.append("shim")
    if not cats:
        cats = ["polo", "shim"]
    q: dict[str, str] = {
        "style": style,
        "category": ",".join(cats),
    }
    if max_p:
        q["max_price"] = str(int(max_p))
    if intent.get("occasion"):
        q["q"] = str(intent["occasion"])
    return q


def _deeplink_path(query: dict[str, str]) -> str:
    params = "&".join(f"{k}={query[k]}" for k in sorted(query.keys()) if query.get(k))
    return f"/search?{params}" if params else "/search"


async def _search_slot(
    *,
    session: AsyncSession,
    embedder: EmbeddingClient,
    product_repo: ProductRepo,
    marketplace_repo: MarketplaceRepository,
    search_text: str,
    max_price: float | None,
    exclude_ids: set[str],
    vibe_tags: list[str],
    page_offset: int,
    limit: int = 8,
) -> list[dict[str, Any]]:
    vector = await embedder.embed(search_text)
    filters: dict[str, Any] = {
        "text": search_text,
        "exclude_ids": list(exclude_ids),
        "style_tags": vibe_tags,
    }
    dist = min(0.92, 0.78 + page_offset * 0.06)
    matches = await product_repo.hybrid_search(
        vector,
        filters,
        limit=limit,
        max_price=max_price,
    )
    items: list[dict[str, Any]] = []
    for m in matches:
        pid = str(m.id)
        if pid in exclude_ids:
            continue
        full = await marketplace_repo.get_product_by_id(UUID(pid))
        if full:
            d = product_to_dict(full)
            d["wardrobe_slot"] = "ustki" if "ustki" in search_text or "polo" in search_text.lower() else "pastki"
            items.append(d)
    if len(items) >= 2:
        return items[:limit]
    neighbors = await product_repo.vector_similarity_fallback(
        vector,
        limit=limit + 4,
        max_cosine_distance=dist,
        style_tags=vibe_tags,
        exclude_ids=list(exclude_ids),
    )
    for m in neighbors:
        pid = str(m.id)
        if pid in exclude_ids:
            continue
        full = await marketplace_repo.get_product_by_id(UUID(pid))
        if full:
            d = product_to_dict(full)
            d["is_fallback"] = True
            d["wardrobe_slot"] = "ustki" if "polo" in search_text.lower() else "pastki"
            items.append(d)
    return items[:limit]


async def build_wardrobe_bundle(
    session: AsyncSession,
    runner: BozorToolRunner,
    *,
    user_text: str,
    user_id: str,
    thread_id: str,
) -> dict[str, Any] | None:
    intent = analyze_stylist_intent(user_text)
    if not intent.get("is_wardrobe_request"):
        return None

    from app.ai.agents.wardrobe_memory import get_recommended_ids, merge_recommended_ids

    store = WardrobeSessionStore()
    wsession = await store.load(user_id, thread_id)
    if intent.get("is_pagination"):
        wsession = await store.bump_page(user_id, thread_id)
    exclude = set(get_recommended_ids(wsession))
    page_offset = int(wsession.get("page_offset") or 0)

    max_p = intent.get("max_price")
    if max_p is None and wsession.get("last_max_price_uzs"):
        max_p = wsession["last_max_price_uzs"]
    vibes = intent.get("vibe_tags") or wsession.get("last_vibe_tags") or ["Klassik", "Polo"]
    top_max = float(max_p) * 0.4 if max_p else None
    bottom_max = float(max_p) * 0.5 if max_p else None

    embedder = EmbeddingClient()
    product_repo = ProductRepo(session)
    marketplace_repo = MarketplaceRepository(session)

    top_q = f"{' '.join(vibes)} premium polo shirt klassik uchrashuv"
    bottom_q = f"{' '.join(vibes)} klassik chino shim straight fit"

    tops = await _search_slot(
        session=session,
        embedder=embedder,
        product_repo=product_repo,
        marketplace_repo=marketplace_repo,
        search_text=top_q,
        max_price=top_max,
        exclude_ids=exclude,
        vibe_tags=vibes,
        page_offset=page_offset,
    )
    bottoms = await _search_slot(
        session=session,
        embedder=embedder,
        product_repo=product_repo,
        marketplace_repo=marketplace_repo,
        search_text=bottom_q,
        max_price=bottom_max,
        exclude_ids=exclude,
        vibe_tags=vibes,
        page_offset=page_offset,
    )

    merged = tops + bottoms
    if not merged and exclude and not intent.get("is_pagination"):
        tops = await _search_slot(
            session=session,
            embedder=embedder,
            product_repo=product_repo,
            marketplace_repo=marketplace_repo,
            search_text=top_q,
            max_price=top_max,
            exclude_ids=set(),
            vibe_tags=vibes,
            page_offset=0,
        )
        bottoms = await _search_slot(
            session=session,
            embedder=embedder,
            product_repo=product_repo,
            marketplace_repo=marketplace_repo,
            search_text=bottom_q,
            max_price=bottom_max,
            exclude_ids=set(),
            vibe_tags=vibes,
            page_offset=0,
        )
        merged = tops + bottoms
    if not merged:
        return None

    for row in merged:
        runner._register_catalog_items([row])

    exact = [p for p in merged if not p.get("is_fallback")]
    jonli = build_jonli_katalog_natijasi(exact_items=exact, vector_neighbors=merged)
    look_intent = {
        **intent,
        "wardrobe_mode": True,
        "page_offset": page_offset,
        "tops_count": len(tops),
        "bottoms_count": len(bottoms),
    }
    composed = await compose_elite_look(
        user_intent=user_text,
        catalog_items=merged,
        jonli_katalog=jonli,
        look_intent=look_intent,
    )

    deeplink_q = build_search_deeplink(intent)
    deeplink_path = _deeplink_path(deeplink_q)
    more_hint = len(merged) >= 4
    assistant = str(composed.get("assistant_text") or "").strip()
    if more_hint and "Ko'proq variantlarni" not in assistant:
        assistant += (
            f"\n\n[Ko'proq variantlarni qidiruv sahifasida ko'rish →]({deeplink_path})"
        )

    selected = list(composed.get("selected_product_ids") or [])[:8]
    slots = []
    for role, pool in (("ustki", tops), ("pastki", bottoms)):
        pick = next((p for p in pool if str(p.get("id")) in selected), pool[0] if pool else None)
        if pick:
            slots.append({"role": role, "product_id": str(pick["id"]), "item": pick})

    await merge_recommended_ids(
        user_id,
        thread_id,
        selected,
        bump_page_on_pagination=bool(intent.get("is_pagination")),
        user_text=user_text,
    )
    await store.save(
        user_id,
        thread_id,
        {
            **(await store.load(user_id, thread_id)),
            "page_offset": page_offset,
            "last_vibe_tags": vibes,
            "last_max_price_uzs": max_p,
            "search_deeplink": {"path": deeplink_path, "query": deeplink_q},
        },
    )

    return {
        "catalog_context": {
            "count": len(merged),
            "items": merged,
            "jonli_katalog_natijasi": jonli,
            "[jonli_katalog_natijalari]": jonli,
            "look_intent": look_intent,
            "wardrobe_slots": slots,
        },
        "prebuilt_ui": {
            "assistant_text": assistant,
            "selected_product_ids": selected,
            "blocks": [
                {"type": "wardrobe_bundle", "slots": slots, "product_ids": selected},
                {"type": "product_cards", "product_ids": selected},
            ],
            "search_deeplink": {"path": deeplink_path, "query": deeplink_q},
            "has_more": more_hint,
        },
    }
