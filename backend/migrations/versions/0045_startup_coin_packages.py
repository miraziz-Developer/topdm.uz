"""Startup bosqichi — reklama balansi paketlari arzonlashtirildi (1 coin = 1 000 so'm)."""

from alembic import op

revision = "0045_startup_coin_packages"
down_revision = "0044_chat_read_cursors"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE coin_packages
        SET name_uz = 'Boshlang''ich — 50 coin', amount_uzs = 49900, coins = 50
        WHERE code = 'starter'
        """
    )
    op.execute(
        """
        UPDATE coin_packages
        SET name_uz = 'O''sish — 150 coin', amount_uzs = 99900, coins = 150
        WHERE code = 'growth'
        """
    )
    op.execute(
        """
        UPDATE coin_packages
        SET name_uz = 'Pro — 500 coin', amount_uzs = 249900, coins = 500
        WHERE code = 'pro'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE coin_packages
        SET name_uz = 'Starter — 50 coin', amount_uzs = 500000, coins = 50
        WHERE code = 'starter'
        """
    )
    op.execute(
        """
        UPDATE coin_packages
        SET name_uz = 'Growth — 150 coin', amount_uzs = 1200000, coins = 150
        WHERE code = 'growth'
        """
    )
    op.execute(
        """
        UPDATE coin_packages
        SET name_uz = 'Pro — 500 coin', amount_uzs = 3500000, coins = 500
        WHERE code = 'pro'
        """
    )
