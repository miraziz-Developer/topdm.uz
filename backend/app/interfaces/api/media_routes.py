from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from app.core.config import get_settings

router = APIRouter(prefix="/media", tags=["media"])

_UPLOAD_PRODUCTS = Path(__file__).resolve().parents[3] / "uploads" / "products"
_UPLOAD_STORIES = Path(__file__).resolve().parents[3] / "uploads" / "stories"
_UPLOAD_BANNERS = Path(__file__).resolve().parents[3] / "uploads" / "banners"
_UPLOAD_REELS = Path(__file__).resolve().parents[3] / "uploads" / "reels"
_UPLOAD_REVIEWS = Path(__file__).resolve().parents[3] / "uploads" / "reviews"
_UPLOAD_SHOPS = Path(__file__).resolve().parents[3] / "uploads" / "shops"


def _media_cors_header(request: Request | None = None) -> str | None:
    settings = get_settings()
    origins = settings.cors_origin_list
    if request:
        origin = (request.headers.get("origin") or "").strip()
        if origin and origin in origins:
            return origin
    if origins:
        return origins[0]
    if not settings.is_production:
        return "*"
    return None


def _video_extra_headers(request: Request | None = None) -> dict[str, str]:
    headers: dict[str, str] = {"Accept-Ranges": "bytes"}
    origin = _media_cors_header(request)
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
    return headers


def _image_response(root: Path, shop_id: UUID, filename: str) -> FileResponse:
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = root / str(shop_id) / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    media = "image/jpeg"
    if filename.lower().endswith(".png"):
        media = "image/png"
    elif filename.lower().endswith(".webp"):
        media = "image/webp"
    return FileResponse(path, media_type=media)


@router.get("/products/{shop_id}/{filename}")
async def get_product_image(shop_id: UUID, filename: str) -> FileResponse:
    return _image_response(_UPLOAD_PRODUCTS, shop_id, filename)


@router.get("/stories/{shop_id}/{filename}")
async def get_story_image(shop_id: UUID, filename: str) -> FileResponse:
    return _image_response(_UPLOAD_STORIES, shop_id, filename)


@router.get("/banners/{shop_id}/{filename}")
async def get_banner_image(shop_id: UUID, filename: str) -> FileResponse:
    return _image_response(_UPLOAD_BANNERS, shop_id, filename)


def _video_response(root: Path, shop_id: UUID, filename: str, request: Request | None = None) -> FileResponse:
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = root / str(shop_id) / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Video not found")
    lowered = filename.lower()
    if lowered.endswith(".webm"):
        media = "video/webm"
    elif lowered.endswith(".mov"):
        media = "video/quicktime"
    else:
        media = "video/mp4"
    return FileResponse(
        path,
        media_type=media,
        headers=_video_extra_headers(request),
    )


@router.get("/reels/{shop_id}/{filename}")
async def get_reel_video(shop_id: UUID, filename: str, request: Request) -> FileResponse:
    return _video_response(_UPLOAD_REELS, shop_id, filename, request)


@router.get("/shops/{shop_id}/{kind}/{filename}")
async def get_shop_branding_image(shop_id: UUID, kind: str, filename: str) -> FileResponse:
    if kind not in {"logo", "cover"}:
        raise HTTPException(status_code=400, detail="Invalid kind")
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = _UPLOAD_SHOPS / str(shop_id) / kind / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    media = "image/jpeg"
    if filename.lower().endswith(".png"):
        media = "image/png"
    elif filename.lower().endswith(".webp"):
        media = "image/webp"
    return FileResponse(path, media_type=media)


@router.get("/reviews/{product_id}/{filename}")
async def get_review_image(product_id: UUID, filename: str) -> FileResponse:
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = _UPLOAD_REVIEWS / str(product_id) / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    media = "image/jpeg"
    if filename.lower().endswith(".png"):
        media = "image/png"
    elif filename.lower().endswith(".webp"):
        media = "image/webp"
    return FileResponse(path, media_type=media)
