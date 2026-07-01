from datetime import date, timedelta

from app.infrastructure.tasks.order_pickup_expiry_tasks import PICKUP_NO_SHOW_GRACE_DAYS


def test_pickup_no_show_grace_is_four_days():
    assert PICKUP_NO_SHOW_GRACE_DAYS == 4


def test_pickup_cutoff_date_example():
    pickup = date(2026, 6, 28)
    cancel_on = pickup + timedelta(days=PICKUP_NO_SHOW_GRACE_DAYS)
    assert cancel_on == date(2026, 7, 2)
