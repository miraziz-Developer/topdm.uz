from uuid import UUID

from app.domain.repositories.product_repository import ProductRepository
from app.infrastructure.ai.providers import deterministic_embedding
from app.infrastructure.vision.gemini_vision import GeminiVisionService


class MerchantAutoListingUseCase:
    def __init__(self, repository: ProductRepository, vision: GeminiVisionService) -> None:
        self._repository = repository
        self._vision = vision

    async def execute(self, shop_id: UUID, image_url: str, price: float, currency: str = "UZS") -> dict:
        attrs = await self._vision.extract_fashion_attributes(image_url)
        title = f"{attrs['style'].title()} {attrs['category'].title()}"
        description = (
            f"Premium {attrs['material']} {attrs['category']} in {', '.join(attrs['colors'])} palette. "
            "Designed for daily comfort with trend-forward silhouette."
        )
        tags = {
            "seo_keywords": [attrs["category"], attrs["style"], attrs["material"]],
            "color_palette": attrs["colors"],
        }
        product = await self._repository.create_auto_listed_product(
            shop_id=shop_id,
            name=title,
            description=description,
            price=price,
            currency=currency,
            embedding=deterministic_embedding(f"{title} {description}"),
            ai_generated_tags=tags,
            vision_attributes=attrs,
        )
        return {"id": str(product.id), "name": product.name, "description": product.description, "tags": product.ai_generated_tags}
