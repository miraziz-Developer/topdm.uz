import type { Locale } from "@/i18n/messages";

export type HomeMessageKey =
  | "home.hero.eyebrow"
  | "home.hero.titleLine1"
  | "home.hero.titleLine2"
  | "home.hero.subtitle"
  | "home.stories.eyebrow"
  | "home.stories.title"
  | "home.stories.description"
  | "home.stories.descriptionPromo"
  | "home.stories.empty"
  | "home.stories.liveBadge"
  | "home.stories.promoBadge"
  | "home.stories.scrollHint"
  | "home.stories.wowwDock"
  | "home.premiumBanners.eyebrow"
  | "home.premiumBanners.title"
  | "home.premiumBanners.description"
  | "home.premiumBanners.sponsored"
  | "home.premiumBanners.prev"
  | "home.premiumBanners.next"
  | "home.merchant.eyebrow"
  | "home.merchant.title"
  | "home.merchant.description"
  | "home.discovery.eyebrow"
  | "home.discovery.titleStylist"
  | "home.discovery.descStylist"
  | "home.discovery.titleWholesale"
  | "home.discovery.descWholesale"
  | "home.discovery.noResults"
  | "home.sale.modeLabel"
  | "home.sale.chakana"
  | "home.sale.optom"
  | "home.sale.china"
  | "home.discovery.noChinaResults"
  | "home.china.searchLabel"
  | "home.china.searchPlaceholder"
  | "home.china.importBtn"
  | "home.china.importError"
  | "home.china.apiMissing"
  | "home.china.partialErrors"
  | "home.filter.market"
  | "home.filter.block"
  | "home.filter.category"
  | "home.filter.minPrice"
  | "home.filter.maxPrice"
  | "home.filter.allZones"
  | "home.filter.allBlocks"
  | "home.filter.allCategories"
  | "home.visual.dragHint"
  | "home.visual.tapHint"
  | "home.visual.listening"
  | "home.pin.save"
  | "home.pin.saved"
  | "home.pin.cart"
  | "home.pin.band"
  | "home.pin.productFallback"
  | "home.pin.optomMin"
  | "home.pin.groupPrice"
  | "home.trust.aria"
  | "home.trust.pricing.title"
  | "home.trust.pricing.desc"
  | "home.trust.direct.title"
  | "home.trust.direct.desc"
  | "home.trust.stylist.title"
  | "home.trust.stylist.desc"
  | "home.trust.stylist.cta";

