"""Download catalog product photos for visual fingerprint indexing."""

from __future__ import annotations

import httpx


async def fetch_image_bytes(url: str, *, timeout: float = 12.0) -> bytes | None:
    if not url or not url.startswith(("http://", "https://")):
        return None
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": "BozorAI/1.0 visual-index"},
        ) as client:
            response = await client.get(url)
            if response.status_code == 200 and response.content:
                return response.content
    except Exception:
        return None
    return None
