from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.payments.click_verify import verify_click_callback
from app.core.config import Settings, get_settings
from app.infrastructure.repositories.payment_repo import PaymentRepository
from app.infrastructure.repositories.wallet_repo import WalletRepository
from app.models.payments import PaymentTransactionModel


class PaymentService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._payments = PaymentRepository(session)
        self._wallet = WalletRepository(session)

    def _checkout_url(self, *, provider: str, transaction_id: UUID, amount_uzs: Decimal) -> str:
        base = (self._settings.payment_checkout_base_url or self._settings.site_url).rstrip("/")
        if provider == "payme":
            return (
                f"{base}/checkout/payme"
                f"?txn={transaction_id}&amount={int(amount_uzs)}"
                f"&merchant={self._settings.payme_merchant_id or 'mock'}"
            )
        return (
            f"{base}/checkout/click"
            f"?txn={transaction_id}&amount={int(amount_uzs)}"
            f"&service={self._settings.click_service_id or 'mock'}"
        )

    async def list_coin_packages(self) -> list[dict[str, Any]]:
        rows = await self._payments.list_coin_packages()
        return [
            {
                "id": str(p.id),
                "code": p.code,
                "name_uz": p.name_uz,
                "coins": p.coins,
                "amount_uzs": float(p.amount_uzs),
            }
            for p in rows
        ]

    async def generate_invoice(
        self,
        *,
        shop_id: UUID,
        coin_package_id: UUID,
        provider: str,
    ) -> dict[str, Any]:
        pkg = await self._payments.get_coin_package(coin_package_id)
        if not pkg:
            raise ValueError("package_not_found")

        prov = provider.strip().lower()
        if prov not in ("click", "payme", "manual"):
            raise ValueError("invalid_provider")

        amount = Decimal(str(pkg.amount_uzs))
        tx = await self._payments.create_transaction(
            shop_id=shop_id,
            coin_package_id=pkg.id,
            amount_uzs=amount,
            coins_added=int(pkg.coins),
            provider=prov,
            checkout_url=None,
        )
        checkout = self._checkout_url(provider=prov, transaction_id=tx.id, amount_uzs=amount)
        tx.checkout_url = checkout
        await self._session.flush()
        await self._session.commit()

        return {
            "transaction_id": str(tx.id),
            "shop_id": str(shop_id),
            "status": tx.status,
            "provider": prov,
            "amount_uzs": float(amount),
            "coins_added": pkg.coins,
            "checkout_url": checkout,
            "package": {"id": str(pkg.id), "code": pkg.code, "name_uz": pkg.name_uz},
        }

    async def process_click_callback(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not verify_click_callback(payload, self._settings):
            raise ValueError("invalid_signature")

        merchant_trans_id = str(payload.get("merchant_trans_id", "")).strip()
        click_trans_id = str(payload.get("click_trans_id", "")).strip()
        action = int(payload.get("action", -1))
        error_code = int(payload.get("error", -1))

        try:
            tx_id = UUID(merchant_trans_id)
        except ValueError as exc:
            raise ValueError("invalid_merchant_trans_id") from exc

        if click_trans_id:
            existing = await self._payments.get_by_provider_trans_id_for_update(
                provider="click",
                provider_trans_id=click_trans_id,
            )
            if existing and existing.status == "success":
                balance = await self._wallet.get_balance(existing.shop_id)
                await self._session.commit()
                return {
                    "error": 0,
                    "error_note": "Success",
                    "click_trans_id": click_trans_id,
                    "merchant_trans_id": merchant_trans_id,
                    "coins_balance": balance,
                    "already_processed": True,
                }

        if action != 1 or error_code != 0:
            try:
                tx = await self._payments.get_transaction_for_update(tx_id)
                if tx and tx.status == "pending":
                    await self._payments.mark_failed(tx)
                await self._session.commit()
            except Exception:
                await self._session.rollback()
                raise
            raise ValueError("payment_not_successful")

        try:
            tx = await self._payments.get_transaction_for_update(tx_id)
            if not tx:
                raise ValueError("transaction_not_found")

            if tx.status == "success":
                balance = await self._wallet.get_balance(tx.shop_id)
                await self._session.commit()
                return {
                    "error": 0,
                    "error_note": "Success",
                    "click_trans_id": click_trans_id,
                    "merchant_trans_id": merchant_trans_id,
                    "coins_balance": balance,
                    "already_processed": True,
                }

            if tx.status != "pending":
                await self._session.rollback()
                raise ValueError("invalid_transaction_state")

            shop = await self._wallet.add_coins(tx.shop_id, int(tx.coins_added))
            await self._wallet.sync_legacy_wallet(tx.shop_id, int(shop.coins_balance))
            await self._payments.mark_success(tx, provider_trans_id=click_trans_id or f"click-{tx.id}")
            await self._session.commit()
            balance = int(shop.coins_balance)
        except Exception:
            await self._session.rollback()
            raise

        return {
            "error": 0,
            "error_note": "Success",
            "click_trans_id": click_trans_id,
            "merchant_trans_id": merchant_trans_id,
            "coins_balance": balance,
        }
