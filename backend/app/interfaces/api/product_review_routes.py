"""Mahsulot sharhlari — yulduz, matn, rasm."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.marketplace.product_review_service import ProductReviewService
from app.infrastructure.auth.deps import get_optional_user
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.db.session import get_db_session

router = APIRouter(tags=["product-reviews"])

_ALLOWED_IMAGE = frozenset({"image/jpeg", "image/png", "image/webp", "image/jpg"})


def _guest_label_from_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) >= 4:
        return f"Xaridor ·••{digits[-4:]}"
    return "Xaridor"


def _resolve_author_name(
    user: AuthUser | None,
    author_name: str | None,
    customer_phone: str | None,
) -> str:
    if author_name and len(author_name.strip()) >= 2:
        return author_name.strip()[:80]
    if user is not None:
        name = (user.display_name or "").strip()
        if len(name) >= 2:
            return name[:80]
        email = (user.email or "").strip()
        if "@" in email:
            local = email.split("@", 1)[0].strip()
            if len(local) >= 2:
                return local[:80]
        if user.telegram_id:
            return "Telegram foydalanuvchi"
        phone = (user.phone or "").strip()
        if phone:
            return _guest_label_from_phone(phone)
        return "Xaridor"
    phone = (customer_phone or "").strip()
    if phone:
        return _guest_label_from_phone(phone)
    raise ValueError("auth_required_for_review")


def _resolve_customer_phone(user: AuthUser | None, customer_phone: str | None) -> str | None:
    if customer_phone and customer_phone.strip():
        return customer_phone.strip()[:20]
    if user and user.phone and user.phone.strip():
        return user.phone.strip()[:20]
    return None


async def _read_images(files: list[UploadFile]) -> list[tuple[bytes, str]]:
    items: list[tuple[bytes, str]] = []
    for file in files:
        if not file.content_type or file.content_type not in _ALLOWED_IMAGE:
            continue
        data = await file.read()
        if data:
            items.append((data, file.content_type))
    return items


@router.get("/products/{product_id}/reviews")
async def list_product_reviews(
    product_id: UUID,
    limit: int = 12,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = ProductReviewService(db)
    return await svc.list_reviews(product_id, limit=limit, offset=offset)


@router.post("/products/{product_id}/reviews")
async def create_product_review(
    product_id: UUID,
    rating: int = Form(..., ge=1, le=5),
    author_name: str | None = Form(default=None, max_length=80),
    body: str | None = Form(default=None, max_length=2000),
    customer_phone: str | None = Form(default=None, max_length=20),
    photos: list[UploadFile] = File(default=[]),
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = ProductReviewService(db)
    try:
        resolved_phone = _resolve_customer_phone(user, customer_phone)
        resolved_name = _resolve_author_name(user, author_name, resolved_phone or customer_phone)
        review = await svc.create_review(
            product_id=product_id,
            rating=rating,
            author_name=resolved_name,
            body=body,
            customer_phone=resolved_phone,
            user_id=user.id if user else None,
            photo_items=await _read_images(photos),
        )
        summary = await svc.get_summary(product_id)
        return {"review": review, "summary": summary}
    except ValueError as exc:
        code = str(exc)
        if code == "product_not_found":
            raise HTTPException(status_code=404, detail="Mahsulot topilmadi") from exc
        if code == "auth_required_for_review":
            raise HTTPException(
                status_code=401,
                detail="Sharh uchun profilga kiring yoki buyurtma telefonini saqlang",
            ) from exc
        raise HTTPException(status_code=400, detail=code) from exc
