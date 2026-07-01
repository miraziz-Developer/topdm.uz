from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.loyalty.customer_coin_service import CustomerCoinService
from app.infrastructure.auth.deps import get_optional_user
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/loyalty", tags=["loyalty"])


@router.get("/info")
async def loyalty_info() -> dict:
    return CustomerCoinService.loyalty_info()


@router.get("/balance")
async def loyalty_balance(
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if not user:
        return {"coins_balance": 0, "coins_balance_uzs": 0, "logged_in": False}
    svc = CustomerCoinService(db)
    balance = await svc.get_balance(UUID(str(user.id)))
    info = svc.loyalty_info()
    return {
        "coins_balance": balance,
        "coins_balance_uzs": balance * info["coin_uzs_rate"],
        "logged_in": True,
        **info,
    }
