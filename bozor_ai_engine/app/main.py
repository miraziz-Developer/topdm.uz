from fastapi import FastAPI

from app.core.config import get_settings
from app.interfaces.api.routes import router as api_router

settings = get_settings()
app = FastAPI(title=settings.app_name, debug=settings.app_debug)
app.include_router(api_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
