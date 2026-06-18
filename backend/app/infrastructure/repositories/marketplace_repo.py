from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import Date, String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.phone import normalize_uz_phone_e164, phone_digits_key
from app.infrastructure.db.models import (
    CategoryModel,
    LeadModel,
    MerchantCredentialModel,
    MerchantPendingProductModel,
    OrderModel,
    ProductModel,
    RouteStatModel,
    ShopModel,
    TrackingEventModel,
)

logger = logging.getLogger(__name__)

ORDER_SCOPE_ACTIVE = frozenset({"pending", "reserved", "confirmed", "preparing", "ready"})
ORDER_SCOPE_COMPLETED = frozenset({"completed"})
ORDER_SCOPE_CANCELLED = frozenset({"cancelled"})


@dataclass(slots=True)
class ShopDashboardStats:
    total_products: int
    total_leads: int
    total_views: int
    total_visits: int


class MarketplaceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    @staticmethod
    def _public_shop_exists():
        """Mijoz katalogi: faqat faol, tasdiqlangan va qarzi bloklanmagan do'konlar."""
        from sqlalchemy import exists

        return exists().where(
            ShopModel.id == ProductModel.shop_id,
            ShopModel.is_active == True,
            ShopModel.is_verified == True,
            ShopModel.is_blocked == False,
        )

    @staticmethod
    def _product_text_search_clause(query: str):
        raw = (query or "").strip()
        tag = raw.lstrip("#").casefold()
        clauses = [
            ProductModel.name.ilike(f"%{raw}%"),
            ProductModel.description.ilike(f"%{raw}%"),
        ]
        if tag:
            clauses.append(cast(ProductModel.attributes["hashtags"], String).ilike(f"%{tag}%"))
        return or_(*clauses)

    async def create_product(
        self,
        *,
        shop_id: UUID,
        category_id: UUID | None,
        name: str,
        description: str | None,
        price: int,
        images: list[str],
        attributes: dict,
        embedding: list[float],
        visual_embedding: list[float] | None = None,
        floor: str | None = None,
        section: str | None = None,
        stock_count: int | None = None,
        sale_type: str = "Chakana",
        min_order_quantity: int = 1,
        pricing_unit: str = "piece",
        units_per_pack: int | None = None,
    ) -> ProductModel:
        _ = floor, section
        model = ProductModel(
            shop_id=shop_id,
            category_id=category_id,
            name=name,
            description=description,
            price=price,
            images=images,
            attributes=attributes,
            embedding=embedding,
            visual_embedding=visual_embedding,
            stock_count=stock_count if stock_count is not None else 5,
            sale_type=sale_type,
            min_order_quantity=max(1, int(min_order_quantity)),
            pricing_unit=pricing_unit,
            units_per_pack=units_per_pack,
        )
        self._db.add(model)
        await self._db.commit()
        await self._db.refresh(model)
        logger.info("product_created", extra={"product_id": str(model.id), "shop_id": str(shop_id)})
        return model

    async def get_shop(self, shop_id: UUID) -> ShopModel | None:
        result = await self._db.execute(select(ShopModel).where(ShopModel.id == shop_id))
        return result.scalar_one_or_none()

    async def get_shop_by_slug(self, slug: str) -> ShopModel | None:
        result = await self._db.execute(
            select(ShopModel).where(ShopModel.slug == slug, ShopModel.is_active == True)
        )
        return result.scalar_one_or_none()

    async def get_shop_by_owner_phone(self, owner_phone: str) -> ShopModel | None:
        result = await self._db.execute(select(ShopModel).where(ShopModel.owner_phone == owner_phone))
        return result.scalar_one_or_none()

    async def create_shop(
        self,
        *,
        name: str,
        slug: str,
        owner_phone: str,
        shop_type: str = "chakana",
        market_zone: str | None = None,
        block_sector: str | None = None,
        stall_number: str | None = None,
        floor: str | None = None,
        section: str | None = None,
        location_comment: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        location_accuracy: float | None = None,
        logo_url: str | None = None,
        storefront_image_url: str | None = None,
        owner_display_name: str | None = None,
        registration_source: str = "telegram",
        telegram_chat_id: int | None = None,
        is_verified: bool = False,
    ) -> ShopModel:
        from app.application.merchant.wholesale_pack import normalize_shop_type

        shop = ShopModel(
            name=name,
            slug=slug,
            owner_phone=owner_phone,
            shop_type=normalize_shop_type(shop_type),
            market_zone=market_zone,
            block_sector=block_sector,
            stall_number=stall_number,
            floor=floor,
            section=section,
            location_comment=location_comment,
            latitude=latitude,
            longitude=longitude,
            location_accuracy=location_accuracy,
            logo_url=logo_url or storefront_image_url,
            storefront_image_url=storefront_image_url,
            owner_display_name=owner_display_name,
            registration_source=registration_source,
            telegram_chat_id=telegram_chat_id,
            is_verified=is_verified,
            is_active=True,
        )
        self._db.add(shop)
        await self._db.commit()
        await self._db.refresh(shop)
        logger.info("shop_created", extra={"shop_id": str(shop.id), "slug": slug})
        return shop

    async def get_merchant_credential_by_login_code(self, login_code: str) -> MerchantCredentialModel | None:
        code = login_code.strip().upper()
        result = await self._db.execute(
            select(MerchantCredentialModel).where(MerchantCredentialModel.login_code == code)
        )
        return result.scalar_one_or_none()

    async def get_merchant_credential_by_shop_id(self, shop_id: UUID) -> MerchantCredentialModel | None:
        result = await self._db.execute(
            select(MerchantCredentialModel).where(MerchantCredentialModel.shop_id == shop_id)
        )
        return result.scalar_one_or_none()

    async def list_root_categories(self, *, limit: int = 40) -> list[CategoryModel]:
        stmt = (
            select(CategoryModel)
            .where(CategoryModel.parent_id.is_(None))
            .order_by(CategoryModel.sort_order.asc(), CategoryModel.name.asc())
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def list_child_categories(self, parent_id: UUID, *, limit: int = 40) -> list[CategoryModel]:
        stmt = (
            select(CategoryModel)
            .where(CategoryModel.parent_id == parent_id)
            .order_by(CategoryModel.sort_order.asc(), CategoryModel.name.asc())
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def category_has_children(self, category_id: UUID) -> bool:
        stmt = select(CategoryModel.id).where(CategoryModel.parent_id == category_id).limit(1)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def get_category_by_slug_or_name(self, hint: str) -> CategoryModel | None:
        raw = (hint or "").strip().lower()
        if not raw:
            return None
        result = await self._db.execute(select(CategoryModel))
        for cat in result.scalars().all():
            if raw in {cat.name.lower(), (cat.name_ru or "").lower(), slugify(cat.name)}:
                return cat
        return None

    async def get_category_by_parent_and_child_name(
        self,
        parent_name: str,
        child_name: str,
    ) -> CategoryModel | None:
        parent_norm = (parent_name or "").strip()
        child_norm = (child_name or "").strip()
        if not parent_norm or not child_norm:
            return None
        roots = await self.list_root_categories(limit=100)
        parent = next((row for row in roots if row.name == parent_norm), None)
        if parent is None:
            return None
        children = await self.list_child_categories(parent.id, limit=100)
        return next((row for row in children if row.name == child_norm), None)

    async def find_subcategory_by_hint(self, hint: str, *, audience: str = "erkak") -> CategoryModel | None:
        raw = (hint or "").strip().casefold()
        if not raw:
            return None
        result = await self._db.execute(select(CategoryModel).where(CategoryModel.parent_id.is_not(None)))
        subs = list(result.scalars().all())
        if not subs:
            return None

        roots = {row.id: row.name.casefold() for row in await self.list_root_categories(limit=100)}
        audience_roots = {
            "erkak": ("erkaklar kiyimi", "erkaklar poyabzali"),
            "ayol": ("ayollar kiyimi", "ayollar poyabzali"),
            "bolalar": ("bolalar kiyimi", "bolalar poyabzali"),
        }
        preferred_tokens = audience_roots.get(audience, audience_roots["erkak"])

        def score(cat: CategoryModel) -> int:
            name = cat.name.casefold()
            parent_name = roots.get(cat.parent_id, "") if cat.parent_id else ""
            points = 0
            if raw in name or name in raw:
                points += 10
            if raw == slugify(cat.name):
                points += 8
            if any(token in parent_name for token in preferred_tokens):
                points += 5
            return points

        ranked = sorted(subs, key=score, reverse=True)
        best = ranked[0]
        return best if score(best) > 0 else None

    async def list_shop_products(
        self,
        shop_id: UUID,
        limit: int = 50,
        offset: int = 0,
        *,
        include_unavailable: bool = False,
    ) -> Sequence[ProductModel]:
        from sqlalchemy.orm import selectinload

        stmt = (
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(ProductModel.shop_id == shop_id)
            .order_by(ProductModel.is_featured.desc(), ProductModel.id.desc())
            .limit(limit)
            .offset(offset)
        )
        if not include_unavailable:
            stmt = stmt.where(ProductModel.is_available == True)
        result = await self._db.execute(stmt)
        return result.scalars().all()

    async def get_shop_product(self, shop_id: UUID, product_id: UUID) -> ProductModel | None:
        from sqlalchemy.orm import selectinload

        result = await self._db.execute(
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(ProductModel.id == product_id, ProductModel.shop_id == shop_id)
        )
        return result.scalar_one_or_none()

    async def list_featured_products(self, limit: int = 12) -> Sequence[ProductModel]:
        from sqlalchemy import exists
        from sqlalchemy.orm import selectinload

        result = await self._db.execute(
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(
                ProductModel.is_available == True,
                ProductModel.is_featured == True,
                self._public_shop_exists(),
            )
            .order_by(ProductModel.view_count.desc(), ProductModel.id.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def list_lightning_deal_products(self, limit: int = 16) -> Sequence[ProductModel]:
        """Faol lightning_deals jadvalidan; bo'sh bo'lsa trending."""
        from app.infrastructure.repositories.campaign_repo import CampaignRepository

        campaign = CampaignRepository(self._db)
        rows = list(await campaign.list_active_lightning_products(limit=limit))
        if len(rows) >= 4:
            return rows
        seen = {p.id for p in rows}
        for p in await self.list_trending_products(limit=limit):
            if p.id not in seen:
                rows.append(p)
                seen.add(p.id)
            if len(rows) >= limit:
                break
        return rows[:limit]

    async def list_trending_products(self, limit: int = 16) -> Sequence[ProductModel]:
        """Trend skor: ko'rishlar + featured + yangilik."""
        from sqlalchemy.orm import selectinload

        result = await self._db.execute(
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(ProductModel.is_available == True, self._public_shop_exists())
            .order_by(
                ProductModel.is_featured.desc(),
                ProductModel.view_count.desc(),
                ProductModel.lead_count.desc(),
                ProductModel.id.desc(),
            )
            .limit(limit)
        )
        return result.scalars().all()

    async def list_products_in_categories(
        self,
        category_ids: list,
        *,
        limit: int = 16,
        exclude_ids: set | None = None,
    ) -> Sequence[ProductModel]:
        """Foydalanuvchi qiziqish kategoriyalaridan tavsiya."""
        from sqlalchemy.orm import selectinload

        if not category_ids:
            return []
        exclude_ids = exclude_ids or set()
        result = await self._db.execute(
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(
                ProductModel.is_available == True,
                self._public_shop_exists(),
                ProductModel.category_id.in_(category_ids),
            )
            .order_by(
                ProductModel.is_featured.desc(),
                ProductModel.view_count.desc(),
                ProductModel.id.desc(),
            )
            .limit(limit * 3)
        )
        rows = [p for p in result.scalars().all() if p.id not in exclude_ids]
        return rows[:limit]

    async def list_user_preferred_category_ids(self, user_id) -> list:
        """Buyurtmalar bo'yicha eng ko'p xarid qilingan kategoriyalar."""
        from uuid import UUID

        if not isinstance(user_id, UUID):
            return []
        result = await self._db.execute(
            select(ProductModel.category_id, func.count().label("cnt"))
            .join(OrderModel, OrderModel.product_id == ProductModel.id)
            .where(
                OrderModel.customer_user_id == user_id,
                ProductModel.category_id.isnot(None),
                OrderModel.status.in_(ORDER_SCOPE_COMPLETED),
            )
            .group_by(ProductModel.category_id)
            .order_by(func.count().desc())
            .limit(5)
        )
        return [row[0] for row in result.all() if row[0]]

    async def list_clearance_deal_products(self, limit: int = 16) -> Sequence[ProductModel]:
        """Faol flash_sales; yetmasa kam zaxira / arzon fallback."""
        from sqlalchemy import and_
        from sqlalchemy.orm import selectinload

        from app.infrastructure.repositories.campaign_repo import CampaignRepository

        campaign = CampaignRepository(self._db)
        flash_rows = list(await campaign.list_active_flash_sale_products(limit=limit))
        if len(flash_rows) >= 4:
            return flash_rows

        result = await self._db.execute(
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(
                ProductModel.is_available == True,
                self._public_shop_exists(),
                and_(ProductModel.stock_count >= 1, ProductModel.stock_count <= 10),
            )
            .order_by(ProductModel.stock_count.asc(), ProductModel.view_count.desc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        if len(rows) >= 4:
            return rows
        fallback = await self._db.execute(
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(ProductModel.is_available == True, self._public_shop_exists())
            .order_by(ProductModel.price.asc(), ProductModel.view_count.desc())
            .limit(limit)
        )
        return fallback.scalars().all()

    async def set_product_featured(self, *, shop_id: UUID, product_id: UUID, featured: bool) -> ProductModel | None:
        from sqlalchemy import update

        result = await self._db.execute(
            update(ProductModel)
            .where(ProductModel.id == product_id, ProductModel.shop_id == shop_id)
            .values(is_featured=featured)
            .returning(ProductModel)
        )
        model = result.scalar_one_or_none()
        if model is None:
            await self._db.rollback()
            return None
        await self._db.commit()
        await self._db.refresh(model)
        return model

    async def update_lead_status(self, *, shop_id: UUID, lead_id: UUID, status: str, note: str | None) -> LeadModel | None:
        from sqlalchemy import update

        result = await self._db.execute(
            update(LeadModel)
            .where(LeadModel.id == lead_id, LeadModel.shop_id == shop_id)
            .values(status=status, note=note)
            .returning(LeadModel)
        )
        lead = result.scalar_one_or_none()
        if lead is None:
            await self._db.rollback()
            return None
        await self._db.commit()
        await self._db.refresh(lead)
        return lead

    async def create_order(
        self,
        *,
        customer_phone: str,
        product_id: UUID,
        shop_id: UUID,
        quantity: int,
        total_price: int,
        note: str | None,
        ref_token: str | None,
        pickup_date=None,
        pickup_time: str | None = None,
        fulfillment_type: str = "delivery",
        customer_email: str | None = None,
        customer_user_id: UUID | None = None,
        status: str = "pending",
    ) -> OrderModel:
        order = OrderModel(
            customer_phone=customer_phone,
            customer_user_id=customer_user_id,
            product_id=product_id,
            shop_id=shop_id,
            quantity=quantity,
            total_price=total_price,
            note=note,
            ref_token=ref_token,
            pickup_date=pickup_date,
            pickup_time=pickup_time,
            fulfillment_type=fulfillment_type,
            customer_email=customer_email,
            status=status,
        )
        self._db.add(order)
        await self._db.commit()
        await self._db.refresh(order)
        return order

    async def list_customer_orders(self, customer_phone: str, limit: int = 50) -> Sequence[OrderModel]:
        """Legacy phone-only lookup — prefer list_orders_for_account."""
        normalized = normalize_uz_phone_e164(customer_phone) or customer_phone.strip()
        return await self.list_orders_for_account(
            user_id=None,
            phone=normalized,
            email=None,
            scope="all",
            limit=limit,
        )

    async def list_orders_for_account(
        self,
        *,
        user_id: UUID | None,
        phone: str | None,
        email: str | None,
        scope: str = "all",
        limit: int = 50,
    ) -> Sequence[OrderModel]:
        from sqlalchemy.orm import selectinload

        conditions = []
        if user_id is not None:
            conditions.append(OrderModel.customer_user_id == user_id)

        normalized_phone = normalize_uz_phone_e164(phone)
        if normalized_phone:
            digits = phone_digits_key(normalized_phone)
            phone_match = or_(
                OrderModel.customer_phone == normalized_phone,
                func.regexp_replace(OrderModel.customer_phone, r"\D", "", "g") == digits,
            )
            conditions.append(phone_match)

        clean_email = (email or "").strip().lower()
        if clean_email:
            conditions.append(func.lower(OrderModel.customer_email) == clean_email)

        if not conditions:
            return []

        query = (
            select(OrderModel)
            .options(selectinload(OrderModel.product), selectinload(OrderModel.shop))
            .where(or_(*conditions))
        )

        scope_key = (scope or "all").strip().lower()
        if scope_key == "active":
            query = query.where(OrderModel.status.in_(ORDER_SCOPE_ACTIVE))
        elif scope_key == "completed":
            query = query.where(OrderModel.status.in_(ORDER_SCOPE_COMPLETED))
        elif scope_key == "cancelled":
            query = query.where(OrderModel.status.in_(ORDER_SCOPE_CANCELLED))

        query = query.order_by(OrderModel.created_at.desc()).limit(limit)
        result = await self._db.execute(query)
        rows = list(result.scalars().all())
        if len(rows) <= 1:
            return rows

        seen: set[UUID] = set()
        unique: list[OrderModel] = []
        for row in rows:
            if row.id in seen:
                continue
            seen.add(row.id)
            unique.append(row)
        return unique

    async def link_orders_to_user(
        self,
        *,
        user_id: UUID,
        phone: str | None,
        email: str | None = None,
    ) -> int:
        """Backfill customer_user_id for legacy phone/email rows."""
        from sqlalchemy import update

        normalized_phone = normalize_uz_phone_e164(phone)
        conditions = [OrderModel.customer_user_id.is_(None)]
        match_parts = []
        if normalized_phone:
            digits = phone_digits_key(normalized_phone)
            match_parts.append(OrderModel.customer_phone == normalized_phone)
            match_parts.append(
                func.regexp_replace(OrderModel.customer_phone, r"\D", "", "g") == digits
            )
        clean_email = (email or "").strip().lower()
        if clean_email:
            match_parts.append(func.lower(OrderModel.customer_email) == clean_email)
        if not match_parts:
            return 0

        values: dict[str, object] = {"customer_user_id": user_id}
        if normalized_phone:
            values["customer_phone"] = normalized_phone

        result = await self._db.execute(
            update(OrderModel)
            .where(*conditions, or_(*match_parts))
            .values(**values)
        )
        return int(result.rowcount or 0)

    async def get_order_for_account(
        self,
        order_id: UUID,
        *,
        user_id: UUID | None,
        phone: str | None,
        email: str | None,
    ) -> OrderModel | None:
        orders = await self.list_orders_for_account(
            user_id=user_id,
            phone=phone,
            email=email,
            scope="all",
            limit=200,
        )
        for order in orders:
            if order.id == order_id:
                return order
        return None

    async def get_order_by_id(self, order_id: UUID) -> OrderModel | None:
        return await self._db.get(OrderModel, order_id)

    async def get_order_for_customer(self, order_id: UUID, customer_phone: str) -> OrderModel | None:
        return await self.get_order_for_account(
            order_id,
            user_id=None,
            phone=customer_phone,
            email=None,
        )

    async def list_shop_orders(self, shop_id: UUID, limit: int = 50) -> Sequence[OrderModel]:
        from sqlalchemy.orm import selectinload

        result = await self._db.execute(
            select(OrderModel)
            .options(selectinload(OrderModel.product))
            .where(OrderModel.shop_id == shop_id)
            .order_by(OrderModel.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def update_order_status(self, *, shop_id: UUID, order_id: UUID, status: str) -> OrderModel | None:
        from sqlalchemy import update

        result = await self._db.execute(
            update(OrderModel)
            .where(OrderModel.id == order_id, OrderModel.shop_id == shop_id)
            .values(status=status)
            .returning(OrderModel)
        )
        order = result.scalar_one_or_none()
        if order is None:
            await self._db.rollback()
            return None
        await self._db.commit()
        await self._db.refresh(order)
        return order

    async def create_lead(
        self,
        *,
        product_id: UUID,
        shop_id: UUID,
        customer_phone: str,
        customer_name: str | None,
        note: str | None,
        ref_token: str | None,
    ) -> LeadModel:
        lead = LeadModel(
            product_id=product_id,
            shop_id=shop_id,
            customer_phone=customer_phone,
            customer_name=customer_name,
            note=note,
            ref_token=ref_token,
        )
        self._db.add(lead)
        await self._db.execute(
            ProductModel.__table__.update()
            .where(ProductModel.id == product_id)
            .values(lead_count=ProductModel.lead_count + 1)
        )
        await self._db.commit()
        await self._db.refresh(lead)
        logger.info("lead_created", extra={"lead_id": str(lead.id), "shop_id": str(shop_id)})
        return lead

    async def create_tracking_event(
        self,
        *,
        event_type: str,
        product_id: UUID | None,
        shop_id: UUID | None,
        ref_token: str | None,
        session_id: str | None,
        metadata: dict,
    ) -> TrackingEventModel:
        event = TrackingEventModel(
            event_type=event_type,
            product_id=product_id,
            shop_id=shop_id,
            ref_token=ref_token,
            session_id=session_id,
            tracking_metadata=metadata,
        )
        self._db.add(event)
        await self._db.commit()
        await self._db.refresh(event)
        return event

    async def get_shop_dashboard_stats(self, shop_id: UUID) -> ShopDashboardStats:
        product_count = await self._db.scalar(
            select(func.count(ProductModel.id)).where(ProductModel.shop_id == shop_id)
        )
        lead_count = await self._db.scalar(select(func.count(LeadModel.id)).where(LeadModel.shop_id == shop_id))
        view_count = await self._db.scalar(
            select(func.coalesce(func.sum(ProductModel.view_count), 0)).where(ProductModel.shop_id == shop_id)
        )
        visit_count = await self._db.scalar(
            select(func.coalesce(func.sum(ProductModel.visit_count), 0)).where(ProductModel.shop_id == shop_id)
        )
        return ShopDashboardStats(
            total_products=int(product_count or 0),
            total_leads=int(lead_count or 0),
            total_views=int(view_count or 0),
            total_visits=int(visit_count or 0),
        )

    async def count_shop_orders_since(self, shop_id: UUID, *, since: datetime) -> int:
        count = await self._db.scalar(
            select(func.count(OrderModel.id)).where(
                OrderModel.shop_id == shop_id,
                OrderModel.created_at >= since,
            )
        )
        return int(count or 0)

    @staticmethod
    def _analytics_granularity(days: int) -> str:
        if days <= 31:
            return "day"
        if days <= 120:
            return "week"
        return "month"

    @staticmethod
    def _period_label_uz(days: int) -> str:
        if days == 7:
            return "7 kun"
        if days == 14:
            return "14 kun"
        if days == 30:
            return "1 oy"
        if days == 90:
            return "3 oy"
        if days == 180:
            return "6 oy"
        if days == 365:
            return "1 yil"
        return f"{days} kun"

    @staticmethod
    def _bucket_keys_for_range(*, days: int, granularity: str, end: date) -> list[str]:
        since = end - timedelta(days=days)
        keys: list[str] = []
        if granularity == "day":
            cursor = end - timedelta(days=days - 1)
            while cursor <= end:
                keys.append(cursor.isoformat())
                cursor += timedelta(days=1)
            return keys
        if granularity == "week":
            cursor = since - timedelta(days=since.weekday())
            while cursor <= end:
                keys.append(cursor.isoformat())
                cursor += timedelta(days=7)
            return keys
        y, m = since.year, since.month
        cursor = date(y, m, 1)
        while cursor <= end:
            keys.append(cursor.isoformat())
            if m == 12:
                y, m = y + 1, 1
            else:
                m += 1
            cursor = date(y, m, 1)
        return keys

    @staticmethod
    def _bucket_chart_label(key: str, granularity: str) -> str:
        start = date.fromisoformat(key)
        if granularity == "week":
            end = min(start + timedelta(days=6), date.today())
            return f"{start.day}–{end.day}"
        return start.isoformat()

    async def shop_analytics_time_series(
        self,
        shop_id: UUID,
        *,
        days: int,
        market_slug: str,
        stall_goal_node_id: str | None = None,
    ) -> dict[str, Any]:
        days = max(1, min(days, 365))
        granularity = self._analytics_granularity(days)
        now = datetime.now(timezone.utc)
        since = now - timedelta(days=days)
        bucket_keys = self._bucket_keys_for_range(days=days, granularity=granularity, end=now.date())
        buckets: dict[str, dict[str, Any]] = {}
        for k in bucket_keys:
            buckets[k] = {
                "date": k,
                "label": self._bucket_chart_label(k, granularity),
                "views": 0,
                "leads": 0,
                "orders": 0,
                "map_routes": 0,
            }

        trunc = func.date_trunc(granularity, TrackingEventModel.created_at)

        def merge_rows(rows: Sequence[tuple[Any, Any]], field: str) -> None:
            for period_val, count in rows:
                key = period_val.isoformat() if hasattr(period_val, "isoformat") else str(period_val)
                if key in buckets:
                    buckets[key][field] = int(count or 0)

        for event_type, field in (("view", "views"), ("lead", "leads")):
            result = await self._db.execute(
                select(cast(trunc, Date), func.count())
                .where(
                    TrackingEventModel.shop_id == shop_id,
                    TrackingEventModel.event_type == event_type,
                    TrackingEventModel.created_at >= since,
                )
                .group_by(cast(trunc, Date))
            )
            merge_rows(result.all(), field)

        order_trunc = func.date_trunc(granularity, OrderModel.created_at)
        order_rows = await self._db.execute(
            select(cast(order_trunc, Date), func.count())
            .where(OrderModel.shop_id == shop_id, OrderModel.created_at >= since)
            .group_by(cast(order_trunc, Date))
        )
        merge_rows(order_rows.all(), "orders")

        if stall_goal_node_id:
            route_trunc = func.date_trunc(granularity, RouteStatModel.created_at)
            route_rows = await self._db.execute(
                select(cast(route_trunc, Date), func.count())
                .where(
                    RouteStatModel.market_slug == market_slug.lower().strip(),
                    RouteStatModel.goal_node_id == stall_goal_node_id,
                    RouteStatModel.created_at >= since,
                )
                .group_by(cast(route_trunc, Date))
            )
            merge_rows(route_rows.all(), "map_routes")

        return {
            "granularity": granularity,
            "period_label": self._period_label_uz(days),
            "series": [buckets[k] for k in bucket_keys],
        }

    async def shop_analytics_daily_series(
        self,
        shop_id: UUID,
        *,
        days: int,
        market_slug: str,
        stall_goal_node_id: str | None = None,
    ) -> list[dict[str, Any]]:
        payload = await self.shop_analytics_time_series(
            shop_id,
            days=days,
            market_slug=market_slug,
            stall_goal_node_id=stall_goal_node_id,
        )
        return payload["series"]

    async def list_shop_leads(self, shop_id: UUID, limit: int = 20) -> Sequence[LeadModel]:
        result = await self._db.execute(
            select(LeadModel).where(LeadModel.shop_id == shop_id).order_by(LeadModel.id.desc()).limit(limit)
        )
        return result.scalars().all()

    async def get_product_by_id(self, product_id: UUID) -> ProductModel | None:
        from sqlalchemy.orm import selectinload
        result = await self._db.execute(
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(ProductModel.id == product_id)
        )
        return result.scalar_one_or_none()

    async def get_products_by_ids(self, product_ids: list[UUID]) -> dict[UUID, ProductModel]:
        if not product_ids:
            return {}
        from sqlalchemy.orm import selectinload

        result = await self._db.execute(
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(ProductModel.id.in_(product_ids))
        )
        return {p.id: p for p in result.scalars().all()}

    async def increment_product_view_count(self, product_id: UUID) -> None:
        from sqlalchemy import update

        await self._db.execute(
            update(ProductModel)
            .where(ProductModel.id == product_id)
            .values(view_count=ProductModel.view_count + 1)
        )
        await self._db.commit()

    async def search_products(
        self,
        query: str | None,
        limit: int,
        offset: int,
        *,
        category_id: UUID | None = None,
        ipadrom_id: UUID | None = None,
        min_price: int | None = None,
        max_price: int | None = None,
        sale_type: str | None = None,
        market_zone: str | None = None,
        block_sector: str | None = None,
    ) -> Sequence[ProductModel]:
        from sqlalchemy import exists, or_
        from sqlalchemy.orm import selectinload

        stmt = (
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(
                ProductModel.is_available == True,
                self._public_shop_exists(),
            )
        )
        if query:
            stmt = stmt.where(self._product_text_search_clause(query))
        if category_id:
            stmt = stmt.where(ProductModel.category_id == category_id)
        if ipadrom_id:
            stmt = stmt.where(
                exists().where(ShopModel.id == ProductModel.shop_id, ShopModel.ipadrom_id == ipadrom_id)
            )
        if min_price is not None:
            stmt = stmt.where(ProductModel.price >= min_price)
        if max_price is not None:
            stmt = stmt.where(ProductModel.price <= max_price)
        if sale_type:
            stmt = stmt.where(ProductModel.sale_type == sale_type)
        if market_zone:
            zone = market_zone.strip()
            stmt = stmt.where(
                exists().where(
                    ShopModel.id == ProductModel.shop_id,
                    or_(
                        ShopModel.market_zone.ilike(f"%{zone}%"),
                        ShopModel.location_comment.ilike(f"%{zone}%"),
                    ),
                )
            )
        if block_sector:
            sector = block_sector.strip()
            stmt = stmt.where(
                exists().where(
                    ShopModel.id == ProductModel.shop_id,
                    or_(
                        ShopModel.block_sector.ilike(f"%{sector}%"),
                        ShopModel.floor.ilike(f"%{sector}%"),
                        ShopModel.section.ilike(f"%{sector}%"),
                    ),
                )
            )
        stmt = stmt.order_by(ProductModel.id.desc()).limit(limit).offset(offset)
        result = await self._db.execute(stmt)
        return result.scalars().all()

    async def count_products(
        self,
        query: str | None,
        *,
        category_id: UUID | None = None,
        ipadrom_id: UUID | None = None,
        min_price: int | None = None,
        max_price: int | None = None,
        sale_type: str | None = None,
        market_zone: str | None = None,
        block_sector: str | None = None,
    ) -> int:
        from sqlalchemy import exists, func, or_

        stmt = select(func.count(ProductModel.id)).where(
            ProductModel.is_available == True,
            self._public_shop_exists(),
        )
        if query:
            stmt = stmt.where(self._product_text_search_clause(query))
        if category_id:
            stmt = stmt.where(ProductModel.category_id == category_id)
        if ipadrom_id:
            stmt = stmt.where(
                exists().where(ShopModel.id == ProductModel.shop_id, ShopModel.ipadrom_id == ipadrom_id)
            )
        if min_price is not None:
            stmt = stmt.where(ProductModel.price >= min_price)
        if max_price is not None:
            stmt = stmt.where(ProductModel.price <= max_price)
        if sale_type:
            stmt = stmt.where(ProductModel.sale_type == sale_type)
        if market_zone:
            zone = market_zone.strip()
            stmt = stmt.where(
                exists().where(
                    ShopModel.id == ProductModel.shop_id,
                    or_(
                        ShopModel.market_zone.ilike(f"%{zone}%"),
                        ShopModel.location_comment.ilike(f"%{zone}%"),
                    ),
                )
            )
        if block_sector:
            sector = block_sector.strip()
            stmt = stmt.where(
                exists().where(
                    ShopModel.id == ProductModel.shop_id,
                    or_(
                        ShopModel.block_sector.ilike(f"%{sector}%"),
                        ShopModel.floor.ilike(f"%{sector}%"),
                        ShopModel.section.ilike(f"%{sector}%"),
                    ),
                )
            )
        result = await self._db.execute(stmt)
        return int(result.scalar() or 0)

    async def get_similar_products(self, product_id: UUID, limit: int = 4) -> Sequence[ProductModel]:
        from sqlalchemy import func
        from sqlalchemy.orm import selectinload

        base = (
            await self._db.execute(
                select(ProductModel.id, ProductModel.category_id, ProductModel.price, ProductModel.embedding).where(
                    ProductModel.id == product_id
                )
            )
        ).one_or_none()
        if base is None:
            return []

        _, base_category_id, base_price, base_embedding = base
        selected_ids: list[UUID] = []
        collected: list[ProductModel] = []

        def _base_stmt():
            return (
                select(ProductModel)
                .options(selectinload(ProductModel.shop))
                .where(
                    ProductModel.is_available == True,
                    ProductModel.id != product_id,
                    self._public_shop_exists(),
                )
            )

        price_distance = func.abs(ProductModel.price - int(base_price))

        # 1) Primary pass: same category first for tighter relevance.
        stmt = _base_stmt()
        if base_category_id is not None:
            stmt = stmt.where(ProductModel.category_id == base_category_id)
        if base_embedding is not None:
            stmt = stmt.order_by(
                ProductModel.embedding.cosine_distance(base_embedding),
                price_distance,
                ProductModel.view_count.desc(),
                ProductModel.id.desc(),
            )
        else:
            stmt = stmt.order_by(price_distance, ProductModel.view_count.desc(), ProductModel.id.desc())
        stmt = stmt.limit(limit)
        primary_result = await self._db.execute(stmt)
        primary_items = primary_result.scalars().all()
        collected.extend(primary_items)
        selected_ids.extend(item.id for item in primary_items)

        if len(collected) >= limit:
            return collected[:limit]

        # 2) Fallback pass: fill remaining slots from all products.
        fallback_stmt = _base_stmt()
        if selected_ids:
            fallback_stmt = fallback_stmt.where(ProductModel.id.notin_(selected_ids))
        if base_embedding is not None:
            fallback_stmt = fallback_stmt.order_by(
                ProductModel.embedding.cosine_distance(base_embedding),
                price_distance,
                ProductModel.view_count.desc(),
                ProductModel.id.desc(),
            )
        else:
            fallback_stmt = fallback_stmt.order_by(price_distance, ProductModel.view_count.desc(), ProductModel.id.desc())
        fallback_stmt = fallback_stmt.limit(max(0, limit - len(collected)))
        fallback_result = await self._db.execute(fallback_stmt)
        collected.extend(fallback_result.scalars().all())
        return collected[:limit]

    async def bind_shop_telegram_chat(self, shop_id: UUID, telegram_chat_id: int) -> ShopModel | None:
        shop = await self.get_shop(shop_id)
        if shop is None:
            return None
        shop.telegram_chat_id = telegram_chat_id
        await self._db.commit()
        await self._db.refresh(shop)
        return shop

    async def get_shop_by_telegram_chat_id(self, telegram_chat_id: int) -> ShopModel | None:
        result = await self._db.execute(
            select(ShopModel).where(
                ShopModel.telegram_chat_id == telegram_chat_id,
                ShopModel.is_active == True,
            )
        )
        return result.scalar_one_or_none()

    async def create_merchant_pending_product(
        self,
        *,
        shop_id: UUID,
        vision_attributes: dict,
        telegram_user_id: int | None,
        telegram_chat_id: int | None,
        telegram_file_id: str | None,
        status: str = "pending",
        moderation_reason: str | None = None,
    ) -> MerchantPendingProductModel:
        row = MerchantPendingProductModel(
            shop_id=shop_id,
            vision_attributes=vision_attributes,
            telegram_user_id=telegram_user_id,
            telegram_chat_id=telegram_chat_id,
            telegram_file_id=telegram_file_id,
            status=status,
            moderation_reason=moderation_reason,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return row

    async def list_active_shops_for_map(
        self,
        *,
        limit: int = 500,
        market_zone: str | None = None,
        market_slug: str = "ippodrom",
    ) -> list[ShopModel]:
        from app.application.map.market_slugs import normalize_market_slug

        stmt = (
            select(ShopModel)
            .where(
                ShopModel.is_active == True,
                ShopModel.is_blocked.is_(False),
            )
            .order_by(ShopModel.is_featured.desc(), ShopModel.rating.desc(), ShopModel.name.asc())
            .limit(limit)
        )
        if market_zone:
            zone = market_zone.strip()
            if zone:
                zone_match = ShopModel.market_zone.ilike(f"%{zone}%")
                # Legacy CRM shops often have NULL market_zone — treat as Ippodrom default.
                if normalize_market_slug(market_slug) == "ippodrom":
                    legacy = or_(
                        ShopModel.market_zone.is_(None),
                        ShopModel.market_zone == "",
                    )
                    stmt = stmt.where(or_(zone_match, legacy))
                else:
                    stmt = stmt.where(zone_match)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def list_featured_shops(
        self,
        *,
        ipadrom_id: UUID | None = None,
        limit: int = 50,
    ) -> list[ShopModel]:
        from datetime import datetime, timezone

        from sqlalchemy import or_

        now = datetime.now(timezone.utc)
        stmt = (
            select(ShopModel)
            .where(
                ShopModel.is_featured == True,
                ShopModel.is_active == True,
                ShopModel.is_verified == True,
                or_(ShopModel.featured_until.is_(None), ShopModel.featured_until >= now),
            )
            .order_by(ShopModel.rating.desc())
            .limit(limit)
        )
        if ipadrom_id:
            stmt = stmt.where(ShopModel.ipadrom_id == ipadrom_id)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def get_pending_product(self, pending_id: UUID, *, shop_id: UUID | None = None) -> MerchantPendingProductModel | None:
        stmt = select(MerchantPendingProductModel).where(MerchantPendingProductModel.id == pending_id)
        if shop_id:
            stmt = stmt.where(MerchantPendingProductModel.shop_id == shop_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_pending_products(
        self,
        shop_id: UUID,
        *,
        status: str | None = "pending",
        limit: int = 50,
    ) -> list[MerchantPendingProductModel]:
        stmt = select(MerchantPendingProductModel).where(MerchantPendingProductModel.shop_id == shop_id)
        if status:
            stmt = stmt.where(MerchantPendingProductModel.status == status)
        stmt = stmt.order_by(MerchantPendingProductModel.created_at.desc()).limit(limit)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def update_pending_product(
        self,
        row: MerchantPendingProductModel,
        *,
        status: str | None = None,
        moderation_reason: str | None = None,
        vision_attributes: dict | None = None,
        published_product_id: UUID | None = None,
    ) -> MerchantPendingProductModel:
        if status is not None:
            row.status = status
        if moderation_reason is not None:
            row.moderation_reason = moderation_reason
        if vision_attributes is not None:
            row.vision_attributes = vision_attributes
        if published_product_id is not None:
            row.published_product_id = published_product_id
        await self._db.commit()
        await self._db.refresh(row)
        return row
