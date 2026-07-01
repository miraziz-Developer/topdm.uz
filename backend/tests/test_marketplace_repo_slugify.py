from app.core.slug import slugify
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository


def test_slugify_import_used_by_repo_helpers():
    """Regression: category lookup must not raise NameError for slugify."""
    assert slugify("Ayollar ko'ylagi") == "ayollar-koylagi"
    assert hasattr(MarketplaceRepository, "get_category_by_slug_or_name")
