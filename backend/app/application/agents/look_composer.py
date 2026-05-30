"""Backward-compatible facade — delegates to app.ai.agents.look_synthesizer."""

from app.ai.agents.look_synthesizer import (
    build_look_user_payload,
    compact_catalog_rows,
    compose_elite_look,
    filter_product_ids,
    groq_compose_look,
    stream_elite_look,
)

__all__ = [
    "build_look_user_payload",
    "compact_catalog_rows",
    "compose_elite_look",
    "filter_product_ids",
    "groq_compose_look",
    "stream_elite_look",
]
