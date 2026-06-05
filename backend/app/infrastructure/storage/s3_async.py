from __future__ import annotations

from functools import lru_cache

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import Settings


@lru_cache(maxsize=4)
def _session(settings: Settings):
    import aioboto3

    return aioboto3.Session(
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region or "auto",
    )


def _public_url(settings: Settings, key: str) -> str:
    public_base = (settings.s3_public_base_url or "").rstrip("/")
    if public_base:
        return f"{public_base}/{key}"
    if settings.s3_endpoint_url:
        return f"{settings.s3_endpoint_url.rstrip('/')}/{settings.s3_bucket}/{key}"
    return f"https://{settings.s3_bucket}.s3.amazonaws.com/{key}"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.4, min=0.4, max=4))
async def upload_bytes(
    *,
    settings: Settings,
    key: str,
    body: bytes,
    content_type: str,
) -> str:
    if not settings.s3_bucket:
        raise RuntimeError("s3_bucket_not_configured")

    session = _session(settings)
    async with session.client("s3", endpoint_url=settings.s3_endpoint_url or None) as client:
        await client.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=body,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )
    return _public_url(settings, key)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.4, min=0.4, max=4))
async def delete_object(*, settings: Settings, key: str) -> None:
    if not settings.s3_bucket:
        raise RuntimeError("s3_bucket_not_configured")
    session = _session(settings)
    async with session.client("s3", endpoint_url=settings.s3_endpoint_url or None) as client:
        await client.delete_object(Bucket=settings.s3_bucket, Key=key.lstrip("/"))
