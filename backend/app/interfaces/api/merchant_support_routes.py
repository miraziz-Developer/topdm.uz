from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.support_ai_service import MerchantSupportAiService
from app.application.merchant.support_service import MerchantSupportService
from app.infrastructure.auth.deps import AuthUser, require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/merchant/support", tags=["merchant-support"])


class SupportTicketCreateRequest(BaseModel):
    category: str = Field(..., pattern="^(problem|suggestion|question)$")
    message: str = Field(..., min_length=5, max_length=4000)


class SupportAiHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class SupportAiChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[SupportAiHistoryItem] = Field(default_factory=list, max_length=24)


@router.get("/ai/config")
async def support_ai_config(
    _: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = MerchantSupportAiService(db)
    return await svc.get_config()


@router.post("/ai/chat")
async def support_ai_chat(
    body: SupportAiChatRequest,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    svc = MerchantSupportAiService(db)
    try:
        return await svc.chat(
            shop=shop,
            message=body.message,
            history=[h.model_dump() for h in body.history],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/tickets")
async def list_support_tickets(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    svc = MerchantSupportService(db)
    items = await svc.list_for_shop(shop.id)
    return {"items": items}


@router.post("/tickets")
async def create_support_ticket(
    body: SupportTicketCreateRequest,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    svc = MerchantSupportService(db)
    try:
        item = await svc.create_ticket(
            shop,
            category=body.category,
            message=body.message,
            merchant_phone=user.phone,
            merchant_email=user.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"item": item, "message": "Xabaringiz qabul qilindi — tez orada javob beramiz"}
