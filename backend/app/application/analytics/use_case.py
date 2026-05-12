class AnalyticsUseCase:
    async def track_lead(self, payload: dict) -> dict:
        return {"status": "tracked", **payload}
