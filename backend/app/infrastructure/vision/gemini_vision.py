from app.infrastructure.ai.providers import deterministic_embedding


class GeminiVisionService:
    async def extract_fashion_attributes(self, image_url: str) -> dict:
        text_seed = f"vision:{image_url}"
        return {
            "category": "outerwear",
            "material": "cotton blend",
            "style": "smart-casual",
            "colors": ["#1f2937", "#f3f4f6"],
            "embedding": deterministic_embedding(text_seed),
        }
