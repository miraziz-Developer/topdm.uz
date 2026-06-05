from __future__ import annotations

import uuid

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)

from app.core.config import get_settings


def crm_url(path: str, shop_id: uuid.UUID | None = None, *, next_path: str | None = None) -> str:
    """WebApp URL — asosan /telegram kirish; next= ichki sahifa."""
    from app.infrastructure.bots.merchant_crm_links import crm_entry_url

    if path in ("/telegram", "/mini") and shop_id is not None:
        inner = "/mini" if path == "/mini" else next_path
        return crm_entry_url(shop_id, next_path=inner or next_path)
    base = get_settings().merchant_crm_webapp_url.rstrip("/")
    url = f"{base}{path}"
    if shop_id:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}shop_id={shop_id}"
    if next_path:
        sep = "&" if "?" in url else "?"
        from urllib.parse import quote

        url = f"{url}{sep}next={quote(next_path, safe='/')}"
    return url


def merchant_menu_keyboard(shop_id: uuid.UUID) -> ReplyKeyboardMarkup:
    rows: list[list[KeyboardButton]] = [
        [
            KeyboardButton(
                text="CRM Panel",
                web_app=WebAppInfo(url=crm_url("/telegram", shop_id)),
            )
        ],
        [
            KeyboardButton(
                text="Xarita / Joylashuv",
                web_app=WebAppInfo(url=crm_url("/mini", shop_id)),
            ),
        ],
        [KeyboardButton(text="Mahsulot yuklash (rasm)")],
    ]
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def start_inline_keyboard(shop_id: uuid.UUID | None) -> InlineKeyboardMarkup:
    crm_base = get_settings().merchant_crm_webapp_url.rstrip("/")
    rows: list[list[InlineKeyboardButton]] = [
        [
            InlineKeyboardButton(
                text="CRM ochish",
                web_app=WebAppInfo(url=crm_url("/telegram", shop_id)),
            ),
        ],
    ]
    if shop_id:
        rows.append(
            [
                InlineKeyboardButton(
                    text="Xarita",
                    web_app=WebAppInfo(url=crm_url("/mini", shop_id)),
                ),
            ]
        )
    rows.append([InlineKeyboardButton(text="CRM login (brauzer)", url=f"{crm_base}/login")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def contact_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="Telefon raqamini yuborish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def location_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Joylashuvni yuborish", request_location=True)],
            [KeyboardButton(text="Keyinroq (CRM xaritadan)")],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
        is_persistent=True,
    )


def market_zone_keyboard() -> ReplyKeyboardMarkup:
    from app.application.merchant.registration import MARKET_ZONE_OPTIONS

    rows = [[KeyboardButton(text=z)] for z in MARKET_ZONE_OPTIONS]
    rows.append([KeyboardButton(text="Bekor qilish")])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True, one_time_keyboard=True)
