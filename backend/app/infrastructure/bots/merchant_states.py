from __future__ import annotations

from aiogram.fsm.state import State, StatesGroup


class MerchantBotStates(StatesGroup):
    waiting_contact = State()
    ready = State()

    reg_name = State()
    reg_market = State()
    reg_block = State()
    reg_stall = State()
    reg_location_comment = State()
    reg_location = State()
    reg_storefront = State()
    reg_contact = State()
    reg_confirm = State()

    product_edit_name = State()
    product_edit_price = State()
