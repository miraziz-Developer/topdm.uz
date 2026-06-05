"""Bozorliii.uz — Merchant monetizatsiya rejalari va narxlar.

NARX STRATEGIYASI (O'zbekiston bozori, early-stage startup):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ippodrom sotuvchi oylik daromadi: 5–30M so'm
Marketing xarajati tartibi:      1–3% = 50–900k so'm
Uzum/Ozon komissiya:             15–25% (bizniki esa 0-1%)

Faza 1 (hozir): MAHSULOT USTAMASI
  → Oylik obuna o'chirilgan (subscriptions_enabled=false)
  → Do'konchi bazaviy narx kiritadi; mijoz +15% ko'radi
  → To'lov split: platforma ustama + do'kon bazasi
  → Banner/boost ixtiyoriy reklama

Faza 2 (6-12 oy): DAROMAD
  → Narxlar 20-30% oshiriladi
  → Komissiya: 1% dan boshlanadi

Faza 3 (12+ oy): KENGAYTISH
  → Yangi xizmatlar (delivery, premium analytics)
  → Komissiya: 2-3%
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Final


# ─── Obuna rejalari ─────────────────────────────────────────────
@dataclass(frozen=True)
class SubscriptionPlan:
    code: str
    name_uz: str
    price_uzs_monthly: int           # oylik narx (so'm)
    price_uzs_yearly: int            # yillik narx (25% chegirma)
    max_products: int                # maksimal mahsulot soni
    max_images_per_product: int      # har bir mahsulot uchun rasm
    featured_products: int           # "Featured" ko'rsatish soni
    ai_chat_enabled: bool            # AI chat
    analytics_full: bool             # to'liq analitika
    qr_poster_enabled: bool          # QR poster
    priority_in_catalog: int         # katalogda ustunlik (1=yuqori)
    trial_days: int                  # bepul sinov davri
    description_uz: str


# Faza 1: juda keng bepul reja — maksimal merchant jalb
FREE_PLAN = SubscriptionPlan(
    code="free",
    name_uz="Bepul",
    price_uzs_monthly=0,
    price_uzs_yearly=0,
    max_products=10_000,             # Obuna yo'q — amalda cheksiz
    max_images_per_product=3,
    featured_products=0,
    ai_chat_enabled=False,
    analytics_full=False,
    qr_poster_enabled=True,          # QR bepul — tarqatish uchun
    priority_in_catalog=3,
    trial_days=0,
    description_uz="Cheksiz mahsulot. Daromad — har sotuvdan +15% ustama (mijoz narxi).",
)

# Faza 1: past narx — 59k so'm (telegram kanalda bitta post narxi)
STARTER_PLAN = SubscriptionPlan(
    code="starter",
    name_uz="Starter",
    price_uzs_monthly=59_000,        # ~6 USD — OLX premium darajasi
    price_uzs_yearly=529_000,        # ~25% chegirma (oyiga ~44k)
    max_products=100,
    max_images_per_product=6,
    featured_products=3,
    ai_chat_enabled=True,
    analytics_full=False,
    qr_poster_enabled=True,
    priority_in_catalog=2,
    trial_days=30,                   # 30 kun bepul — ishonarli sinov
    description_uz="100 mahsulot, AI chat, 3 ta featured. 30 kun bepul sinov.",
)

# Faza 1: o'rta narx — 129k so'm (oylik xarajat ehtimoli)
PRO_PLAN = SubscriptionPlan(
    code="pro",
    name_uz="Pro",
    price_uzs_monthly=129_000,       # ~13 USD — kichik biznes uchun real
    price_uzs_yearly=979_000,        # ~37% chegirma (oyiga ~82k)
    max_products=500,
    max_images_per_product=12,
    featured_products=10,
    ai_chat_enabled=True,
    analytics_full=True,
    qr_poster_enabled=True,
    priority_in_catalog=1,
    trial_days=30,
    description_uz="500 mahsulot, to'liq analitika, 10 featured, 1-o'rin katalogda. 30 kun bepul.",
)

ALL_PLANS: Final[list[SubscriptionPlan]] = [FREE_PLAN, STARTER_PLAN, PRO_PLAN]
PLAN_BY_CODE: Final[dict[str, SubscriptionPlan]] = {p.code: p for p in ALL_PLANS}


# ─── Premium banner tariflari ───────────────────────────────────
# Taqqoslash: OLX premium listing 15-50k, Telegram post 50-300k
# Biz: 30 kun ko'rish + analitika + manzil
@dataclass(frozen=True)
class BannerTariff:
    code: str
    name_uz: str
    price_uzs: int
    duration_days: int
    priority: int
    display_seconds: int
    badge: str
    roi_example: str              # merchant uchun ROI misol


BANNER_BRONZE = BannerTariff(
    "bronze", "Bronze",
    price_uzs=79_000,            # 8 USD — birinchi sinov uchun qulay
    duration_days=30,
    priority=1,
    display_seconds=4,
    badge="Bronze",
    roi_example="2-3 ta qo'shimcha mijoz = narx qoplanadi",
)

BANNER_SILVER = BannerTariff(
    "silver", "Silver",
    price_uzs=199_000,           # 20 USD — faol do'kon uchun
    duration_days=30,
    priority=2,
    display_seconds=5,
    badge="Silver",
    roi_example="5-10 ta mijoz = 2-5× ROI",
)

BANNER_GOLD = BannerTariff(
    "gold", "Gold VIP",
    price_uzs=379_000,           # 38 USD — eng yaxshi joylashuv
    duration_days=30,
    priority=3,
    display_seconds=6,
    badge="Gold VIP",
    roi_example="10-20 ta mijoz = 3-8× ROI",
)

ALL_BANNER_TARIFFS: Final = [BANNER_BRONZE, BANNER_SILVER, BANNER_GOLD]


# ─── Featured product boost ─────────────────────────────────────
# Taqqoslash: OLX "VIP" listing 5-15k, biz = qidiruv + katalog
@dataclass(frozen=True)
class BoostPackage:
    code: str
    name_uz: str
    price_uzs: int
    duration_days: int
    description_uz: str


BOOST_3DAY  = BoostPackage("boost_3",  "3 kunlik sinov",  9_900,  3,  "3 kun birinchi qatorda — sinov uchun")
BOOST_WEEK  = BoostPackage("boost_7",  "Haftalik boost",  19_900, 7,  "7 kun birinchi qatorda")
BOOST_MONTH = BoostPackage("boost_30", "Oylik boost",     59_000, 30, "30 kun birinchi qatorda — eng tejamli")
ALL_BOOSTS: Final = [BOOST_3DAY, BOOST_WEEK, BOOST_MONTH]


# ─── Komissiya ──────────────────────────────────────────────────
# Faza 1: 0% — merchant ishonadigan qilish uchun
# Faza 2 (6 oy keyin): 1%
# Faza 3 (12 oy keyin): 2%
# Uzum: 15-25% — bizning ustunlik shu (minimal komissiya)
COMMISSION_RATE_PCT: Final = 0      # Eski % model; asosiy daromad = product markup
COMMISSION_PHASE2_PCT: Final = 1.0  # 6 oydan keyin
COMMISSION_PHASE3_PCT: Final = 2.0  # 12 oydan keyin


# ─── Coin kursi ─────────────────────────────────────────────────
COIN_UZS_RATE: Final = 1_000   # 1 Coin = 1,000 so'm (oddiyroq hisob)
