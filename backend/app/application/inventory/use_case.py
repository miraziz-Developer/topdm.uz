class InventoryUseCase:
    async def onboard_product(self, payload: dict) -> dict:
        return {"status": "queued", "payload": payload}
