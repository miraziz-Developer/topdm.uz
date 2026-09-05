#!/usr/bin/env python3
"""Bozorliii do'konchilar qo'llanmasini A4 PDF ko'rinishida yaratadi.

Ishga tushirish:
    python3 scripts/generate_merchant_guide.py

Natija:
    docs/BOZORLIII_DOKONCHILAR_UCHUN.pdf
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "BOZORLIII_DOKONCHILAR_UCHUN.pdf"
LOGO = ROOT / "brand" / "assets" / "bozorliii-full-logo.png"
REGISTER_QR = ROOT / "docs" / "assets" / "bozorliii-merchant-register-qr.png"

W, H = 1240, 1754
M = 92
BLUE = "#1857D6"
PURPLE = "#7A3FE0"
ORANGE = "#FF5A00"
INK = "#111827"
MUTED = "#64748B"
WHITE = "#FFFFFF"
GREEN = "#16A36A"

FONT_REGULAR = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size)


def rounded(draw: ImageDraw.ImageDraw, box, radius=28, fill=WHITE, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def fit_logo(max_width: int = 360) -> Image.Image:
    logo = Image.open(LOGO).convert("RGBA")
    bbox = logo.getbbox()
    logo = logo.crop(bbox)
    ratio = max_width / logo.width
    return logo.resize((max_width, int(logo.height * ratio)), Image.Resampling.LANCZOS)


def paste_logo(page: Image.Image, x: int, y: int, width: int = 330):
    logo = fit_logo(width)
    page.alpha_composite(logo, (x, y))


def line_height(f: ImageFont.FreeTypeFont, spacing: int = 12) -> int:
    box = f.getbbox("Ag")
    return box[3] - box[1] + spacing


def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    result: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            result.append("")
            continue
        words = paragraph.split()
        line = ""
        for word in words:
            candidate = f"{line} {word}".strip()
            if draw.textlength(candidate, font=f) <= max_width:
                line = candidate
            else:
                if line:
                    result.append(line)
                line = word
        if line:
            result.append(line)
    return result


def text_block(draw, xy, text, f, fill=INK, max_width=900, spacing=12, anchor=None):
    x, y = xy
    lines = wrap(draw, text, f, max_width)
    step = line_height(f, spacing)
    for line in lines:
        draw.text((x, y), line, font=f, fill=fill, anchor=anchor)
        y += step
    return y


def page_base(number: int, dark: bool = False) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    bg = "#10162A" if dark else "#F8FAFE"
    page = Image.new("RGBA", (W, H), bg)
    draw = ImageDraw.Draw(page)
    if not dark:
        draw.ellipse((900, -200, 1400, 300), fill="#EBF0FF")
        draw.ellipse((-240, 1440, 240, 1920), fill="#FFF0E8")
    draw.text((W - M, H - 55), f"{number} / 7", font=font(22, True), fill="#94A3B8", anchor="ra")
    return page, draw


def topbar(page, draw, number: int, kicker: str):
    paste_logo(page, M, 54, 260)
    draw.text((W - M, 82), kicker.upper(), font=font(20, True), fill=BLUE, anchor="ra")
    draw.line((M, 145, W - M, 145), fill="#DDE4F0", width=2)


def title(draw, text: str, y: int, subtitle: str | None = None):
    y = text_block(draw, (M, y), text, font(58, True), INK, W - 2 * M, 9)
    if subtitle:
        y += 18
        y = text_block(draw, (M, y), subtitle, font(29), MUTED, W - 2 * M, 10)
    return y


def icon_circle(draw, center, label, color=BLUE, radius=42):
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    draw.text((x, y - 1), label, font=font(32, True), fill=WHITE, anchor="mm")


def benefit_card(draw, x, y, width, heading, body, symbol, color):
    rounded(draw, (x, y, x + width, y + 255), 30, WHITE, "#E0E7F2", 2)
    icon_circle(draw, (x + 70, y + 66), symbol, color, 36)
    draw.text((x + 126, y + 43), heading, font=font(29, True), fill=INK)
    text_block(draw, (x + 36, y + 125), body, font(23), MUTED, width - 72, 9)


def phone_mockup(page, x, y, width=470, height=890):
    draw = ImageDraw.Draw(page)
    rounded(draw, (x, y, x + width, y + height), 58, "#121827")
    rounded(draw, (x + 17, y + 17, x + width - 17, y + height - 17), 43, "#F8FAFE")
    rounded(draw, (x + width // 2 - 75, y + 16, x + width // 2 + 75, y + 45), 16, "#121827")
    paste_logo(page, x + 56, y + 75, 250)
    draw.text((x + 42, y + 180), "Assalomu alaykum!", font=font(30, True), fill=INK)
    draw.text((x + 42, y + 223), "Bugungi savdo holati", font=font(21), fill=MUTED)
    rounded(draw, (x + 38, y + 285, x + width - 38, y + 430), 24, BLUE)
    draw.text((x + 66, y + 316), "Yangi buyurtma", font=font(22), fill="#DDE8FF")
    draw.text((x + 66, y + 356), "3 ta", font=font(46, True), fill=WHITE)
    for i, (name, value, color) in enumerate([
        ("Mahsulotlar", "128", PURPLE), ("Ko'rishlar", "1 240", ORANGE), ("Xabarlar", "7", GREEN)
    ]):
        yy = y + 465 + i * 112
        rounded(draw, (x + 38, yy, x + width - 38, yy + 88), 20, WHITE, "#E1E7F0", 2)
        draw.ellipse((x + 58, yy + 24, x + 98, yy + 64), fill=color)
        draw.text((x + 118, yy + 24), name, font=font(21, True), fill=INK)
        draw.text((x + width - 64, yy + 25), value, font=font(24, True), fill=color, anchor="ra")


def qr_image(size: int = 330) -> Image.Image:
    if not REGISTER_QR.exists():
        raise RuntimeError(f"Ro'yxatdan o'tish QR kodi topilmadi: {REGISTER_QR}")
    return Image.open(REGISTER_QR).convert("RGB").resize((size, size), Image.Resampling.NEAREST)


def cover() -> Image.Image:
    page, draw = page_base(1, dark=True)
    # Decorative glow layers.
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((720, -180, 1500, 600), fill=(24, 87, 214, 145))
    gd.ellipse((-350, 1150, 500, 2050), fill=(122, 63, 224, 105))
    glow = glow.filter(ImageFilter.GaussianBlur(95))
    page.alpha_composite(glow)
    draw = ImageDraw.Draw(page)
    paste_logo(page, M, 70, 330)
    rounded(draw, (M, 265, M + 365, 324), 29, "#243A70")
    draw.text((M + 182, 295), "DO'KONCHILAR UCHUN", font=font(20, True), fill="#DCE7FF", anchor="mm")
    y = text_block(draw, (M, 385), "Do'koningiz\ninternetda ham\nishlasin", font(73, True), WHITE, 670, 6)
    y += 25
    text_block(
        draw, (M, y),
        "Mahsulotlaringizni ko'rsating, buyurtma oling va barcha ishni telefoningizdan boshqaring.",
        font(30), "#C7D2E8", 640, 11,
    )
    phone_mockup(page, 730, 365, 405, 800)
    rounded(draw, (M, 1370, W - M, 1535), 32, "#FFFFFF")
    draw.text((M + 42, 1412), "Oddiy telefonning o'zi yetadi", font=font(33, True), fill=INK)
    draw.text((M + 42, 1464), "Ro'yxatdan o'tishda ham o'zimiz yordam beramiz.", font=font(24), fill=MUTED)
    draw.text((M, 1630), "bozorliii.online", font=font(25, True), fill="#91B3FF")
    return page


def benefits() -> Image.Image:
    page, draw = page_base(2)
    topbar(page, draw, 2, "Sizga qanday foyda?")
    title(draw, "Bozorliii sizga nima beradi?", 210, "Do'koningiz uchun kerakli imkoniyatlar — bitta joyda.")
    gap, cw = 28, (W - 2 * M - 28) // 2
    cards = [
        ("Ko'proq xaridor", "Mahsulotingiz internetda ko'rinadi. Sizni hali tanimagan odamlar ham topadi.", "1", BLUE),
        ("Yangi buyurtmalar", "Buyurtma kelishi bilan xabar olasiz, tasdiqlaysiz va mahsulotni tayyorlaysiz.", "2", ORANGE),
        ("Do'konni oson topish", "Xaridor xarita va do'kon ma'lumotlari orqali sizning oldingizga keladi.", "3", PURPLE),
        ("Vaqt tejaladi", "Har bir mijozga alohida rasm va narx yubormaysiz. Hammasi sahifangizda turadi.", "4", GREEN),
    ]
    for i, card in enumerate(cards):
        benefit_card(draw, M + (i % 2) * (cw + gap), 520 + (i // 2) * 290, cw, *card)
    rounded(draw, (M, 1160, W - M, 1470), 34, "#EAF0FF")
    draw.text((M + 44, 1205), "Qisqasi", font=font(25, True), fill=BLUE)
    text_block(draw, (M + 44, 1260), "Siz savdo bilan shug'ullanasiz. Bozorliii esa mahsulotingizni ko'rsatish, buyurtmani tartibga solish va xaridorga yo'l topishda yordam beradi.", font(34, True), INK, W - 2 * M - 88, 12)
    return page


def steps() -> Image.Image:
    page, draw = page_base(3)
    topbar(page, draw, 3, "Boshlash tartibi")
    title(draw, "Boshlash juda oson", 210, "Do'koningizni ishga tushirish uchun 4 ta sodda qadam.")
    items = [
        ("1", "Botga yozing", "@Bozorliiicrm_bot ni oching va /register tugmasini bosing."),
        ("2", "Ma'lumot yuboring", "Do'kon nomi, telefon va joylashuvni kiriting. Jarayon taxminan 3 daqiqa."),
        ("3", "Tasdiqni kuting", "Moderator ma'lumotlarni tekshiradi. Tasdiqlangach CRM login va parol keladi."),
        ("4", "Mahsulot qo'shing", "Rasm, nom va narxni kiriting. Shundan keyin do'koningiz xaridorlarga ko'rinadi."),
    ]
    y = 500
    for num, heading, body in items:
        icon_circle(draw, (M + 55, y + 65), num, BLUE if num in {"1", "3"} else PURPLE, 48)
        draw.text((M + 135, y + 15), heading, font=font(31, True), fill=INK)
        text_block(draw, (M + 135, y + 66), body, font(23), MUTED, W - 2 * M - 160, 8)
        if num != "4":
            draw.line((M + 55, y + 118, M + 55, y + 205), fill="#C8D4EA", width=5)
        y += 230
    rounded(draw, (M, 1450, W - M, 1572), 26, "#FFF0E8")
    draw.text((W // 2, 1512), "Texnik bilim shart emas — oddiy telefon yetadi.", font=font(27, True), fill="#B84000", anchor="mm")
    return page


def crm() -> Image.Image:
    page, draw = page_base(4)
    topbar(page, draw, 4, "Telefoningizdagi yordamchi")
    title(draw, "Barcha ish telefoningizda", 210, "CRM — bu do'koningizning sodda boshqaruv paneli.")
    phone_mockup(page, M, 470, 455, 870)
    features = [
        ("Mahsulot qo'shing", "Rasm, narx va qoldiqni yangilang."),
        ("Buyurtmani ko'ring", "Qabul qiling, tayyorlang yoki sabab bilan rad eting."),
        ("Xaridorga yozing", "Savollarga chat orqali javob bering."),
        ("Natijani biling", "Ko'rishlar, buyurtmalar va savdoni kuzating."),
        ("Aksiya yarating", "Chegirma, story va video bilan e'tibor torting."),
    ]
    y = 500
    for i, (heading, body) in enumerate(features, 1):
        rounded(draw, (610, y, W - M, y + 150), 25, WHITE, "#E0E7F2", 2)
        icon_circle(draw, (657, y + 48), str(i), [BLUE, ORANGE, PURPLE, GREEN, BLUE][i - 1], 30)
        draw.text((705, y + 26), heading, font=font(25, True), fill=INK)
        text_block(draw, (705, y + 68), body, font(20), MUTED, 390, 5)
        y += 170
    return page


def orders() -> Image.Image:
    page, draw = page_base(5)
    topbar(page, draw, 5, "Buyurtma qanday ishlaydi?")
    title(draw, "Buyurtma kelganda nima qilasiz?", 210, "Har bir bosqich tushunarli va tartibli.")
    stages = [
        ("01", "Xabar keladi", "Bot va CRM yangi buyurtma haqida xabar beradi.", BLUE),
        ("02", "Tasdiqlaysiz", "Mahsulot borligini tekshirib, buyurtmani qabul qilasiz.", PURPLE),
        ("03", "Tayyorlaysiz", "Mahsulotni ajratib qo'yasiz va «Tayyor» tugmasini bosasiz.", ORANGE),
        ("04", "Topshirasiz", "Xaridorning QR kodini skanerlab buyurtmani yakunlaysiz.", GREEN),
    ]
    y = 505
    for num, heading, body, color in stages:
        rounded(draw, (M, y, W - M, y + 205), 32, WHITE, "#E1E7F0", 2)
        rounded(draw, (M + 30, y + 30, M + 150, y + 175), 25, color)
        draw.text((M + 90, y + 102), num, font=font(35, True), fill=WHITE, anchor="mm")
        draw.text((M + 195, y + 44), heading, font=font(31, True), fill=INK)
        text_block(draw, (M + 195, y + 98), body, font(23), MUTED, 760, 8)
        y += 235
    rounded(draw, (M, 1480, W - M, 1588), 25, "#E8F8F1")
    draw.text((W // 2, 1534), "Natija: buyurtma yo'qolmaydi, xaridor ham kutib qolmaydi.", font=font(25, True), fill="#087A4D", anchor="mm")
    return page


def faq() -> Image.Image:
    page, draw = page_base(6)
    topbar(page, draw, 6, "Ko'p so'raladigan savollar")
    title(draw, "Savolingiz bormi?", 210, "Eng muhim javoblarni bir joyga jamladik.")
    questions = [
        ("Kompyuter kerakmi?", "Yo'q. Android yoki iPhone orqali ishlashingiz mumkin."),
        ("Mahsulot qo'shish qiyinmi?", "Yo'q. Rasmga olasiz, nomi va narxini yozasiz. Bot ham yordam beradi."),
        ("Buyurtmani qanday bilaman?", "Telegram bot va CRM orqali darhol xabar olasiz."),
        ("Narx yoki qoldiqni o'zgartirsam bo'ladimi?", "Ha. Istalgan vaqtda telefoningizdan yangilaysiz."),
        ("Qancha turadi?", "Ro'yxatdan o'tish va asosiy reja bepul. Qo'shimcha reklama xizmatlari ixtiyoriy; amaldagi shartlarni bot orqali aniqlang."),
        ("Kimdir yordam beradimi?", "Ha. Ro'yxatdan o'tish va birinchi mahsulotlarni joylashda yordam beramiz."),
    ]
    y = 470
    for i, (q, a) in enumerate(questions):
        color = BLUE if i % 2 == 0 else PURPLE
        draw.ellipse((M, y + 5, M + 42, y + 47), fill=color)
        draw.text((M + 21, y + 26), "?", font=font(23, True), fill=WHITE, anchor="mm")
        draw.text((M + 65, y), q, font=font(25, True), fill=INK)
        text_block(draw, (M + 65, y + 44), a, font(21), MUTED, W - 2 * M - 65, 6)
        y += 170 if i == 4 else 145
    return page


def cta() -> Image.Image:
    page, draw = page_base(7, dark=True)
    paste_logo(page, M, 70, 330)
    draw.text((W - M, 105), "BIRINCHI QADAM", font=font(20, True), fill="#91B3FF", anchor="ra")
    draw.text((W // 2, 330), "Do'koningizni bugun", font=font(58, True), fill=WHITE, anchor="mm")
    draw.text((W // 2, 405), "Bozorliii'ga qo'shing", font=font(62, True), fill="#91B3FF", anchor="mm")
    text_block(draw, (W // 2, 500), "QR kodni skanerlang, botni oching va /register tugmasini bosing.", font(29), "#C7D2E8", 820, 10, "ma")
    qr = qr_image(390)
    qr_canvas = Image.new("RGBA", (450, 450), WHITE)
    qr_canvas.alpha_composite(qr.convert("RGBA"), (30, 30))
    mask = Image.new("L", qr_canvas.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 449, 449), 35, fill=255)
    page.paste(qr_canvas, (W // 2 - 225, 680), mask)
    draw = ImageDraw.Draw(page)
    rounded(draw, (330, 1180, W - 330, 1275), 45, BLUE)
    draw.text((W // 2, 1228), "@Bozorliiicrm_bot", font=font(31, True), fill=WHITE, anchor="mm")
    draw.text((W // 2, 1370), "Sayt: bozorliii.online", font=font(26, True), fill=WHITE, anchor="mm")
    draw.text((W // 2, 1420), "Boshqaruv: crm.bozorliii.online", font=font(24), fill="#C7D2E8", anchor="mm")
    rounded(draw, (M, 1530, W - M, 1630), 25, "#222D48")
    draw.text((W // 2, 1580), "Ro'yxatdan o'tish va mahsulot joylashda yordam beramiz.", font=font(25, True), fill="#E5ECFA", anchor="mm")
    return page


def main() -> None:
    pages = [cover(), benefits(), steps(), crm(), orders(), faq(), cta()]
    rgb_pages = [page.convert("RGB") for page in pages]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    rgb_pages[0].save(
        OUTPUT,
        "PDF",
        resolution=150.0,
        save_all=True,
        append_images=rgb_pages[1:],
        quality=92,
        optimize=True,
    )
    print(f"Yaratildi: {OUTPUT}")
    print(f"Sahifalar: {len(pages)}")


if __name__ == "__main__":
    main()