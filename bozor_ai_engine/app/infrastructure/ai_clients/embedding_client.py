import hashlib


class EmbeddingClient:
    async def get_embedding(self, text: str, dim: int = 1536) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        base = [b / 255 for b in digest]
        return (base * ((dim // len(base)) + 1))[:dim]