const uz: Record<HomeMessageKey, string> = {
  "home.hero.eyebrow": "AI Visual Search",
  "home.hero.titleLine1": "Rasm tashlang,",
  "home.hero.titleLine2": "Ippodrom topilsin",
  "home.hero.subtitle":
    "Ippodrom va Abu Saxiy bozorlaridagi real do'konlar katalogidan eng mos variantlarni aqlli algoritm yordamida bir zumda ajratib beradi.",
  "home.stories.eyebrow": "Jonli oqim",
  "home.stories.title": "Hozir Ippodromda nima trend?",
  "home.stories.description": "Sotuvchilar yuborgan jonli storylar — 48 soat ko'rinadi.",
  "home.stories.descriptionPromo": "Hozircha do'kon storylari yo'q — platforma reklamalari ko'rsatilmoqda.",
  "home.stories.empty": "Hozircha jonli storylar yo'q. Tez orada sotuvchilar yangi kiyimlar bilan chiqadi.",
  "home.stories.liveBadge": "JONLI",
  "home.stories.promoBadge": "REKLAMA",
  "home.stories.scrollHint": "Ko'proq story uchun chapga-o'ngga suring",
  "home.stories.wowwDock": "Woww Live",
  "home.premiumBanners.eyebrow": "Premium reklama",
  "home.premiumBanners.title": "Sponsorlangan do'konlar",
  "home.premiumBanners.description":
    "Bronze, Silver va Gold tariflar — bozordagi eng trend do'konlar premium bannerlarida.",
  "home.premiumBanners.sponsored": "Sponsor",
  "home.premiumBanners.prev": "Oldingi banner",
  "home.premiumBanners.next": "Keyingi banner",
  "home.merchant.eyebrow": "Ishonchli sotuvchilar",
  "home.merchant.title": "Haftaning eng ishonchli do'konlari",
  "home.merchant.description": "Tasdiqlangan sotuvchilar — manzil, reyting va eng ko'p sotilgan kiyimlar.",
  "home.discovery.eyebrow": "Trendlar",
  "home.discovery.titleStylist": "Sizga mos trendlar",
  "home.discovery.descStylist":
    "Ippodrom va Abu Saxiy do'konlarining eng so'nggi va ommabop mahsulotlari katalogi.",
  "home.discovery.titleWholesale": "Ulgurji katalog oqimi",
  "home.discovery.descWholesale":
    "Ippodrom va Abu Saxiy do'konlaridan optom partiyalar — minimal buyurtma va bozor filtri bilan.",
  "home.discovery.noResults":
    "Tanlangan filtrlar bo'yicha mahsulot topilmadi. Bozor hududini yoki narx diapazonini yumshating.",
  "home.sale.modeLabel": "Savdo rejimi",
  "home.sale.chakana": "Chakana (Dona)",
  "home.sale.optom": "Ulgurji (Optom)",
  "home.sale.china": "Xitoydan tovarlar",
  "home.discovery.noChinaResults": "Xitoy tovarlari topilmadi. Taobao ID yoki havola kiriting.",
  "home.china.searchLabel": "Taobao ID orqali import",
  "home.china.searchPlaceholder": "690885025678 yoki taobao.com/...?id=",
  "home.china.importBtn": "Import",
  "home.china.importError": "Tovar import qilinmadi — ID yoki API kalitini tekshiring",
  "home.china.apiMissing": "RAPIDAPI_KEY sozlanmagan — backend .env faylini to'ldiring",
  "home.china.partialErrors": "Ba'zi tovarlar yuklanmadi",
  "home.filter.market": "Bozor hududi",
  "home.filter.block": "Sektor / Blok",
  "home.filter.category": "Kategoriya",
  "home.filter.minPrice": "Min narx (so'm)",
  "home.filter.maxPrice": "Max narx (so'm)",
  "home.filter.allZones": "Hammasi",
  "home.filter.allBlocks": "Barcha bloklar",
  "home.filter.allCategories": "Barcha kategoriyalar",
  "home.visual.dragHint": "Rasmni shu yerga torting",
  "home.visual.tapHint": "yoki bosing",
  "home.visual.listening": "Tinglanmoqda…",
  "home.pin.save": "Saqlash",
  "home.pin.saved": "Saqlangan",
  "home.pin.cart": "Savatcha",
  "home.pin.band": "Band",
  "home.pin.productFallback": "Mahsulot",
  "home.pin.optomMin": "Optom · min {qty}",
  "home.pin.groupPrice": "Optom narx",
  "home.trust.aria": "Ishonch va xizmat afzalliklari",
  "home.trust.pricing.title": "Real Narx Kafolati",
  "home.trust.pricing.desc":
    "Ippodrom va Abu Saxiy do'konlarining joylashuvi va eng so'nggi optom/chakana narxlari 100% tekshirilgan.",
  "home.trust.direct.title": "Sotuvchi bilan To'g'ridan-to'g'ri Aloqa",
  "home.trust.direct.desc":
    "Vositachilarsiz, do'kon egasining o'zi bilan bitta tugma orqali Telegram yoki telefon orqali tezkor buyurtma berish.",
  "home.trust.stylist.title": "Shaxsiy AI Stilist",
  "home.trust.stylist.desc":
    "Kiyim qidirishga vaqt sarflamang. Rasm bering, aqlli algoritm 30 soniyada unga mos kombinatsiyani tayyorlab beradi.",
  "home.trust.stylist.cta": "Stilistni ochish →",
};

