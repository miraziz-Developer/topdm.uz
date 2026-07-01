"""CRM AI support FAQ knowledge base."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

revision = "0048_merchant_support_faq"
down_revision = "0047_shop_ai_verification"
branch_labels = None
depends_on = None

_DEFAULT_FAQ = [
    (
        "mahsulot",
        "Mahsulot qanday qo'shaman?",
        "CRM → Mahsulotlar → «Yangi mahsulot». Rasm, nom, narx va kategoriya kiriting. AI moderator tekshiradi — odatda 1–2 daqiqa. Telegram botda ham rasm yuborib qo'shish mumkin.",
        "mahsulot qo'shish, yangi, chop etish, rasm",
    ),
    (
        "mahsulot",
        "Mahsulotim rad etildi — nima qilaman?",
        "Rad sababi xabarda ko'rsatiladi. Rasm sifatini yaxshilang, narxni bozor narxiga moslang, to'g'ri kategoriya tanlang va qayta yuboring. Ichki kiyim vitrinada ruxsat — faqat erotika/porno taqiqlangan.",
        "rad, moderator, ai, rad etildi",
    ),
    (
        "banner",
        "Bosh sahifada reklama (banner) qanday qo'yaman?",
        "CRM → Kontent → Bannerlar. Tarif tanlang (Bronze/Silver/Gold), muddat (kun), rasm yuklang va «Reklamani chop etish» bosing. Balansdan coin yechiladi (1 coin = 1000 so'm).",
        "banner, reklama, karusel, gold, vip",
    ),
    (
        "balans",
        "Coin balansni qanday to'ldiraman?",
        "CRM → Do'kon yoki Billing bo'limida «Balansni to'ldirish». Coin paketlarini tanlang va to'lovni yakunlang. Banner va boost xizmatlari uchun ishlatiladi.",
        "coin, balans, to'ldirish, to'lov",
    ),
    (
        "buyurtma",
        "Buyurtmani qanday qabul qilaman?",
        "CRM → Savdo bo'limida yangi buyurtmalar ko'rinadi. Telegram botda ham bildirishnoma keladi. Mahsulotni tayyorlang va mijoz kelganda QR skaner orqali topshiring.",
        "buyurtma, qabul, savdo, yangi",
    ),
    (
        "buyurtma",
        "QR skaner qanday ishlaydi?",
        "Mijoz kelganda CRM yoki Telegram botdagi «QR Skaner» tugmasini bosing va mijoz ekranidagi QR kodni skanerlang. Faqat shu orqali «olib ketildi» deb belgilanadi.",
        "qr, skaner, olib ketish, yakunlash",
    ),
    (
        "chat",
        "Mijoz bilan qanday yozishaman?",
        "CRM → Chat bo'limida jonli suhbatlar. Mijoz saytdan yoki ilovadan yozganda xabar shu yerda chiqadi. Tez javoblar (quick reply) ham mavjud.",
        "chat, mijoz, yozishma, suhbat",
    ),
    (
        "do'kon",
        "Do'konim qachon saytda ko'rinadi?",
        "Ro'yxatdan o'tgandan keyin AI do'kon profilingizni tekshiradi. Tasdiqlangach do'kon bozorliii.uz da ochiladi. Rad bo'lsa sababni tuzating va qayta yuboring.",
        "do'kon, ro'yxat, tasdiq, ko'rinish",
    ),
    (
        "yetkazish",
        "Yetkazib berish bormi?",
        "Hozir asosiy model — mijoz bozorga kelib olib ketadi (pickup). Yetkazish integratsiyasi alohida yoqiladi. Buyurtma turini CRM da ko'ring.",
        "yetkazish, delivery, olib ketish",
    ),
    (
        "to'lov",
        "Onlayn to'lov (Click/Payme) ishlaydimi?",
        "Onlayn to'lov bosqichma-bosqich yoqilmoqda. Hozir ko'p hollarda mijoz do'konda naqd yoki terminal orqali to'laydi. CRM da to'lov holatini kuzating.",
        "click, payme, onlayn, to'lov",
    ),
    (
        "crm",
        "CRM ga qanday kiraman?",
        "Telegram bot orqali kirish yoki crm.bozorliii.online saytida telefon/email bilan OTP. Do'kon egasi hisobingiz bilan bog'langan bo'lishi kerak.",
        "crm, kirish, login, parol",
    ),
    (
        "umumiy",
        "Texnik muammo — sayt ishlamayapti",
        "Sahifani yangilang (Ctrl+R), boshqa brauzer sinab ko'ring. Muammo davom etsa, qaysi bo'lim va xato matnini yozing — admin bilan bog'laning.",
        "xato, ishlamayapti, 500, muammo",
    ),
]


def upgrade() -> None:
    op.create_table(
        "merchant_support_faq",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("topic", sa.String(64), nullable=False, server_default="umumiy"),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("keywords", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_merchant_support_faq_topic", "merchant_support_faq", ["topic"])
    op.create_index("ix_merchant_support_faq_active", "merchant_support_faq", ["is_active"])

    faq_table = sa.table(
        "merchant_support_faq",
        sa.column("id", postgresql.UUID),
        sa.column("topic", sa.String),
        sa.column("question", sa.Text),
        sa.column("answer", sa.Text),
        sa.column("keywords", sa.Text),
        sa.column("sort_order", sa.Integer),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(
        faq_table,
        [
            {
                "id": uuid.uuid4(),
                "topic": topic,
                "question": question,
                "answer": answer,
                "keywords": keywords,
                "sort_order": idx * 10,
                "is_active": True,
            }
            for idx, (topic, question, answer, keywords) in enumerate(_DEFAULT_FAQ)
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_merchant_support_faq_active", table_name="merchant_support_faq")
    op.drop_index("ix_merchant_support_faq_topic", table_name="merchant_support_faq")
    op.drop_table("merchant_support_faq")
