from typing import Protocol


class CacheGateway(Protocol):
    async def get(self, key: str) -> dict | None:
        ...

    async def set(self, key: str, value: dict, ttl_seconds: int = 1800) -> None:
        ...
