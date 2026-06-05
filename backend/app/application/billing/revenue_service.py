"""Platform revenue tracker — komissiya va daromad hisobi."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings


class RevenueService:
    """Platformaning daromadini hisoblaydi (admin uchun)."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def platform_summary(self, days: int = 30) -> dict[str, Any]:
        """Platform daromadi — banner, obuna, komissiya."""
        since = datetime.now(timezone.utc) - timedelta(days=days)

        try:
            # Banner daromadi
            banner_result = await self._db.execute(
                text("""
                    SELECT
                        COALESCE(SUM(CAST(amount_uzs AS NUMERIC)), 0) AS total_uzs,
                        COUNT(*) AS count
                    FROM banner_payment_transactions
                    WHERE transaction_timestamp >= :since AND status = 'success'
                """),
                {"since": since},
            )
            banner_row = banner_result.mappings().first() or {}

            # Faol do'konlar
            shop_result = await self._db.execute(
                text("SELECT COUNT(*) AS cnt FROM shops WHERE is_verified = TRUE AND is_active = TRUE")
            )
            shop_row = shop_result.mappings().first() or {}

            # Buyurtmalar komissiyasi (taxminiy)
            order_result = await self._db.execute(
                text("""
                    SELECT
                        COALESCE(SUM(total_price), 0) AS gmv,
                        COUNT(*) AS order_count
                    FROM orders
                    WHERE created_at >= :since AND status = 'completed'
                """),
                {"since": since},
            )
            order_row = order_result.mappings().first() or {}

            gmv = float(order_row.get("gmv") or 0)
            from app.application.billing.plans import COMMISSION_RATE_PCT

            commission = round(gmv * COMMISSION_RATE_PCT / 100)

            return {
                "period_days": days,
                "banner_revenue_uzs": float(banner_row.get("total_uzs") or 0),
                "banner_campaigns_sold": int(banner_row.get("count") or 0),
                "active_shops": int(shop_row.get("cnt") or 0),
                "order_gmv_uzs": gmv,
                "commission_rate_pct": COMMISSION_RATE_PCT,
                "commission_uzs": commission,
                "total_revenue_uzs": float(banner_row.get("total_uzs") or 0) + commission,
            }
        except Exception as exc:
            return {"error": str(exc), "period_days": days}

    async def shop_revenue_summary(self, shop_id: UUID, days: int = 30) -> dict[str, Any]:
        """Do'konchi savdosi — o'z bazaviy narxi bo'yicha (15% ustama platforma daromadi, alohida)."""
        since = datetime.now(timezone.utc) - timedelta(days=days)
        markup_pct = float(get_settings().platform_product_markup_pct)
        try:
            order_result = await self._db.execute(
                text("""
                    SELECT
                        COALESCE(SUM(o.total_price), 0) AS customer_sales,
                        COALESCE(SUM(p.price * o.quantity), 0) AS merchant_earnings,
                        COUNT(*) AS count
                    FROM orders o
                    INNER JOIN products p ON p.id = o.product_id
                    WHERE o.shop_id = :shop_id
                      AND o.created_at >= :since
                      AND o.status IN ('completed', 'reserved', 'ready')
                """),
                {"shop_id": str(shop_id), "since": since},
            )
            row = order_result.mappings().first() or {}
            customer_sales = float(row.get("customer_sales") or 0)
            merchant_earnings = float(row.get("merchant_earnings") or 0)
            platform_markup = max(0.0, customer_sales - merchant_earnings)

            lead_result = await self._db.execute(
                text("SELECT COUNT(*) AS cnt FROM leads WHERE shop_id = :shop_id AND status != 'dismissed'"),
                {"shop_id": str(shop_id)},
            )
            lead_row = lead_result.mappings().first() or {}

            return {
                "period_days": days,
                "merchant_earnings_uzs": merchant_earnings,
                "customer_sales_uzs": customer_sales,
                "platform_markup_uzs": platform_markup,
                "markup_pct": markup_pct,
                # Eski CRM maydonlari — do'konchi daromadi (noto'g'ri net komissiya emas)
                "gross_revenue_uzs": merchant_earnings,
                "net_revenue_uzs": merchant_earnings,
                "platform_fee_uzs": platform_markup,
                "commission_rate_pct": 0,
                "order_count": int(row.get("count") or 0),
                "lead_count": int(lead_row.get("cnt") or 0),
            }
        except Exception as exc:
            return {"error": str(exc)}
