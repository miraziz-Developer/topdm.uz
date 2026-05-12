from typing import Protocol


class ClaudeGateway(Protocol):
    async def classify_intent(self, user_text: str) -> dict:
        ...

    async def compose_lookbook(self, intent: dict, products: list[dict]) -> dict:
        ...


class GeminiGateway(Protocol):
    async def extract_attributes(self, image: bytes | str | object) -> dict:
        ...


class EmbeddingGateway(Protocol):
    async def embed(self, text: str) -> list[float]:
        ...
