class StoryLimitError(Exception):
    """Do'kon faol story limiti (3 ta)."""

    def __init__(self, *, active_count: int, limit: int) -> None:
        self.active_count = active_count
        self.limit = limit
        super().__init__(
            "Sizda faol storylar limiti tugadi. Yangisini qo'shish uchun eskisini o'chiring."
        )
