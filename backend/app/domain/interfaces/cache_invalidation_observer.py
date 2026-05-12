from typing import Protocol


class CacheInvalidationObserver(Protocol):
    async def on_product_updated(self, product_id: str) -> None:
        ...

    async def on_product_deleted(self, product_id: str) -> None:
        ...
