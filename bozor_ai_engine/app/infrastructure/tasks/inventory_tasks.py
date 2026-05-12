from app.application.inventory.image_processor import InventoryImageProcessor
from app.infrastructure.ai_clients.claude_client import ClaudeClient
from app.infrastructure.ai_clients.embedding_client import EmbeddingClient
from app.infrastructure.ai_clients.gemini_client import GeminiClient
from app.infrastructure.tasks.celery_app import celery_app


@celery_app.task(name="inventory.process_merchant_image")
def process_merchant_image_task(image_bytes: bytes) -> dict:
    # Celery worker synchronous wrapper around async pipeline.
    import asyncio

    async def _run() -> dict:
        processor = InventoryImageProcessor(
            gemini_client=GeminiClient(),
            claude_client=ClaudeClient(),
            embedding_client=EmbeddingClient(),
        )
        return await processor.process_merchant_image(image_bytes=image_bytes)

    return asyncio.run(_run())
