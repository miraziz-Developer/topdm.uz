from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/media", tags=["media"])

_UPLOAD_PRODUCTS = Path(__file__).resolve().parents[3] / "uploads" / "products"
_UPLOAD_STORIES = Path(__file__).resolve().parents[3] / "uploads" / "stories"
_UPLOAD_BANNERS = Path(__file__).resolve().parents[3] / "uploads" / "banners"
_UPLOAD_REELS = Path(__file__).resolve().parents[3] / "uploads" / "reels"


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


def _video_response(root: Path, shop_id: UUID, filename: str) -> FileResponse:
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
    return FileResponse(path, media_type=media)


@router.get("/reels/{shop_id}/{filename}")
async def get_reel_video(shop_id: UUID, filename: str) -> FileResponse:
    return _video_response(_UPLOAD_REELS, shop_id, filename)
