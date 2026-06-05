"""Reels feed: poster fallback, buzuk videolarni pastga."""
from __future__ import annotations

from typing import Any

from app.application.media.media_availability import media_file_exists
from app.models.reels import ReelsVideoModel


def _unreliable_media_url(url: str | None) -> bool:
    raw = (url or "").strip().lower()
    if not raw:
        return True
    if "images.unsplash.com" in raw or "picsum.photos" in raw:
        return True
    if "/placeholder.svg" in raw or raw.endswith("placeholder.svg"):
        return True
    if "bozorliii-product-placeholder" in raw:
        return True
    if "/placeholder" in raw and "/api/v1/media/" not in raw:
        return True
    return False


def resolve_reel_thumbnail(video: ReelsVideoModel, base: dict[str, Any]) -> str | None:
    shop = video.shop
    logo = (shop.logo_url or "").strip() if shop else ""
    thumb = (video.thumbnail_url or "").strip() or None

    if thumb and thumb != logo and not _unreliable_media_url(thumb):
        if thumb.startswith("http") or media_file_exists(thumb):
            return thumb

    if logo and not _unreliable_media_url(logo):
        if logo.startswith("http") or media_file_exists(logo):
            return logo

    return None


def enrich_reel_dict(video: ReelsVideoModel, base: dict[str, Any]) -> dict[str, Any]:
    thumb = resolve_reel_thumbnail(video, base)
    video_url = (video.video_url or "").strip()
    playable = media_file_exists(video_url)
    out = {**base, "thumbnail_url": thumb, "playable": playable}
    if not playable and video_url.startswith("/api/"):
        out["media_status"] = "missing_file"
    return out


def sort_feed_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def rank(row: dict[str, Any]) -> tuple[int, int, float]:
        has_poster = 1 if row.get("thumbnail_url") else 0
        playable = 1 if row.get("playable") else 0
        score = float(row.get("algorithm_score") or 0)
        return (has_poster, playable, score)

    return sorted(items, key=rank, reverse=True)
