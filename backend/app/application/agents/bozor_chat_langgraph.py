from __future__ import annotations

import base64
import json
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.agents.bozor_chat_catalog import contains_banned_hallucination, scrub_hallucinated_phrases
from app.application.agents.bozor_chat_system import (
    FINALIZE_SYSTEM_PROMPT,
    TOOLS_SYSTEM_PROMPT,
    build_finalize_user_payload,
)
from app.application.agents.bozor_chat_tool_runner import BozorToolRunner
from app.core.config import get_settings
from app.ai.config import require_groq_api_key
from app.infrastructure.ai_clients.gemini import GeminiClient
from app.infrastructure.ai_clients.groq import GroqClient
from app.infrastructure.ai_clients.groq_tools import GroqToolClient
from app.application.ai.llm_errors import build_llm_error_payload
from app.infrastructure.cache.chat_history_store import ChatHistoryStore


class ChatAgentState(TypedDict, total=False):
    user_id: str
    thread_id: str
    user_text: str | None
    image_bytes: bytes | None
    image_mime: str | None
    user_nav_node_id: str
    history: list[dict[str, Any]]
    vision: dict[str, Any] | None
    llm_messages: list[dict[str, Any]]
    tool_phase_messages: list[dict[str, Any]]
    raw_ui: dict[str, Any]
    response: dict[str, Any]
    route_notify_jobs: list[dict[str, Any]]
    catalog_context: dict[str, Any] | None
    wardrobe_prebuilt: dict[str, Any] | None
    recommended_product_ids: list[str]


def _stylist_product_ids(raw: dict[str, Any], runner: BozorToolRunner) -> list[str]:
    """UUIDs the stylist explicitly chose — blocks, top-level field, or look_composition."""
    ids: list[str] = []
    blocks_in = raw.get("blocks")
    if isinstance(blocks_in, list):
        for b in blocks_in:
            if isinstance(b, dict) and b.get("type") == "product_cards":
                for i in b.get("product_ids") or b.get("ids") or []:
                    sid = str(i)
                    if sid in runner.allowed_product_ids and sid not in ids:
                        ids.append(sid)
    for i in raw.get("selected_product_ids") or []:
        sid = str(i)
        if sid in runner.allowed_product_ids and sid not in ids:
            ids.append(sid)
    catalog = runner.last_catalog_context or {}
    look = catalog.get("look_composition")
    if isinstance(look, dict):
        for i in look.get("selected_product_ids") or []:
            sid = str(i)
            if sid in runner.allowed_product_ids and sid not in ids:
                ids.append(sid)
    return ids[:8]


def _catalog_neighbors(runner: BozorToolRunner) -> list[dict[str, Any]]:
    catalog = runner.last_catalog_context or {}
    jonli = catalog.get("jonli_katalog_natijasi") if isinstance(catalog, dict) else {}
    if not isinstance(jonli, dict):
        jonli = {}
    neighbors = list(jonli.get("vector_neighbors") or [])
    if neighbors:
        return neighbors
    return list(runner.product_snapshots.values())


def _strict_card_ids(runner: BozorToolRunner, user_text: str | None) -> list[str]:
    """Deprecated — product cards come from Groq stylist picks only."""
    _ = runner, user_text
    return []


