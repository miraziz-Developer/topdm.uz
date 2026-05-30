from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.personalization.user_context import get_home_experience
from app.infrastructure.auth.deps import AuthUser, get_optional_user
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/experience", tags=["experience"])


class ClientHintsBody(BaseModel):
    visit_count: int = Field(default=1, ge=1, le=9999)
    last_shop_slug: str | None = Field(default=None, max_length=120)
    last_shop_name: str | None = Field(default=None, max_length=200)
    preferred_market: str | None = Field(default=None, max_length=64)
    locale: str = Field(default="uz", max_length=8)
    liked_products_count: int = Field(default=0, ge=0, le=500)
    favorites_count: int = Field(default=0, ge=0, le=500)
    recent_views_count: int = Field(default=0, ge=0, le=5000)
    sale_mode: str | None = Field(default=None, max_length=16)
    guest_phone: str | None = Field(default=None, max_length=20)


@router.get("/home")
async def experience_home_get(
    visit_count: int = 1,
    last_shop_slug: str | None = None,
    last_shop_name: str | None = None,
    preferred_market: str | None = None,
    locale: str = "uz",
    guest_phone: str | None = None,
    liked_products_count: int = 0,
    favorites_count: int = 0,
    recent_views_count: int = 0,
    sale_mode: str | None = None,
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """If-then personalization for storefront home (per-user signals)."""
    return await get_home_experience(
        db,
        user=user,
        client={
            "visit_count": visit_count,
            "last_shop_slug": last_shop_slug,
            "last_shop_name": last_shop_name,
            "preferred_market": preferred_market,
            "locale": locale,
            "liked_products_count": liked_products_count,
            "favorites_count": favorites_count,
            "recent_views_count": recent_views_count,
            "sale_mode": sale_mode,
            "guest_phone": guest_phone,
        },
    )


@router.post("/home")
async def experience_home_post(
    body: ClientHintsBody,
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    return await get_home_experience(db, user=user, client=body.model_dump(exclude_none=True))
