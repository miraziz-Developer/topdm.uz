from app.application.schemas import IntentResult


class ClaudeClient:
    async def classify_intent(self, text: str) -> IntentResult:
        payload = {
            "intent": "OUTFIT_BUILDER",
            "style": "FORMAL" if "to'y" in text.lower() else "CASUAL",
            "reason": "User asks for style-guided outfit recommendation.",
        }
        return IntentResult.model_validate(payload)

    async def generate_description(self, analysis: dict) -> str:
        return (
            f"{analysis.get('category', 'kiyim')} uchun professional tavsif: "
            f"{analysis.get('material', 'premium material')} va {analysis.get('color', 'classic rang')}."
        )
