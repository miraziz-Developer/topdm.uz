#!/usr/bin/env python3
"""Production E2E: pickup QR issue + merchant scan (REAL AVTO yoki birinchi pickup order)."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from uuid import UUID

_script_dir = Path(__file__).resolve().parent
_repo_root = _script_dir.parent
_backend_root = _repo_root / "backend"
sys.path.insert(0, str(_backend_root))

SHOP_LOGIN = os.environ.get("TEST_SHOP_LOGIN", "REALAVTO-F93C").strip().upper()
SHOP_ID = os.environ.get("TEST_SHOP_ID", "888c4997-c474-4e76-bac9-00fe8d44a13a").strip()
PRODUCT_ID = os.environ.get("TEST_PRODUCT_ID", "e0cd27a5-7638-4e84-9d1a-723dbbba00b8").strip()
TEST_PHONE = os.environ.get("TEST_CUSTOMER_PHONE", "+998901112233").strip()


async def main() -> int:
    from sqlalchemy import select

    from app.application.merchant.order_pickup_completion import OrderPickupCompletionService
    from app.application.merchant.pickup_qr import issue_pickup_qr_token, verify_pickup_qr_token
    from app.infrastructure.db.models import OrderModel
    from app.infrastructure.db.session import AsyncSessionFactory
    from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        shop = None
        if SHOP_ID:
            try:
                shop = await repo.get_shop(UUID(SHOP_ID))
            except ValueError:
                shop = None
        if shop is None and SHOP_LOGIN:
            cred = await repo.get_merchant_credential_by_login_code(SHOP_LOGIN)
            if cred:
                shop = await repo.get_shop(cred.shop_id)

        if shop is None:
            print("FAIL shop not found")
            return 1

        print(f"SHOP {shop.name} ({shop.id})")

        result = await session.execute(
            select(OrderModel)
            .where(
                OrderModel.shop_id == shop.id,
                OrderModel.fulfillment_type != "delivery",
                OrderModel.status.in_(["reserved", "confirmed", "preparing", "ready"]),
            )
            .order_by(OrderModel.created_at.desc())
            .limit(1)
        )
        order = result.scalar_one_or_none()
        if order is None:
            print("INFO creating test pickup order (ready)...")
            from datetime import date, timedelta

            from app.services.inventory import reserve_pickup_line_locked

            try:
                line = await reserve_pickup_line_locked(
                    session,
                    product_id=UUID(PRODUCT_ID),
                    quantity=1,
                    customer_phone=TEST_PHONE,
                    customer_email=None,
                    pickup_date=date.today() + timedelta(days=1),
                    pickup_time="12:00",
                    note="QR E2E test",
                    ref_token=None,
                    payment_method="cash",
                    status="ready",
                )
                order = line.order
                await session.commit()
                print(f"OK test order created {order.id}")
            except Exception as exc:
                print(f"FAIL could not create order: {exc}")
                return 1

        print(f"ORDER {order.id} status={order.status} phone={order.customer_phone}")

        service = OrderPickupCompletionService(session)
        qr = await service.get_pickup_qr_for_customer(order.id, order.customer_phone)
        print(f"OK customer QR product={qr['product_name']}")

        token = qr["qr_token"]
        verify_pickup_qr_token(token)
        print("OK token verified")

        prev_status = order.status
        scan = await service.scan_and_complete_pickup(shop.id, token)
        await session.commit()
        print(f"OK scan status={scan['status']} product={scan['product']['name']}")
        print(f"   already_completed={scan['already_completed']}")

        # idempotent second scan
        scan2 = await service.scan_and_complete_pickup(shop.id, token)
        await session.commit()
        assert scan2["already_completed"] is True
        print("OK idempotent re-scan")

        print(f"NOTE order was {prev_status} -> {scan['status']}")

        print("PASS pickup QR E2E")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
