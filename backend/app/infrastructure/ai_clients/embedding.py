import hashlib


class EmbeddingClient:
    async def embed(self, text: str) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        base = [b / 255.0 for b in digest]
        return (base * 64)[:1536]
