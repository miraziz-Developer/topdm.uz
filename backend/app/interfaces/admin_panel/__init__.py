"""SQLAdmin web panel — faqat platforma egasi uchun (Django-admin uslubida).

Bu panel barcha jadvallarni ko'rish/analiz qilish va platforma foydasini
(profit sweep) boshqarish uchun. Moliyaviy jadvallar read-only — escrow
yaxlitligi buzilmasligi uchun; foyda sweep amaliyotlari maxsus sahifada
PlatformProfitService orqali bajariladi.
"""
from app.interfaces.admin_panel.setup import setup_admin_panel

__all__ = ["setup_admin_panel"]
