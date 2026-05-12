from app.infrastructure.ai_clients.claude_client import ClaudeClient
from app.infrastructure.ai_clients.embedding_client import EmbeddingClient
from app.infrastructure.ai_clients.gemini_client import GeminiClient


class InventoryImageProcessor:
    def __init__(
        self,
        gemini_client: GeminiClient,
        claude_client: ClaudeClient,
        embedding_client: EmbeddingClient,
    ) -> None:
        self.gemini_client = gemini_client
        self.claude_client = claude_client
        self.embedding_client = embedding_client

    async def process_merchant_image(self, image_bytes: bytes) -> dict:
        analysis = await self.gemini_client.analyze_clothing(image_bytes)
        analysis_payload = analysis.model_dump()
        description = await self.claude_client.generate_description(analysis_payload)
        vector = await self.embedding_client.get_embedding(f"{analysis_payload['category']} {description}")
        return {"metadata": analysis_payload, "description": description, "vector": vector}
