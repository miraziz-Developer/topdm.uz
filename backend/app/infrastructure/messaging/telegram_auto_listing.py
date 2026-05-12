from uuid import UUID

from app.application.use_cases.merchant_auto_listing import MerchantAutoListingUseCase


class TelegramAutoListingHandler:
    def __init__(self, use_case: MerchantAutoListingUseCase) -> None:
        self._use_case = use_case

    async def handle_product_image(
        self,
        shop_id: str,
        image_url: str,
        price: float,
        currency: str = "UZS",
    ) -> dict:
        return await self._use_case.execute(
            shop_id=UUID(shop_id),
            image_url=image_url,
            price=price,
            currency=currency,
        )
