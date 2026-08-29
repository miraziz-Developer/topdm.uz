from __future__ import annotations

from aiogram.fsm.state import State, StatesGroup


class CustomerBotStates(StatesGroup):
    # Telefon tasdiqlash — kontakt ulashish kutilmoqda
    verify_contact = State()