def _sanitize_ui_payload(
    raw: dict[str, Any],
    runner: BozorToolRunner,
    *,
    user_text: str | None = None,
) -> dict[str, Any]:
    assistant_text = str(raw.get("assistant_text") or "").strip()
    blocks_in = raw.get("blocks")
    if not isinstance(blocks_in, list):
        blocks_in = []
    stylist_ids = _stylist_product_ids(raw, runner)
    out_blocks: list[dict[str, Any]] = []
    for b in blocks_in:
        if not isinstance(b, dict):
            continue
        t = b.get("type")
        if t == "product_cards":
            ids = b.get("product_ids") or b.get("ids") or []
            ids = [str(i) for i in ids if str(i) in runner.allowed_product_ids]
            if stylist_ids and not ids:
                ids = stylist_ids
            if not ids:
                continue
            items = [runner.product_snapshots[i] for i in ids if i in runner.product_snapshots]
            out_blocks.append({"type": "product_cards", "product_ids": ids, "items": items})
        elif t == "text" and isinstance(b.get("content"), str) and b["content"].strip():
            out_blocks.append({"type": "text", "content": b["content"].strip()})
        elif t == "wardrobe_bundle":
            slots = b.get("slots") if isinstance(b.get("slots"), list) else []
            slot_items: list[dict[str, Any]] = []
            for slot in slots:
                if not isinstance(slot, dict):
                    continue
                pid = str(slot.get("product_id") or "")
                item = slot.get("item")
                if isinstance(item, dict) and pid in runner.product_snapshots:
                    item = runner.product_snapshots[pid]
                elif pid in runner.product_snapshots:
                    item = runner.product_snapshots[pid]
                else:
                    continue
                slot_items.append(
                    {
                        "role": str(slot.get("role") or "item"),
                        "product_id": pid,
                        "item": item,
                    }
                )
            if slot_items:
                out_blocks.append({"type": "wardrobe_bundle", "slots": slot_items})
        elif t == "mini_map":
            meta = runner.last_route_meta or {}
            route = b.get("route") if isinstance(b.get("route"), dict) else {}
            if runner.last_route and not route.get("node_ids"):
                route = runner.last_route
            if not route.get("node_ids"):
                continue
            out_blocks.append(
                {
                    "type": "mini_map",
                    "market_slug": str(b.get("market_slug") or meta.get("market_slug") or "ippodrom"),
                    "level": int(b.get("level") or meta.get("level") or 1),
                    "start_node_id": str(b.get("start_node_id") or meta.get("start_node_id") or ""),
                    "goal_node_id": str(b.get("goal_node_id") or meta.get("goal_node_id") or ""),
                    "route": route,
                }
            )
    has_cards = any(b.get("type") == "product_cards" for b in out_blocks)
    if not has_cards:
        wardrobe_ids: list[str] = []
        for b in out_blocks:
            if b.get("type") != "wardrobe_bundle":
                continue
            for slot in b.get("slots") or []:
                if isinstance(slot, dict) and slot.get("product_id"):
                    pid = str(slot["product_id"])
                    if pid in runner.allowed_product_ids:
                        wardrobe_ids.append(pid)
        if wardrobe_ids:
            items = [runner.product_snapshots[i] for i in wardrobe_ids if i in runner.product_snapshots]
            out_blocks.insert(
                0,
                {"type": "product_cards", "product_ids": wardrobe_ids, "items": items},
            )
            has_cards = True
    if not has_cards and stylist_ids:
        items = [runner.product_snapshots[i] for i in stylist_ids if i in runner.product_snapshots]
        out_blocks.insert(0, {"type": "product_cards", "product_ids": stylist_ids, "items": items})
    elif not has_cards and runner.allowed_product_ids:
        ids = _strict_card_ids(runner, user_text)
        if not ids:
            ids = list(runner.allowed_product_ids)[:8]
        items = [runner.product_snapshots[i] for i in ids if i in runner.product_snapshots]
        out_blocks.append({"type": "product_cards", "product_ids": ids, "items": items})

    if contains_banned_hallucination(assistant_text):
        assistant_text = scrub_hallucinated_phrases(assistant_text)

    payload: dict[str, Any] = {"assistant_text": assistant_text, "blocks": out_blocks}
    if raw.get("search_deeplink"):
        payload["search_deeplink"] = raw["search_deeplink"]
    if raw.get("has_more") is not None:
        payload["has_more"] = raw.get("has_more")
    return payload


