"""Mahsulot sharhlari: moderatsiya, 1–5 yulduz, cloud/local media."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.phone import normalize_uz_phone_e164, phone_digits_key
from app.infrastructure.db.models import OrderModel, ProductModel
from app.infrastructure.storage.object_store import ObjectMediaStore
from app.models.product_review import ProductReviewModel

_MAX_PHOTOS = 4
_MAX_PHOTO_BYTES = 5 * 1024 * 1024
_PUBLIC_STATUSES = frozenset({"approved"})
_PENDING = "pending_moderation"
_APPROVED = "approved"
_REJECTED = "rejected"


class ProductReviewService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._media = ObjectMediaStore()

    async def batch_summaries(self, product_ids: list[UUID]) -> dict[str, dict]:
        if not product_ids:
            return {}
        rows = await self._session.execute(
            select(ProductReviewModel.product_id, ProductReviewModel.rating)
            .where(
                ProductReviewModel.product_id.in_(product_ids),
                ProductReviewModel.status.in_(tuple(_PUBLIC_STATUSES)),
            )
        )
        buckets: dict[UUID, list[int]] = {}
        for product_id, rating in rows.all():
            buckets.setdefault(product_id, []).append(int(rating))
        out: dict[str, dict] = {}
        for pid, ratings in buckets.items():
            total = len(ratings)
            weighted = sum(ratings)
            dist = {str(i): 0 for i in range(1, 6)}
            for r in ratings:
                dist[str(r)] = dist.get(str(r), 0) + 1
            out[str(pid)] = {
                "average_rating": round(weighted / total, 1) if total else 0.0,
                "review_count": total,
                "distribution": dist,
            }
        return out

    async def get_summary(self, product_id: UUID) -> dict:
        rows = await self._session.execute(
            select(ProductReviewModel.rating, func.count())
            .where(
                ProductReviewModel.product_id == product_id,
                ProductReviewModel.status.in_(tuple(_PUBLIC_STATUSES)),
            )
            .group_by(ProductReviewModel.rating)
        )
        dist = {str(i): 0 for i in range(1, 6)}
        total = 0
        weighted = 0
        for rating, count in rows.all():
            r = int(rating)
            c = int(count)
            dist[str(r)] = c
            total += c
            weighted += r * c
        avg = round(weighted / total, 1) if total else 0.0
        return {
            "average_rating": avg,
            "review_count": total,
            "distribution": dist,
        }

    async def list_reviews(self, product_id: UUID, *, limit: int = 20, offset: int = 0) -> dict:
        limit = max(1, min(limit, 50))
        offset = max(0, offset)
        summary = await self.get_summary(product_id)

        result = await self._session.execute(
            select(ProductReviewModel)
            .where(
                ProductReviewModel.product_id == product_id,
                ProductReviewModel.status.in_(tuple(_PUBLIC_STATUSES)),
            )
            .order_by(ProductReviewModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        items = [self._to_dict(row) for row in result.scalars().all()]
        return {**summary, "items": items, "limit": limit, "offset": offset}

    async def list_for_moderation(
        self,
        shop_id: UUID,
        *,
        status: str = _PENDING,
        limit: int = 50,
        offset: int = 0,
        product_id: UUID | None = None,
        rating: int | None = None,
        rating_min: int | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        q: str | None = None,
        verified_only: bool = False,
    ) -> dict:
        limit = max(1, min(limit, 100))
        offset = max(0, offset)
        allowed = {_PENDING, _APPROVED, _REJECTED, "all"}
        if status not in allowed:
            raise ValueError("invalid_status")

        stmt = (
            select(ProductReviewModel, ProductModel.name.label("product_name"))
            .join(ProductModel, ProductModel.id == ProductReviewModel.product_id)
            .where(ProductReviewModel.shop_id == shop_id)
        )
        if status != "all":
            stmt = stmt.where(ProductReviewModel.status == status)
        if product_id is not None:
            stmt = stmt.where(ProductReviewModel.product_id == product_id)
        if rating is not None:
            stmt = stmt.where(ProductReviewModel.rating == rating)
        elif rating_min is not None:
            stmt = stmt.where(ProductReviewModel.rating >= max(1, min(5, rating_min)))
        if date_from is not None:
            stmt = stmt.where(ProductReviewModel.created_at >= date_from)
        if date_to is not None:
            stmt = stmt.where(ProductReviewModel.created_at <= date_to)
        if verified_only:
            stmt = stmt.where(ProductReviewModel.is_verified_purchase.is_(True))
        needle = (q or "").strip()
        if needle:
            pattern = f"%{needle}%"
            stmt = stmt.where(
                or_(
                    ProductReviewModel.author_name.ilike(pattern),
                    ProductReviewModel.body.ilike(pattern),
                    ProductModel.name.ilike(pattern),
                )
            )

        result = await self._session.execute(
            stmt.order_by(ProductReviewModel.created_at.desc()).limit(limit).offset(offset)
        )
        items = [
            self._to_dict(row, include_status=True, product_name=product_name)
            for row, product_name in result.all()
        ]
        counts = await self.crm_status_counts(shop_id)
        return {
            "items": items,
            "status": status,
            "limit": limit,
            "offset": offset,
            "counts": counts,
            "total": counts.get(status if status != "all" else "all", len(items)),
        }

    async def crm_status_counts(self, shop_id: UUID) -> dict[str, int]:
        result = await self._session.execute(
            select(ProductReviewModel.status, func.count())
            .where(ProductReviewModel.shop_id == shop_id)
            .group_by(ProductReviewModel.status)
        )
        by_status = {str(status): int(count) for status, count in result.all()}
        pending = by_status.get(_PENDING, 0)
        approved = by_status.get(_APPROVED, 0)
        rejected = by_status.get(_REJECTED, 0)
        return {
            "all": pending + approved + rejected,
            _PENDING: pending,
            _APPROVED: approved,
            _REJECTED: rejected,
        }

    async def moderate_review(
        self,
        shop_id: UUID,
        review_id: UUID,
        *,
        action: str,
        note: str | None = None,
    ) -> dict:
        review = await self._session.get(ProductReviewModel, review_id)
        if review is None:
            raise ValueError("review_not_found")
        if review.shop_id != shop_id:
            raise ValueError("shop_mismatch")
        if action == "approve":
            review.status = _APPROVED
        elif action == "reject":
            review.status = _REJECTED
        else:
            raise ValueError("invalid_action")
        if note:
            review.body = ((review.body or "") + f"\n[moderation] {note.strip()}").strip()
        await self._session.commit()
        await self._session.refresh(review)
        return {"review": self._to_dict(review, include_status=True)}

    async def create_review(
        self,
        *,
        product_id: UUID,
        rating: int,
        author_name: str,
        body: str | None,
        customer_phone: str | None,
        user_id: UUID | None,
        photo_items: list[tuple[bytes, str]],
    ) -> dict:
        if rating < 1 or rating > 5:
            raise ValueError("rating_must_be_1_to_5")

        product = await self._session.get(ProductModel, product_id)
        if product is None:
            raise ValueError("product_not_found")

        name = (author_name or "Xaridor").strip()[:80]
        if len(name) < 2:
            raise ValueError("author_name_required")

        verified = False
        order_id: UUID | None = None
        if customer_phone:
            normalized = normalize_uz_phone_e164(customer_phone.strip())
            digits = phone_digits_key(normalized or customer_phone)
            phone_match = (
                OrderModel.customer_phone == normalized
                if normalized
                else OrderModel.customer_phone == customer_phone.strip()
            )
            if digits:
                phone_match = or_(
                    phone_match,
                    func.regexp_replace(OrderModel.customer_phone, r"\D", "", "g") == digits,
                )
            order_row = await self._session.execute(
                select(OrderModel)
                .where(
                    OrderModel.product_id == product_id,
                    phone_match,
                    OrderModel.status.in_(("completed", "ready")),
                )
                .order_by(OrderModel.created_at.desc())
                .limit(1)
            )
            order = order_row.scalar_one_or_none()
            if order:
                verified = True
                order_id = order.id
        elif user_id is not None:
            order_row = await self._session.execute(
                select(OrderModel)
                .where(
                    OrderModel.product_id == product_id,
                    OrderModel.customer_user_id == user_id,
                    OrderModel.status.in_(("completed", "ready")),
                )
                .order_by(OrderModel.created_at.desc())
                .limit(1)
            )
            order = order_row.scalar_one_or_none()
            if order:
                verified = True
                order_id = order.id

        photo_urls = await self._save_photos(product.shop_id, product_id, photo_items)

        # Tasdiqlangan xarid yoki faqat matn — darhol ko'rinadi; rasm bilan noma'lum — moderatsiya.
        initial_status = _APPROVED if (verified or not photo_urls) else _PENDING

        review = ProductReviewModel(
            product_id=product_id,
            shop_id=product.shop_id,
            user_id=user_id,
            order_id=order_id,
            customer_phone=customer_phone.strip() if customer_phone else None,
            author_name=name,
            rating=rating,
            body=(body or "").strip() or None,
            photo_urls=photo_urls,
            is_verified_purchase=verified,
            status=initial_status,
        )
        self._session.add(review)
        await self._session.commit()
        await self._session.refresh(review)
        return self._to_dict(review, include_status=True)

    async def _save_photos(
        self,
        shop_id: UUID,
        product_id: UUID,
        items: list[tuple[bytes, str]],
    ) -> list[str]:
        if len(items) > _MAX_PHOTOS:
            raise ValueError("too_many_photos")
        urls: list[str] = []
        for data, content_type in items:
            if len(data) > _MAX_PHOTO_BYTES:
                raise ValueError("photo_too_large")
            ext = "jpg"
            if "png" in content_type:
                ext = "png"
            elif "webp" in content_type:
                ext = "webp"
            url = await self._media.save_review_image(
                shop_id=shop_id,
                product_id=product_id,
                image_bytes=data,
                extension=ext,
                content_type=content_type,
            )
            urls.append(url)
        return urls

    @staticmethod
    def _to_dict(
        row: ProductReviewModel,
        *,
        include_status: bool = False,
        product_name: str | None = None,
    ) -> dict:
        payload = {
            "id": str(row.id),
            "product_id": str(row.product_id),
            "product_name": product_name,
            "author_name": row.author_name,
            "rating": int(row.rating),
            "body": row.body,
            "photo_urls": list(row.photo_urls or []),
            "is_verified_purchase": bool(row.is_verified_purchase),
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        if include_status:
            payload["status"] = row.status
        return payload