const ru: Record<HomeMessageKey, string> = {
  "home.hero.eyebrow": "AI визуальный поиск",
  "home.hero.titleLine1": "Загрузите фото,",
  "home.hero.titleLine2": "найдите Ипподром",
  "home.hero.subtitle":
    "Из реального каталога магазинов на Ипподроме и Абу Сахий умный алгоритм мгновенно подберёт лучшие варианты.",
  "home.stories.eyebrow": "Живая лента",
  "home.stories.title": "Что сейчас в тренде на Ипподроме?",
  "home.stories.description": "Живые сторис от продавцов — обновляются в течение 24 часов.",
  "home.stories.descriptionPromo": "Пока нет сторис магазинов — показываем рекламу платформы.",
  "home.stories.empty": "Пока нет живых сторис. Скоро продавцы добавят новые образы.",
  "home.stories.liveBadge": "В ЭФИРЕ",
  "home.stories.promoBadge": "РЕКЛАМА",
  "home.stories.scrollHint": "Проведите влево/вправо, чтобы увидеть больше",
  "home.stories.wowwDock": "Woww Live",
  "home.premiumBanners.eyebrow": "Премиум реклама",
  "home.premiumBanners.title": "Спонсорские магазины",
  "home.premiumBanners.description":
    "Тарифы Bronze, Silver и Gold — самые трендовые магазины на рынке в премиум-баннерах.",
  "home.premiumBanners.sponsored": "Спонсор",
  "home.premiumBanners.prev": "Предыдущий баннер",
  "home.premiumBanners.next": "Следующий баннер",
  "home.merchant.eyebrow": "Надёжные продавцы",
  "home.merchant.title": "Самые надёжные магазины недели",
  "home.merchant.description": "Проверенные продавцы — адрес, рейтинг и хиты продаж.",
  "home.discovery.eyebrow": "Тренды",
  "home.discovery.titleStylist": "Тренды для вас",
  "home.discovery.descStylist":
    "Каталог последних и популярных товаров магазинов Ипподрома и Абу Сахий.",
  "home.discovery.titleWholesale": "Оптовый каталог",
  "home.discovery.descWholesale":
    "Оптовые партии с Ипподрома и Абу Сахий — минимальный заказ и фильтр по рынку.",
  "home.discovery.noResults":
    "По выбранным фильтрам товаров нет. Смягчите зону рынка или диапазон цен.",
  "home.sale.modeLabel": "Режим продаж",
  "home.sale.chakana": "В розницу",
  "home.sale.optom": "Оптом",
  "home.sale.china": "Товары из Китая",
  "home.discovery.noChinaResults": "Товары из Китая не найдены. Введите Taobao ID или ссылку.",
  "home.china.searchLabel": "Импорт по Taobao ID",
  "home.china.searchPlaceholder": "690885025678 или taobao.com/...?id=",
  "home.china.importBtn": "Импорт",
  "home.china.importError": "Не удалось импортировать — проверьте ID или API ключ",
  "home.china.apiMissing": "RAPIDAPI_KEY не настроен — заполните backend .env",
  "home.china.partialErrors": "Некоторые товары не загрузились",
  "home.filter.market": "Рынок",
  "home.filter.block": "Сектор / Блок",
  "home.filter.category": "Категория",
  "home.filter.minPrice": "Мин. цена (сум)",
  "home.filter.maxPrice": "Макс. цена (сум)",
  "home.filter.allZones": "Все",
  "home.filter.allBlocks": "Все блоки",
  "home.filter.allCategories": "Все категории",
  "home.visual.dragHint": "Перетащите фото сюда",
  "home.visual.tapHint": "или нажмите",
  "home.visual.listening": "Слушаю…",
  "home.pin.save": "Сохранить",
  "home.pin.saved": "Сохранено",
  "home.pin.cart": "В корзину",
  "home.pin.band": "Забронировать",
  "home.pin.productFallback": "Товар",
  "home.pin.optomMin": "Опт · от {qty} шт",
  "home.pin.groupPrice": "Оптовая цена",
  "home.trust.aria": "Преимущества и доверие",
  "home.trust.pricing.title": "Гарантия реальной цены",
  "home.trust.pricing.desc":
    "Локации магазинов на Ипподроме и Абу Сахий и актуальные оптовые/розничные цены проверены на 100%.",
  "home.trust.direct.title": "Прямой контакт с продавцом",
  "home.trust.direct.desc":
    "Без посредников — заказ в Telegram или по телефону владельцу магазина в один клик.",
  "home.trust.stylist.title": "Персональный AI-стилист",
  "home.trust.stylist.desc":
    "Не тратьте время на поиск. Загрузите фото — алгоритм за 30 секунд соберёт подходящий образ.",
  "home.trust.stylist.cta": "Открыть стилиста →",
};

