# If-then shaxsiylashtirish (mijoz sayti)

Har bir foydalanuvchi uchun **signallar** yig'iladi, keyin **qoidalar** ketma-ket tekshiriladi.

## API

- `GET /api/v1/experience/home?visit_count=…&last_shop_slug=…`
- `POST /api/v1/experience/home` — `ClientHintsBody` (auth ixtiyoriy)

Javob: `rule_id`, `banner`, `ctas`, `section_order`, `signals`.

## Signallar

| Signal | Manba |
|--------|--------|
| `is_logged_in` | JWT |
| `visit_count` | localStorage (`topdim_visit_count`) |
| `last_shop_slug` | oxirgi ochilgan do'kon |
| `active_orders_count` | telefon bo'yicha buyurtmalar |
| `completed_orders_count` | yakunlangan buyurtmalar |
| `liked_products_count` | localStorage |

## Qoidalar (if → then)

1. **merchant** → CRM paneli CTA
2. **active_pickup** → «Buyurtmangiz» banner + buyurtmalar/xarita
3. **returning_shopper** → qaytgan mijoz + AI Stilist
4. **resume_shop** → oxirgi do'konga davom
5. **new_guest** → kirish/ro'yxat (≤3 tashrif)
6. **default_explorer** → xarita + stilist

Yangi qoida: `backend/app/application/personalization/rule_engine.py` ichidagi `RULES` ro'yxatiga qo'shing.

## Frontend

- `useHomeExperience` — bosh sahifa
- `saveLastShop` — `/shop/[slug]` ochilganda
- `PersonalizedHomeBanner` — shaxsiy banner va tugmalar
