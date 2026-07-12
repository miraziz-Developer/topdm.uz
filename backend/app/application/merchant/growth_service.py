from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel, ShopSupplierLinkModel
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.wallet_repo import WalletRepository

REFERRAL_REWARD_COINS = 5_000


def _slug_code(name: str) -> str:
    raw = "".join(c for c in name.upper() if c.isalnum())[:6] or "SHOP"
    return f"{raw}{secrets.token_hex(2).upper()}"


class MerchantGrowthService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = MarketplaceRepository(session)
        self._settings = get_settings()

    async def ensure_referral_code(self, shop: ShopModel) -> str:
        if shop.referral_code:
            return shop.referral_code
        for _ in range(10):
            code = _slug_code(shop.name)
            exists = await self._session.execute(
                select(ShopModel.id).where(ShopModel.referral_code == code)
            )
            if exists.scalar_one_or_none() is None:
                shop.referral_code = code
                await self._session.flush()
                return code
        code = _slug_code(shop.name) + secrets.token_hex(1).upper()
        shop.referral_code = code
        await self._session.flush()
        return code

    async def referral_panel(self, shop_id: uuid.UUID) -> dict[str, Any]:
        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise ValueError("shop_not_found")
        code = await self.ensure_referral_code(shop)
        bot = (self._settings.telegram_bot_username or "").strip().lstrip("@")
        if bot:
            link = f"https://t.me/{bot}?start=ref_{code}"
        else:
            crm = self._settings.merchant_crm_webapp_url.rstrip("/")
            link = f"{crm}/login?ref={code}"
        referred_count = await self._session.scalar(
            select(func.count()).select_from(ShopModel).where(ShopModel.referred_by_shop_id == shop_id)
        )
        rewarded_count = await self._session.scalar(
            select(func.count())
            .select_from(ShopModel)
            .where(ShopModel.referred_by_shop_id == shop_id, ShopModel.referral_rewarded_at.isnot(None))
        )
        return {
            "referral_code": code,
            "referral_link": link,
            "reward_coins_each": REFERRAL_REWARD_COINS,
            "referred_shops": int(referred_count or 0),
            "rewarded_shops": int(rewarded_count or 0),
            "share_text": (
                f"Do'stingni Bozorliii CRM ga taklif qil — ikkalangizga {REFERRAL_REWARD_COINS:,} coin "
                f"(banner/boost uchun). Havola: {link}"
            ).replace(",", " "),
        }

    async def apply_referral_code(self, new_shop: ShopModel, code: str | None) -> None:
        if not code or not str(code).strip():
            return
        ref = str(code).strip().upper()
        referrer = (
            await self._session.execute(select(ShopModel).where(ShopModel.referral_code == ref))
        ).scalar_one_or_none()
        if not referrer or referrer.id == new_shop.id:
            return
        if new_shop.referred_by_shop_id:
            return
        if referrer.owner_phone == new_shop.owner_phone:
            return
        new_shop.referred_by_shop_id = referrer.id
        await self._session.flush()

    async def try_reward_referral(self, shop_id: uuid.UUID) -> dict[str, Any] | None:
        """Birinchi yakunlangan buyurtmada ikkala tomonga coin."""
        from app.infrastructure.db.models import ShopModel

        from sqlalchemy.orm import noload

        result = await self._session.execute(
            select(ShopModel)
            .where(ShopModel.id == shop_id)
            .options(noload(ShopModel.ipadrom))
            .with_for_update()
        )
        shop = result.scalar_one_or_none()
        if not shop or shop.referral_rewarded_at or not shop.referred_by_shop_id:
            return None
        completed_count = await self._session.scalar(
            select(func.count())
            .select_from(OrderModel)
            .where(OrderModel.shop_id == shop_id, OrderModel.status == "completed")
        )
        if int(completed_count or 0) < 1:
            return None

        shop.referral_rewarded_at = datetime.now(timezone.utc)
        await self._session.flush()

        wallet = WalletRepository(self._session)
        await wallet.add_coins(shop_id, REFERRAL_REWARD_COINS)
        await wallet.add_coins(shop.referred_by_shop_id, REFERRAL_REWARD_COINS)
        await self._session.flush()
        return {
            "rewarded": True,
            "coins_each": REFERRAL_REWARD_COINS,
            "referrer_shop_id": str(shop.referred_by_shop_id),
        }

    async def sales_report_card(self, shop_id: uuid.UUID, *, period: str = "week") -> dict[str, Any]:
        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise ValueError("shop_not_found")
        days = 7 if period == "week" else 30
        label = "Haftalik" if period == "week" else "Oylik"
        now = datetime.now(timezone.utc)
        current_start = now - timedelta(days=days)
        prev_start = current_start - timedelta(days=days)

        async def _order_stats(since: datetime, until: datetime) -> tuple[int, int]:
            count = await self._session.scalar(
                select(func.count())
                .select_from(OrderModel)
                .where(
                    OrderModel.shop_id == shop_id,
                    OrderModel.status == "completed",
                    OrderModel.created_at >= since,
                    OrderModel.created_at < until,
                )
            )
            revenue = await self._session.scalar(
                select(func.coalesce(func.sum(OrderModel.total_price), 0))
                .where(
                    OrderModel.shop_id == shop_id,
                    OrderModel.status == "completed",
                    OrderModel.created_at >= since,
                    OrderModel.created_at < until,
                )
            )
            return int(count or 0), int(revenue or 0)

        cur_orders, cur_revenue = await _order_stats(current_start, now)
        prev_orders, _prev_rev = await _order_stats(prev_start, current_start)
        growth_pct = 0
        if prev_orders > 0:
            growth_pct = round(((cur_orders - prev_orders) / prev_orders) * 100)
        elif cur_orders > 0:
            growth_pct = 100

        shop_url = f"{self._settings.site_url.rstrip('/')}/shop/{shop.slug}"
        headline = (
            f"Ushbu {'haftada' if period == 'week' else 'oyda'} Bozorliii orqali "
            f"{cur_orders} ta buyurtma yopildi!"
        )
        if growth_pct > 0:
            headline += f" +{growth_pct}% o'sish"
        elif growth_pct < 0:
            headline += f" {growth_pct}%"

        share_text = (
            f"📊 {shop.name} — {label.lower()} savdo hisoboti\n"
            f"{headline}\n"
            f"Jami: {cur_revenue:,} so'm\n"
            f"🔗 {shop_url}\n\n"
            f"Bozorliii — bozor uchun CRM va onlayn vitrina"
        ).replace(",", " ")

        return {
            "period": period,
            "period_label": label,
            "shop_name": shop.name,
            "orders_count": cur_orders,
            "revenue_uzs": cur_revenue,
            "growth_pct": growth_pct,
            "headline": headline,
            "share_text": share_text,
            "shop_url": shop_url,
            "telegram_share_url": (
                f"https://t.me/share/url?url={quote(shop_url, safe='')}"
                f"&text={quote(share_text[:400], safe='')}"
            ),
        }

    async def link_supplier(self, retail_shop_id: uuid.UUID, supplier_slug: str) -> dict[str, Any]:
        supplier = await self._repo.get_shop_by_slug(supplier_slug.strip().lower())
        if not supplier:
            raise ValueError("supplier_not_found")
        if supplier.id == retail_shop_id:
            raise ValueError("self_supplier")
        existing = await self._session.execute(
            select(ShopSupplierLinkModel).where(
                ShopSupplierLinkModel.retail_shop_id == retail_shop_id,
                ShopSupplierLinkModel.supplier_shop_id == supplier.id,
            )
        )
        if existing.scalar_one_or_none():
            return {"status": "already_linked", "supplier": self._supplier_brief(supplier)}
        link = ShopSupplierLinkModel(retail_shop_id=retail_shop_id, supplier_shop_id=supplier.id)
        self._session.add(link)
        await self._session.commit()
        return {"status": "linked", "supplier": self._supplier_brief(supplier)}

    async def list_suppliers(self, retail_shop_id: uuid.UUID) -> list[dict[str, Any]]:
        rows = (
            await self._session.execute(
                select(ShopSupplierLinkModel, ShopModel)
                .join(ShopModel, ShopModel.id == ShopSupplierLinkModel.supplier_shop_id)
                .where(ShopSupplierLinkModel.retail_shop_id == retail_shop_id)
            )
        ).all()
        return [self._supplier_brief(shop, link_id=str(link.id)) for link, shop in rows]

    async def list_supplier_products(self, retail_shop_id: uuid.UUID, supplier_shop_id: uuid.UUID) -> list[dict]:
        linked = await self._session.execute(
            select(ShopSupplierLinkModel.id).where(
                ShopSupplierLinkModel.retail_shop_id == retail_shop_id,
                ShopSupplierLinkModel.supplier_shop_id == supplier_shop_id,
            )
        )
        if not linked.scalar_one_or_none():
            raise ValueError("not_linked")
        products = await self._repo.list_shop_products(supplier_shop_id, limit=80, offset=0)
        return [
            {
                "id": str(p.id),
                "name": p.name,
                "price": p.price,
                "images": p.images[:1] if p.images else [],
                "sale_type": p.sale_type,
            }
            for p in products
            if p.is_available
        ]

    async def import_supplier_product(
        self,
        retail_shop_id: uuid.UUID,
        supplier_product_id: uuid.UUID,
    ) -> dict[str, Any]:
        product = await self._repo.get_product_by_id(supplier_product_id)
        if not product or not product.is_available:
            raise ValueError("product_not_found")
        linked = await self._session.execute(
            select(ShopSupplierLinkModel.id).where(
                ShopSupplierLinkModel.retail_shop_id == retail_shop_id,
                ShopSupplierLinkModel.supplier_shop_id == product.shop_id,
            )
        )
        if not linked.scalar_one_or_none():
            raise ValueError("not_linked")

        existing = await self._session.execute(
            select(ProductModel).where(
                ProductModel.shop_id == retail_shop_id,
                cast(ProductModel.attributes["imported_from"], String) == str(supplier_product_id),
            )
        )
        prior = existing.scalar_one_or_none()
        if prior:
            return {"product_id": str(prior.id), "name": prior.name, "already_imported": True}

        from app.infrastructure.ai_clients.embedding import EmbeddingClient

        embed = EmbeddingClient()
        vector = await embed.embed(product.name)
        clone = ProductModel(
            shop_id=retail_shop_id,
            category_id=product.category_id,
            name=product.name,
            description=product.description,
            price=product.price,
            sale_type=product.sale_type,
            min_order_quantity=product.min_order_quantity,
            pricing_unit=product.pricing_unit,
            units_per_pack=product.units_per_pack,
            images=list(product.images or []),
            attributes={
                **dict(product.attributes or {}),
                "imported_from": str(product.id),
                "supplier_shop_id": str(product.shop_id),
                "import_stock_required": True,
            },
            embedding=vector,
            visual_embedding=product.visual_embedding,
            stock_count=0,
            is_available=False,
        )
        self._session.add(clone)
        await self._session.commit()
        await self._session.refresh(clone)
        return {"product_id": str(clone.id), "name": clone.name}

    @staticmethod
    def _supplier_brief(shop: ShopModel, *, link_id: str | None = None) -> dict[str, Any]:
        return {
            "link_id": link_id,
            "shop_id": str(shop.id),
            "name": shop.name,
            "slug": shop.slug,
            "market_zone": shop.market_zone,
        }
