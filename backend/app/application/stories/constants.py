"""Story — Instagram-style qoidalar."""

from datetime import datetime, timedelta, timezone

STORY_TTL_HOURS = 24
MAX_ACTIVE_STORIES_PER_SHOP = 3
STORY_DOCK_SHOP_LIMIT = 15
STORY_GC_BATCH_SIZE = 200


def story_is_hot(created_at: datetime | None, *, window_hours: int = 2) -> bool:
    if created_at is None:
        return False
    now = datetime.now(timezone.utc)
    created = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    return created >= now - timedelta(hours=window_hours)
