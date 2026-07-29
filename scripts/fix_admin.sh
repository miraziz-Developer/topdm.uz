#!/usr/bin/env bash
# Fix admin panel on web server (152.42.204.27)

set -e

SERVER="152.42.204.27"
PASS="mirR@2007aziz"

echo "=== FIXING ADMIN PANEL ==="

# 1. Remove duplicate ADMIN_API_KEY from .env
expect << 'INLINE'
spawn ssh -o StrictHostKeyChecking=no root@$::env(SERVER) "bash"
expect "password:"
send "$::env(PASS)\r"
expect "~#"

# Check current .env
send "echo '=== Current .env ===' && grep -n 'ADMIN_API_KEY' /opt/bozorliii/.env && echo '---'\r"
expect "~#"

# Remove duplicate lines 80-83 (approximate, we checked earlier)
send "cd /opt/bozorliii && sed -i '/ADMIN_PANEL_PASSWORD=bozorliii4575/d' .env && sed -i '/ADMIN_PANEL_SECRET=/d' .env && echo 'CLEANED'\r"
expect "~#"

# Add clean ADMIN_PANEL env vars
send "echo 'ADMIN_PANEL_PASSWORD=bozorliii4575' >> /opt/bozorliii/.env && echo 'ADMIN_PANEL_SECRET='\$(openssl rand -hex 32) >> /opt/bozorliii/.env && echo 'ADDED'\r"
expect "~#"

# Verify .env
send "grep -n 'ADMIN_PANEL' /opt/bozorliii/.env && echo '---' && grep -n 'ADMIN_API_KEY' /opt/bozorliii/.env\r"
expect "~#"

# 2. Restart platform-admin container with new env
send "docker compose -f /opt/bozorliii/docker-compose.web.yml up -d --no-deps --force-recreate platform-admin\r"
expect "~#"

# Wait and check
send "sleep 8 && docker ps --format '{{.Names}} {{.Status}}' | grep platform-admin\r"
expect "~#"

# 3. Create admin_routes.py in backend
send "echo '=== Writing admin_routes.py ==='\r"
expect "~#"

send "cat > /opt/bozorliii/backend/app/interfaces/api/admin_routes.py << 'PYEOF'
\"\"\"Admin-only endpoints for the platform admin dashboard.\"\"\"
import logging
from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix=\"/admin\", tags=[\"Platform Admin\"])


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

def _get_settings():
    from app.core.settings import get_settings
    return get_settings()


