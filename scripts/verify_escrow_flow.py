"""
End-to-end escrow oqimi tekshiruvi (sandbox, real servislar + DB).

Oqim:
  1. Buyurtma yaratiladi
  2. To'lov muvaffaqiyatli -> merchant_share MUZLAYDI (frozen_balance)
  3. BTS yetkazdi -> escrow CHIQADI (frozen -> current_balance)
  4. Do'kon payout so'raydi (current -> pending frozen)
  5. Admin payoutni tasdiqlaydi (frozen debit)
  6. Test ma'lumotlari tozalanadi

Run:
  docker compose -f docker-compose.prod.yml exec -T backend python /app/scripts/verify_escrow_flow.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
from decimal import Decimal
from uuid import uuid4


def _bootstrap_import_path() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("Could not locate backend app package")


_bootstrap_import_path()

from app.application.finance.transaction_splitter import TransactionSplitterService  # noqa: E402
from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel  # noqa: E402
from app.infrastructure.db.session import AsyncSessionFactory  # noqa: E402
from app.infrastructure.repositories.delivery_repo import DeliveryRepository  # noqa: E402
from app.infrastructure.repositories.finance_repo import FinanceRepository  # noqa: E402
from app.models.delivery_claim import MerchantPayoutRequestModel  # noqa: E402
from app.models.finance import (  # noqa: E402
    MerchantFinanceWalletModel,
    PlatformTransactionModel,
    PlatformTransactionStatus,
)

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"

TOTAL = 120000          # mijoz to'lagan umumiy summa
MERCHANT_GOODS = 90000  # do'kon ulushi (komissiya = 120000 - 90000 - 0 = 30000)
DELIVERY = 0            # pickup -> yetkazish 0


class EscrowVerifyError(Exception):
    pass


def _check(cond: bool, label: str, fails: list[str]) -> None:
    if cond:
        print(f"  {PASS} {label}")
    else:
        print(f"  {FAIL} {label}")
        fails.append(label)


async def main() -> int:
    fails: list[str] = []
    suffix = f"{int(time.time())}-{uuid4().hex[:6]}"
    shop_id = uuid4()
    product_id = uuid4()
    order_id = uuid4()

    async with AsyncSessionFactory() as db:
        # --- Setup: test do'kon + mahsulot + buyurtma ---
        shop = ShopModel(
            id=shop_id,
            owner_phone=f"+99890{suffix[-7:]}",
            slug=f"escrow-test-{suffix}",
            name="Escrow Test Shop",
            is_active=True,
        )
        product = ProductModel(
            id=product_id,
            shop_id=shop_id,
            name="Escrow Test Product",
            price=MERCHANT_GOODS,
            images=[],
            attributes={},
            embedding=[0.0] * 1536,
            stock_count=10,
        )
        order = OrderModel(
            id=order_id,
            customer_phone="+998901112233",
            product_id=product_id,
            shop_id=shop_id,
            quantity=1,
            total_price=TOTAL,
            status="confirmed",
            fulfillment_type="pickup",
            payment_method="click",
        )
        db.add_all([shop, product, order])
        await db.commit()
        print(f"Setup: shop={shop_id} order={order_id}\n")

    try:
        # --- 1. To'lov muvaffaqiyatli -> escrow muzlaydi ---
        print("1. To'lov muvaffaqiyatli (escrow MUZLASHI kerak)")
        async with AsyncSessionFactory() as db:
            splitter = TransactionSplitterService(db)
            billing = {
                "provider": "click",
                "idempotency_key": f"escrow-test:{order_id}",
                "amount": TOTAL,
                "total_amount_received": TOTAL,
                "product_subtotal": TOTAL,
                "merchant_subtotal_uzs": MERCHANT_GOODS,
                "delivery_share_uzs": DELIVERY,
            }
            result = await splitter.process_order_payment_success(order_id, billing)
            tx = result["transaction"]
            _check(tx["platform_status"] == PlatformTransactionStatus.HELD_IN_ESCROW.value,
                   f"Tranzaksiya HELD_IN_ESCROW ({tx['platform_status']})", fails)
            _check(int(float(tx["merchant_share"])) == MERCHANT_GOODS,
                   f"merchant_share = {MERCHANT_GOODS} (got {tx['merchant_share']})", fails)
            _check(int(float(tx["platform_commission"])) == TOTAL - MERCHANT_GOODS - DELIVERY,
                   f"platform_commission = {TOTAL - MERCHANT_GOODS - DELIVERY} (sizning daromad)", fails)

        async with AsyncSessionFactory() as db:
            wallet = await db.get(MerchantFinanceWalletModel, shop_id)
            _check(wallet is not None and int(wallet.frozen_balance) == MERCHANT_GOODS,
                   f"frozen_balance = {MERCHANT_GOODS} (pul MUZLADI)", fails)
            _check(wallet is not None and int(wallet.current_balance) == 0,
                   "current_balance = 0 (do'kon hali ololmaydi)", fails)

        # --- 2. BTS yetkazdi -> escrow chiqadi ---
        print("\n2. BTS yetkazdi (escrow CHIQISHI kerak: frozen -> current)")
        async with AsyncSessionFactory() as db:
            splitter = TransactionSplitterService(db)
            await splitter.release_escrow_to_merchant(order_id)
        async with AsyncSessionFactory() as db:
            wallet = await db.get(MerchantFinanceWalletModel, shop_id)
            _check(wallet is not None and int(wallet.frozen_balance) == 0,
                   "frozen_balance = 0 (muzlash bo'shadi)", fails)
            _check(wallet is not None and int(wallet.current_balance) == MERCHANT_GOODS,
                   f"current_balance = {MERCHANT_GOODS} (do'kon endi ololadi)", fails)
            tx = (await db.execute(
                __import__("sqlalchemy").select(PlatformTransactionModel).where(
                    PlatformTransactionModel.order_id == order_id
                )
            )).scalar_one()
            _check(tx.status == PlatformTransactionStatus.RELEASED_TO_MERCHANT.value,
                   f"Tranzaksiya RELEASED_TO_MERCHANT ({tx.status})", fails)

        # --- 3. Do'kon payout so'raydi ---
        print("\n3. Do'kon pul yechishni so'raydi (current -> pending)")
        payout_amount = Decimal(str(MERCHANT_GOODS))
        async with AsyncSessionFactory() as db:
            from sqlalchemy import select

            wallet = (await db.execute(
                select(MerchantFinanceWalletModel)
                .where(MerchantFinanceWalletModel.shop_id == shop_id)
                .with_for_update()
            )).scalar_one()
            wallet.current_balance = wallet.current_balance - payout_amount
            wallet.frozen_balance = (wallet.frozen_balance or Decimal("0")) + payout_amount
            repo = DeliveryRepository(db)
            payout = await repo.create_payout_request(
                shop_id=shop_id, amount_uzs=payout_amount, destination="bank_card"
            )
            payout_id = payout.id
            await db.commit()
        async with AsyncSessionFactory() as db:
            wallet = await db.get(MerchantFinanceWalletModel, shop_id)
            _check(int(wallet.current_balance) == 0, "current_balance = 0 (so'rovga o'tdi)", fails)
            _check(int(wallet.frozen_balance) == MERCHANT_GOODS,
                   f"frozen_balance = {MERCHANT_GOODS} (payout kutilmoqda)", fails)

        # --- 4. Admin payoutni tasdiqlaydi ---
        print("\n4. Admin payoutni tasdiqlaydi (kartaga to'lov)")
        async with AsyncSessionFactory() as db:
            finance = FinanceRepository(db)
            await finance.debit_frozen_balance(shop_id, payout_amount)
            row = await db.get(MerchantPayoutRequestModel, payout_id)
            row.status = "completed"
            await db.commit()
        async with AsyncSessionFactory() as db:
            wallet = await db.get(MerchantFinanceWalletModel, shop_id)
            row = await db.get(MerchantPayoutRequestModel, payout_id)
            _check(int(wallet.frozen_balance) == 0, "frozen_balance = 0 (to'landi)", fails)
            _check(int(wallet.current_balance) == 0, "current_balance = 0 (hammasi to'landi)", fails)
            _check(row.status == "completed", "payout status = completed", fails)

    finally:
        # --- Cleanup ---
        print("\nTozalash: test ma'lumotlari o'chirilmoqda...")
        async with AsyncSessionFactory() as db:
            from sqlalchemy import delete

            await db.execute(delete(MerchantPayoutRequestModel).where(
                MerchantPayoutRequestModel.shop_id == shop_id))
            await db.execute(delete(PlatformTransactionModel).where(
                PlatformTransactionModel.shop_id == shop_id))
            await db.execute(delete(MerchantFinanceWalletModel).where(
                MerchantFinanceWalletModel.shop_id == shop_id))
            await db.execute(delete(OrderModel).where(OrderModel.id == order_id))
            await db.execute(delete(ProductModel).where(ProductModel.id == product_id))
            await db.execute(delete(ShopModel).where(ShopModel.id == shop_id))
            await db.commit()

    print("\n" + "=" * 56)
    if fails:
        print(f"NATIJA: {FAIL} {len(fails)} ta tekshiruv FAILED")
        for f in fails:
            print(f"   - {f}")
        return 1
    print(f"NATIJA: {PASS} ESCROW OQIMI 100% AVTOMATIK ISHLAYDI")
    print("  Mijoz to'ladi -> MUZLADI -> yetkazildi -> do'konga chiqdi -> payout")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
