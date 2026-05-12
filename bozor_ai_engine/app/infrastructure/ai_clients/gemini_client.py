from app.application.schemas import VisionAnalysis


class GeminiClient:
    async def analyze_clothing(self, image_bytes: bytes) -> VisionAnalysis:
        _ = image_bytes
        payload = {
            "category": "ko'ylak",
            "material": "atlas",
            "style_type": "formal",
            "colors_hex": ["#1E3A8A", "#DBEAFE"],
        }
        return VisionAnalysis.model_validate(payload)