const en: Record<HomeMessageKey, string> = {
  "home.hero.eyebrow": "AI Visual Search",
  "home.hero.titleLine1": "Drop a photo,",
  "home.hero.titleLine2": "find it at Ippodrom",
  "home.hero.subtitle":
    "From real Ippodrom and Abu Sahiy shop catalogs, our smart engine surfaces the best matches in an instant.",
  "home.stories.eyebrow": "Instant feed",
  "home.stories.title": "What's trending at Ippodrom now?",
  "home.stories.description": "Live seller stories — refreshed within 24 hours.",
  "home.stories.descriptionPromo": "No shop stories yet — showing platform promotions.",
  "home.stories.empty": "No live stories yet. Sellers will post new looks soon.",
  "home.stories.liveBadge": "LIVE NOW",
  "home.stories.promoBadge": "PROMO",
  "home.stories.scrollHint": "Swipe left or right for more stories",
  "home.stories.wowwDock": "Woww Live",
  "home.premiumBanners.eyebrow": "Premium ads",
  "home.premiumBanners.title": "Sponsored shops",
  "home.premiumBanners.description":
    "Bronze, Silver, and Gold tiers — trending marketplace shops in premium banner slots.",
  "home.premiumBanners.sponsored": "Sponsored",
  "home.premiumBanners.prev": "Previous banner",
  "home.premiumBanners.next": "Next banner",
  "home.merchant.eyebrow": "Merchant spotlight",
  "home.merchant.title": "Most trusted shops this week",
  "home.merchant.description": "Verified sellers — location, rating, and top sellers.",
  "home.discovery.eyebrow": "Trending",
  "home.discovery.titleStylist": "Trends for you",
  "home.discovery.descStylist":
    "Latest and popular product catalog from Ippodrom and Abu Sahiy shops.",
  "home.discovery.titleWholesale": "Wholesale catalog stream",
  "home.discovery.descWholesale":
    "Wholesale lots from Ippodrom and Abu Sahiy — MOQ and market filters.",
  "home.discovery.noResults": "No products match these filters. Try a wider zone or price range.",
  "home.sale.modeLabel": "Sale mode",
  "home.sale.chakana": "Retail (unit)",
  "home.sale.optom": "Wholesale (bulk)",
  "home.sale.china": "From China",
  "home.discovery.noChinaResults": "No China products found. Enter a Taobao ID or link.",
  "home.china.searchLabel": "Import by Taobao ID",
  "home.china.searchPlaceholder": "690885025678 or taobao.com/...?id=",
  "home.china.importBtn": "Import",
  "home.china.importError": "Import failed — check ID or API key",
  "home.china.apiMissing": "RAPIDAPI_KEY is not set — configure backend .env",
  "home.china.partialErrors": "Some items failed to load",
  "home.filter.market": "Market zone",
  "home.filter.block": "Sector / Block",
  "home.filter.category": "Category",
  "home.filter.minPrice": "Min price (UZS)",
  "home.filter.maxPrice": "Max price (UZS)",
  "home.filter.allZones": "All",
  "home.filter.allBlocks": "All blocks",
  "home.filter.allCategories": "All categories",
  "home.visual.dragHint": "Drag your photo here",
  "home.visual.tapHint": "or tap to upload",
  "home.visual.listening": "Listening…",
  "home.pin.save": "Save",
  "home.pin.saved": "Saved",
  "home.pin.cart": "Add to bag",
  "home.pin.band": "Reserve",
  "home.pin.productFallback": "Product",
  "home.pin.optomMin": "Bulk · min {qty}",
  "home.pin.groupPrice": "Wholesale price",
  "home.trust.aria": "Trust and service benefits",
  "home.trust.pricing.title": "Verified Real Pricing",
  "home.trust.pricing.desc":
    "Ippodrom and Abu Sahiy shop locations plus latest wholesale and retail prices are 100% verified.",
  "home.trust.direct.title": "Direct Seller Contact",
  "home.trust.direct.desc":
    "No middlemen — one-tap orders via Telegram or phone straight to the shop owner.",
  "home.trust.stylist.title": "Personal AI Stylist",
  "home.trust.stylist.desc":
    "Skip the hunt. Upload a photo and our smart engine builds a matching outfit in 30 seconds.",
  "home.trust.stylist.cta": "Open stylist →",
};

export const HOME_MESSAGES: Record<Locale, Record<HomeMessageKey, string>> = {
  uz,
  ru,
  en,
  tg: uz,
  ky: ru,
};

export function formatHomeMessage(
  locale: Locale,
  key: HomeMessageKey,
  vars?: Record<string, string | number>,
): string {
  let text = HOME_MESSAGES[locale]?.[key] ?? HOME_MESSAGES.uz[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
