# Topdim algoritmlar — umumiy xarita

Barcha «if-then» va signal algoritmlar bir-biriga bog‘langan.

## 1. Mijoz sayti — shaxsiylashtirish

**Fayl:** `backend/app/application/personalization/rule_engine.py`  
**API:** `GET/POST /api/v1/experience/home`

| Signal | Manba |
|--------|--------|
| Tashriflar | `topdim_visit_count` |
| Oxirgi do'kon | `topdim_last_shop` |
| Sevimlilar | `topdim-watchlist` (favorites) |
| Buyurtmalar | Telefon (auth yoki guest) |
| Optom rejim | Filtr toolbar |
| Bozor | Filtr marketZone |

**Qoidalar (prioritet):** merchant → faol bron → qaytgan mijoz → oxirgi do'kon → optom → sevimlilar → bozor → login → mehmon → default.

**Frontend:** `HomeExperienceLayout` — `section_order` bo‘yicha bloklar qayta tartiblanadi.

---

## 2. Yo‘ldagi mijoz (CRM + xarita)

**Fayl:** `backend/app/application/merchant/customer_approach.py`  
**API:** `POST /orders/{id}/approach-ping`

- Taxminiy GPS (~500 m grid)
- Radius (1–30 km, default 10)
- CRM xaritada ko‘k nuqtalar

---

## 3. Do‘konda + olib ketish

**Fayl:** `backend/app/application/merchant/order_pickup_completion.py`

| Trigger | Harakat |
|---------|---------|
| Do‘konda (~100 m) | «Mijoz do'konda» + mijozga xabar |
| 3+ daq | «Tasdiqlang» eslatma |
| Qo‘lda CRM | «Olib ketdi» → `completed` |
| Avto (ixtiyoriy) | 20 daq → `completed` |

---

## 4. Do‘kon QR va ulashish

**Fayl:** `backend/app/application/merchant/share_kit.py`

- QR ichida **do‘kon nomi** (caption)
- Havola: `/shop/{slug}?from=qr`
- Vitrina posteri (chop etish)

---

## 5. AI Stilist / Chat

- Groq + katalog filtri (`stylist_user_profile`)
- `recommended_product_ids` — takrorlamaslik
- LangGraph bozor chat

---

## Test

```bash
cd backend && python -m pytest tests/test_rule_engine.py -q
```

## Yangi qoida qo‘shish

`RULES` ro‘yxatiga `when` + `banner` + `section_order` qo‘shing — yuqoriroq = yuqori prioritet.
