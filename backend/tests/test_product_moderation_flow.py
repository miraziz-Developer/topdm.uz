"""Mahsulot yuklash — to'g'ridan-to'g'ri katalog (platforma moderatsiyasi yo'q)."""

from __future__ import annotations

from uuid import uuid4

from app.application.merchant.product_service import _stored_image_urls
from app.application.merchant.schemas import PublishPendingProductResult


def test_stored_image_urls_from_crm_attrs():
    urls = _stored_image_urls(
        {
            "image_url": "https://media.example/a.jpg",
            "images": ["https://media.example/b.jpg"],
            "variants": [{"images": ["https://media.example/c.jpg"]}],
        }
    )
    assert "https://media.example/a.jpg" in urls
    assert len(urls) == 3


def test_publish_result_published_status():
    row = PublishPendingProductResult(
        pending_id=uuid4(),
        product_id=uuid4(),
        product_name="Ko'ylak",
        image_url="https://media.example/a.jpg",
        status="published",
    )
    assert row.status == "published"