def require_admin_key(x_admin_key: str = Header(..., alias=\"X-Admin-Key\")):
    settings = _get_settings()
    expected = (settings.ADMIN_API_KEY or \"\").strip()
    if not expected:
        raise HTTPException(status_code=503, detail=\"ADMIN_API_KEY not configured\")
    if x_admin_key.strip() != expected:
        raise HTTPException(status_code=403, detail=\"Invalid admin key\")
    return x_admin_key


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AdminDashboardSummary(BaseModel):
    total_users: int
    total_merchants: int
    total_orders: int
    total_revenue: float
    recent_orders: list


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

DEFAULT_ADMIN_EXCHANGE_RATE = 12_500.0  # so'm per 1 USD


def _safe_db_count(statement) -> int:
    try:
        from app.infrastructure.db.session import get_db
        db = next(get_db())
        result = db.execute(statement)
        return result.scalar() or 0
    except Exception as exc:
        logger.warning(\"DB count failed: %s\", exc)
        return 0
    finally:
        db.close()


def _recent_orders(limit: int = 10) -> list:
    try:
        from app.infrastructure.db.session import get_db
        from app.models.order import Order
        db = next(get_db())
        rows = (
            db.query(Order.id, Order.status, Order.total_amount, Order.created_at)
            .order_by(Order.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                \"id\": str(r.id),
                \"status\": r.status,
                \"total_amount\": float(r.total_amount or 0),
                \"created_at\": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    except Exception as exc:
        logger.warning(\"Recent orders query failed: %s\", exc)
        return []
    finally:
        db.close()


def _total_revenue() -> float:
    try:
        from sqlalchemy import func
        from app.infrastructure.db.session import get_db
        from app.models.wallet import WalletTransaction
        db = next(get_db())
        total = db.query(func.coalesce(func.sum(WalletTransaction.amount), 0)).scalar()
        return float(total or 0)
    except Exception as exc:
        logger.warning(\"Revenue query failed: %s\", exc)
        return 0.0
    finally:
        db.close()


@router.get(\"/dashboard\", summary=\"Basic admin dashboard summary\")
async def admin_dashboard(_: str = Depends(require_admin_key)):
    \"\"\"Return a lightweight dashboard summary.\"\"\"
    from sqlalchemy import func
    from app.models.merchant import Merchant
    from app.models.user import User
    from app.models.order import Order

    total_users = _safe_db_count(func.select(func.count(User.id)))
    total_merchants = _safe_db_count(func.select(func.count(Merchant.id)))
    total_orders = _safe_db_count(func.select(func.count(Order.id)))
    revenue = _total_revenue()

    return {
        \"total_users\": total_users,
        \"total_merchants\": total_merchants,
        \"total_orders\": total_orders,
        \"total_revenue\": revenue,
        \"recent_orders\": _recent_orders(),
        \"exchange_rate\": DEFAULT_ADMIN_EXCHANGE_RATE,
    }


@router.get(\"/users\", summary=\"List users\")
async def list_users(
    limit: int = 50,
    offset: int = 0,
    _: str = Depends(require_admin_key),
):
    \"\"\"Return paginated user list.\"\"\"
    try:
        from app.infrastructure.db.session import get_db
        from app.models.user import User
        db = next(get_db())
        rows = (
            db.query(User.id, User.name, User.phone, User.created_at)
            .order_by(User.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )
        return {
            \"items\": [
                {
                    \"id\": str(r.id),
                    \"name\": r.name,
                    \"phone\": r.phone,
                    \"created_at\": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ],
            \"limit\": limit,
            \"offset\": offset,
        }
    except Exception as exc:
        logger.warning(\"Users query failed: %s\", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


@router.get(\"/merchants\", summary=\"List merchants\")
async def list_merchants(
    limit: int = 50,
    offset: int = 0,
    _: str = Depends(require_admin_key),
):
    \"\"\"Return paginated merchant list.\"\"\"
    try:
        from app.infrastructure.db.session import get_db
        from app.models.merchant import Merchant
        db = next(get_db())
        rows = (
            db.query(Merchant.id, Merchant.store_name, Merchant.status, Merchant.created_at)
            .order_by(Merchant.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )
        return {
            \"items\": [
                {
                    \"id\": str(r.id),
                    \"store_name\": r.store_name,
                    \"status\": r.status,
                    \"created_at\": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ],
            \"limit\": limit,
            \"offset\": offset,
        }
    except Exception as exc:
        logger.warning(\"Merchants query failed: %s\", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


@router.get(\"/orders\", summary=\"List orders\")
async def list_orders(
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
    _: str = Depends(require_admin_key),
):
    \"\"\"Return paginated order list.\"\"\"
    try:
        from app.infrastructure.db.session import get_db
        from app.models.order import Order
        db = next(get_db())
        query = db.query(Order)
        if status:
            query = query.filter(Order.status == status)
        rows = query.order_by(Order.created_at.desc()).limit(limit).offset(offset).all()
        return {
            \"items\": [
                {
                    \"id\": str(r.id),
                    \"status\": r.status,
                    \"total_amount\": float(r.total_amount or 0),
                    \"created_at\": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ],
            \"limit\": limit,
            \"offset\": offset,
        }
    except Exception as exc:
        logger.warning(\"Orders query failed: %s\", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


@router.get(\"/analytics\", summary=\"Basic analytics summary\")
async def admin_analytics(
    days: int = 7,
    _: str = Depends(require_admin_key),
):
    \"\"\"Return basic analytics for the last N days.\"\"\"
    from datetime import datetime, timedelta
    from sqlalchemy import func
    from app.infrastructure.db.session import get_db
    from app.models.order import Order
    from app.models.user import User

    try:
        db = next(get_db())
        since = datetime.utcnow() - timedelta(days=days)

        new_users = (
            db.query(func.count(User.id))
            .filter(User.created_at >= since)
            .scalar()
            or 0
        )

        new_orders = (
            db.query(func.count(Order.id))
            .filter(Order.created_at >= since)
            .scalar()
            or 0
        )

        revenue = (
            db.query(func.coalesce(func.sum(Order.total_amount), 0))
            .filter(Order.created_at >= since)
            .scalar()
            or 0
        )

        return {
            \"period_days\": days,
            \"new_users\": new_users,
            \"new_orders\": new_orders,
            \"revenue\": float(revenue),
        }
    except Exception as exc:
        logger.warning(\"Analytics query failed: %s\", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()
PYEOF\r"
expect "~#"

# Verify file was written
send "wc -l /opt/bozorliii/backend/app/interfaces/api/admin_routes.py && echo '---' && head -5 /opt/bozorliii/backend/app/interfaces/api/admin_routes.py\r"
expect "~#"

# 4. Restart backend container
send "docker restart bozorliii-backend-1\r"
expect "~#"

# Wait for healthcheck
send "sleep 20 && docker ps --format '{{.Names}} {{.Status}}' | grep backend\r"
expect "~#"

# 5. Test login
send "echo '=== Login Test ===' && curl -s -c /tmp/c3 -X POST -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"bozorliii4575\"}' http://127.0.0.1:3000/api/auth/login\r"
expect "~#"

# 6. Test dashboard
send "echo '=== Dashboard Test ===' && curl -s -w '\\nHTTP_CODE:%{http_code}\\n' -b /tmp/c3 http://127.0.0.1:3000/api/v1/admin/dashboard | head -c 300\r"
expect "~#"

send "echo '=== DONE ==='\r"
expect "~#"

send "exit\r"
expect eof
INLINE

echo "=== Script finished ==="