class BozorChatAgentGraph:
    """LangGraph pipeline: vision → bootstrap search → tool-calling LLM → JSON UI + Redis history."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._settings = get_settings()
        self._history = ChatHistoryStore()
        self._gemini = GeminiClient()
        require_groq_api_key(self._settings)
        self._tool_client = GroqToolClient()
        self._groq = GroqClient()
        self._runner = BozorToolRunner(session)
        self._graph = self._compile()

    def _compile(self):
        graph = StateGraph(ChatAgentState)
        graph.add_node("vision", self._vision_node)
        graph.add_node("bootstrap", self._bootstrap_node)
        graph.add_node("build_messages", self._build_messages_node)
        graph.add_node("agent_tools", self._agent_tools_node)
        graph.add_node("collect_route_jobs", self._collect_route_jobs_node)
        graph.add_node("finalize", self._finalize_node)
        graph.add_node("persist", self._persist_node)
        graph.add_edge(START, "vision")
        graph.add_edge("vision", "bootstrap")
        graph.add_conditional_edges(
            "bootstrap",
            self._route_after_bootstrap,
            {"finalize": "finalize", "build_messages": "build_messages"},
        )
        graph.add_edge("build_messages", "agent_tools")
        graph.add_edge("agent_tools", "collect_route_jobs")
        graph.add_edge("collect_route_jobs", "finalize")
        graph.add_edge("finalize", "persist")
        graph.add_edge("persist", END)
        return graph.compile()

    async def _vision_node(self, state: ChatAgentState) -> dict[str, Any]:
        if not state.get("image_bytes"):
            return {}
        try:
            vision = await self._gemini.extract_attributes(state["image_bytes"])
            return {"vision": vision}
        except Exception:
            return {"vision": None}

    def _route_after_bootstrap(self, state: ChatAgentState) -> str:
        if state.get("wardrobe_prebuilt"):
            return "finalize"
        return "build_messages"

    async def _bootstrap_node(self, state: ChatAgentState) -> dict[str, Any]:
        vision = state.get("vision")
        if isinstance(vision, dict) and vision:
            await self._runner.bootstrap_from_vision(vision)
        text = (state.get("user_text") or "").strip()
        catalog_context: dict[str, Any] = {}
        wardrobe_prebuilt: dict[str, Any] | None = None
        if text:
            from app.ai.wardrobe_search import build_wardrobe_bundle

            self._runner.recommended_product_ids = set(state.get("recommended_product_ids") or [])
            bundle = await build_wardrobe_bundle(
                self._session,
                self._runner,
                user_text=text,
                user_id=str(state.get("user_id") or "anon"),
                thread_id=str(state.get("thread_id") or "default"),
            )
            if bundle:
                catalog_context = bundle.get("catalog_context") or {}
                wardrobe_prebuilt = bundle.get("prebuilt_ui")
            else:
                self._runner.recommended_product_ids = set(state.get("recommended_product_ids") or [])
                catalog_context = await self._runner.query_clothing_catalog_from_text(text)
        return {
            "catalog_context": catalog_context or None,
            "wardrobe_prebuilt": wardrobe_prebuilt,
        }

    async def _build_messages_node(self, state: ChatAgentState) -> dict[str, Any]:
        ut = (state.get("user_text") or "").strip()
        vision = state.get("vision")
        img = state.get("image_bytes")
        mime = (state.get("image_mime") or "image/jpeg").strip() or "image/jpeg"
        hist_raw = state.get("history") or []
        hist: list[dict[str, Any]] = []
        for m in hist_raw:
            if not isinstance(m, dict):
                continue
            role = m.get("role")
            content = m.get("content")
            if role in ("user", "assistant") and isinstance(content, str):
                hist.append({"role": role, "content": content})
        if isinstance(vision, dict) and vision:
            body = ut or "Foydalanuvchi rasmga o'xshash mahsulotni qidirishni xohlaydi."
            content = f"{body}\n\n[rasm_bo'yicha_atributlar]\n{json.dumps(vision, ensure_ascii=True)}"
            msg: dict[str, Any] = {"role": "user", "content": content}
        elif img:
            b64 = base64.b64encode(img).decode("ascii")
            parts: list[dict[str, Any]] = [
                {"type": "text", "text": ut or "Bu rasmdagi kiyimlarga o'xshash mahsulot toping."},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            ]
            msg = {"role": "user", "content": parts}
        else:
            msg = {"role": "user", "content": ut or "Salom"}
        catalog = state.get("catalog_context")
        prefix: list[dict[str, Any]] = []
        if isinstance(catalog, dict):
            jonli = catalog.get("jonli_katalog_natijasi")
            has_neighbors = isinstance(jonli, dict) and bool(jonli.get("vector_neighbors"))
            if catalog.get("count", 0) > 0 or has_neighbors:
                prefix.append(
                    {
                        "role": "user",
                        "content": (
                            "[jonli_katalog_natijalari — faqat shu vector qatorlardan look yarating]\n"
                            + json.dumps(
                                {
                                    "count": catalog.get("count"),
                                    "items": catalog.get("items"),
                                    "[jonli_katalog_natijalari]": jonli,
                                    "is_fallback": catalog.get("is_fallback"),
                                },
                                ensure_ascii=True,
                            )
                        ),
                    }
                )
        return {"llm_messages": [*hist, *prefix, msg]}

    async def _agent_tools_node(self, state: ChatAgentState) -> dict[str, Any]:
        base = list(state.get("llm_messages") or [])

        async def on_tool(name: str, args: dict[str, Any]) -> str:
            return await self._runner.handle_tool(name, args)

        try:
            out = await self._tool_client.run_tool_loop(
                system_prompt=TOOLS_SYSTEM_PROMPT,
                messages=base,
                on_tool_call=on_tool,
            )
            return {"tool_phase_messages": out}
        except Exception:
            user_text = (state.get("user_text") or "").strip()
            if user_text:
                await self._runner.query_clothing_catalog_from_text(user_text)
                await self._runner.bootstrap_from_text(user_text)
            return {"tool_phase_messages": []}

    async def _collect_route_jobs_node(self, state: ChatAgentState) -> dict[str, Any]:
        jobs: list[dict[str, Any]] = []
        for ev in self._runner.tool_events:
            if ev.get("name") != "calculate_route":
                continue
            res = ev.get("result") or {}
            if res.get("error") or not res.get("route"):
                continue
            jobs.append(
                {
                    "market_slug": res.get("market_slug"),
                    "level": res.get("level"),
                    "start_node_id": res.get("start_node_id"),
                    "goal_node_id": res.get("goal_node_id"),
                    "route": res.get("route"),
                }
            )
        return {"route_notify_jobs": jobs}

    async def _finalize_node(self, state: ChatAgentState) -> dict[str, Any]:
        prebuilt = state.get("wardrobe_prebuilt")
        if isinstance(prebuilt, dict) and prebuilt.get("assistant_text"):
            safe = _sanitize_ui_payload(prebuilt, self._runner, user_text=state.get("user_text"))
            if prebuilt.get("search_deeplink"):
                safe["search_deeplink"] = prebuilt["search_deeplink"]
            if prebuilt.get("has_more") is not None:
                safe["has_more"] = prebuilt["has_more"]
            if self._settings.app_debug:
                safe["tool_trace"] = []
            return {"raw_ui": prebuilt, "response": safe}

        user_prompt = build_finalize_user_payload(
            user_text=state.get("user_text"),
            vision=state.get("vision"),
            tool_events=self._runner.tool_events,
            allowed_product_ids=sorted(self._runner.allowed_product_ids),
            user_nav_node_id=str(state.get("user_nav_node_id") or "entrance-A"),
            catalog_context=state.get("catalog_context") or self._runner.last_catalog_context,
        )
        try:
            raw_ui = await self._groq.chat_json(
                system_prompt=FINALIZE_SYSTEM_PROMPT,
                user_prompt=user_prompt,
            )
        except Exception:
            from app.ai.agents.look_synthesizer import compose_elite_look

            catalog = state.get("catalog_context") or self._runner.last_catalog_context or {}
            jonli = catalog.get("jonli_katalog_natijasi") if isinstance(catalog, dict) else {}
            if not jonli and isinstance(catalog, dict):
                jonli = catalog.get("[jonli_katalog_natijalari]") or {}
            neighbors = list((jonli or {}).get("vector_neighbors") or catalog.get("items") or [])
            composed = await compose_elite_look(
                user_intent=str(state.get("user_text") or ""),
                catalog_items=neighbors,
                jonli_katalog=jonli if isinstance(jonli, dict) else None,
                vision=state.get("vision") if isinstance(state.get("vision"), dict) else None,
            )
            ids = list(composed.get("selected_product_ids") or [])[:8]
            if not ids:
                ids = list(self._runner.allowed_product_ids)[:8]
            raw_ui = {
                "assistant_text": composed.get("assistant_text") or "",
                "selected_product_ids": ids,
                "blocks": [{"type": "product_cards", "product_ids": ids}],
            }
        if not isinstance(raw_ui, dict):
            raise ValueError("Groq finalize returned invalid payload")
        safe = _sanitize_ui_payload(raw_ui, self._runner, user_text=state.get("user_text"))
        if self._settings.app_debug:
            safe["tool_trace"] = list(self._runner.tool_events)
        return {"raw_ui": raw_ui, "response": safe}

    async def _persist_node(self, state: ChatAgentState) -> dict[str, Any]:
        resp = state.get("response") or {}
        assistant_message = str(resp.get("assistant_text") or "")
        user_hist = (state.get("user_text") or "").strip()
        if state.get("image_bytes") and not user_hist:
            user_hist = "[rasm yuklandi]"
        uid = str(state.get("user_id") or "anon")
        tid = str(state.get("thread_id") or "default")
        await self._history.append_turn(
            uid,
            tid,
            user_message=user_hist or "[xabar]",
            assistant_message=assistant_message,
        )
        ids: list[str] = []
        for block in resp.get("blocks") or []:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "product_cards":
                ids.extend(str(i) for i in block.get("product_ids") or [])
            if block.get("type") == "wardrobe_bundle":
                for slot in block.get("slots") or []:
                    if isinstance(slot, dict) and slot.get("product_id"):
                        ids.append(str(slot["product_id"]))
        if ids:
            from app.ai.agents.wardrobe_memory import merge_recommended_ids

            await merge_recommended_ids(
                uid,
                tid,
                ids,
                bump_page_on_pagination=False,
                user_text=user_hist,
            )
        return {}

    async def _local_fallback(
        self,
        *,
        user_id: str,
        thread_id: str,
        user_text: str | None,
        user_nav_node_id: str,
    ) -> dict[str, Any]:
        from app.ai.agents.look_synthesizer import compose_elite_look

        query = (user_text or "").strip()
        if query:
            await self._runner.query_clothing_catalog_from_text(query)
        catalog = self._runner.last_catalog_context or {}
        jonli = catalog.get("jonli_katalog_natijasi") if isinstance(catalog, dict) else {}
        neighbors = list((jonli or {}).get("vector_neighbors") or catalog.get("items") or [])
        try:
            composed = await compose_elite_look(
                user_intent=query or "Salom",
                catalog_items=neighbors,
                jonli_katalog=jonli if isinstance(jonli, dict) else None,
            )
            ids = list(composed.get("selected_product_ids") or [])[:8]
            raw_ui = {
                "assistant_text": composed.get("assistant_text") or "",
                "selected_product_ids": ids,
                "blocks": [{"type": "product_cards", "product_ids": ids}],
            }
            safe = _sanitize_ui_payload(raw_ui, self._runner, user_text=user_text)
            safe["ai_status"] = "groq_recovery"
        except Exception as exc:
            err = build_llm_error_payload(exc=exc)
            prod = get_settings().is_production
            recovery_ids = [] if prod else _strict_card_ids(self._runner, user_text)
            if not prod and not recovery_ids:
                recovery_ids = list(self._runner.allowed_product_ids)[:8]
            blocks: list[dict[str, Any]] = []
            if recovery_ids:
                blocks.append({"type": "product_cards", "product_ids": recovery_ids})
            safe = _sanitize_ui_payload(
                {
                    "assistant_text": err["detail"],
                    "blocks": blocks,
                },
                self._runner,
                user_text=user_text,
            )
            safe["suggestions"] = err["suggestions"]
            safe["ai_status"] = err["code"]
        await self._history.append_turn(
            user_id,
            thread_id,
            user_message=query or "[xabar]",
            assistant_message=str(safe.get("assistant_text") or ""),
        )
        return {"response": safe, "route_notify_jobs": [], "fallback": True}

    async def run(
        self,
        *,
        user_id: str,
        thread_id: str,
        user_text: str | None,
        image_bytes: bytes | None,
        image_mime: str | None,
        user_nav_node_id: str | None,
    ) -> dict[str, Any]:
        nav = user_nav_node_id or "entrance-A"
        hist = await self._history.load(user_id, thread_id)
        from app.ai.agents.wardrobe_memory import load_recommended_ids

        recommended = await load_recommended_ids(user_id, thread_id)
        self._runner.recommended_product_ids = set(recommended)
        initial: ChatAgentState = {
            "user_id": user_id,
            "thread_id": thread_id,
            "user_text": user_text,
            "image_bytes": image_bytes,
            "image_mime": image_mime,
            "user_nav_node_id": nav,
            "history": hist,
            "recommended_product_ids": recommended,
        }
        try:
            result = await self._graph.ainvoke(initial)
        except Exception:
            return await self._local_fallback(
                user_id=user_id,
                thread_id=thread_id,
                user_text=user_text,
                user_nav_node_id=nav,
            )
        response = result.get("response") or {"assistant_text": "", "blocks": []}
        jobs = result.get("route_notify_jobs") or []
        return {"response": response, "route_notify_jobs": jobs}
