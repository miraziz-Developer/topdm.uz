# Topdim.UZ — Launch uchun 10 ta aniq vazifa (30 kun)

> **Maqsad:** Ippodromda **haqiqiy mijoz + haqiqiy sotuvchi** bilan ishlaydigan marketplace. Kod tayyor — bu ro‘yxat **operatsion** (server, merchant, kontent, QA).

Bog‘liq: [WOW_LAUNCH.md](WOW_LAUNCH.md) · [FINAL_AUDIT.md](FINAL_AUDIT.md) · [DEPLOY_SERVER.md](DEPLOY_SERVER.md) · [CRM_LAUNCH_CHECKLIST.md](CRM_LAUNCH_CHECKLIST.md) · [PRODUCT_MASTER_PLAN.md](PRODUCT_MASTER_PLAN.md)

---

## Tez ko‘rinish

| # | Vazifa | Kim | Muddati |
|---|--------|-----|---------|
| 1 | Server + DNS + SSL | DevOps / siz | Kun 1–2 |
| 2 | Production `.env` + preflight | DevOps | Kun 2 |
| 3 | Deploy + smoke 100% | DevOps | Kun 3 |
| 4 | Katalog + embedding | Backend | Kun 3–4 |
| 5 | 10 ta merchant onboard | Ops + admin | Kun 4–10 |
| 6 | Haqiqiy mahsulot rasmlari | Merchant + admin | Kun 5–12 |
| 7 | 5 daqiqalik mijoz QA | QA / siz | Kun 10 |
| 8 | 5 daqiqalik merchant QA | QA + 2 sotuvchi | Kun 11 |
| 9 | Soft launch + monitoring | Hamma | Kun 12–14 |
| 10 | Birinchi hafta support | Ops | Kun 15–30 |

---

## 1. Server, DNS va SSL

**Nima:** `topdim.uz`, `api.topdim.uz`, `crm.topdim.uz` → bir IP, HTTPS ishlaydi.

**Qadamlar:**
- [ ] VPS (min 4 GB RAM, 2 vCPU, 40 GB disk)
- [ ] Docker + Docker Compose o‘rnatilgan
- [ ] DNS A yozuvlari server IP ga
- [ ] `deploy/ssl/fullchain.pem` + `privkey.pem` (Let's Encrypt)

**Muvaffaqiyat:** Brauzerda `https://topdim.uz` ochiladi (502 bo‘lmasa keyingi qadam).

---

## 2. Production `.env` (barcha kalitlar)

**Nima:** Backend, frontend build, bot bir xil secretlar bilan ishlaydi.

**Majburiy maydonlar:**

```bash
cp .env.production.example .env
# To'ldiring:
# JWT_SECRET, POSTGRES_PASSWORD, ADMIN_API_KEY
# GROQ_API_KEY, GOOGLE_API_KEY (yoki OPENAI_API_KEY)
# TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME
# RESEND_API_KEY, RESEND_FROM_EMAIL
# NEXT_PUBLIC_YANDEX_MAPS_API_KEY
# CORS_ORIGINS=https://topdim.uz,https://www.topdim.uz,https://crm.topdim.uz
# ENABLE_ONLINE_CHECKOUT=false
```

**Tekshiruv:**
```bash
./scripts/preflight-deploy.sh
```

**Muvaffaqiyat:** `Preflight PASSED` — xato yo‘q.

---

## 3. Deploy va smoke 100%

**Nima:** Barcha servislar ko‘tarilgan, API va sayt javob beradi.

**Qadamlar:**
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps   # hammasi healthy
./scripts/smoke-all.sh https://topdim.uz https://crm.topdim.uz https://api.topdim.uz
./scripts/smoke-stylist-chat.sh https://api.topdim.uz/api/v1
```

**Muvaffaqiyat:** `SMOKE PASSED` + stylist smoke OK.

---

## 4. Katalog va AI indeks

**Nima:** Qidiruv va stilist bo‘sh katalog demaydi; vector ishlaydi.

**Qadamlar (serverda):**
```bash
docker compose exec backend python /app/scripts/seed_bulk_ippodrom.py --target 300 --reembed
docker compose exec backend python /app/scripts/reembed_products.py
docker compose restart backend
./scripts/smoke-image-search.sh https://api.topdim.uz/api/v1
```

**Muvaffaqiyat:** Bosh sahifada mahsulotlar; AI chat 2–3 ta mahsulot kartochkasi qaytaradi; rasm qidiruv 200.

---

## 5. 10 ta merchant onboard

**Nima:** Har bir do‘kon CRM + bot orqali ishlaydi.

**Yangi (tavsiya):** sotuvchi o‘zi `/register` → login+parol → CRM. Batafsil: [MERCHANT_SELF_SERVICE.md](MERCHANT_SELF_SERVICE.md)

**Har bir merchant uchun checklist:**

| Qadam | Kim | Tekshiruv |
|-------|-----|-----------|
| Botda `/register` (8 qadam) yoki admin `/start shop_<UUID>` | Merchant | Login+parol olindi |
| `https://crm.topdim.uz/login` → parol yoki OTP | Merchant | Dashboard ochiladi |
| 3–5 ta mahsulot (rasm yoki bot orqali) | Merchant | Saytda ko‘rinadi |
| Moderatsiya → publish | Admin | Status `published` |
| Xarita: do‘kon joyi (pin / precision) | Merchant | `/map` da pin bor |

**Muvaffaqiyat:** Kamida **10 ta** do‘kon — buyurtma va chat test qilingan.

**Namuna merchant ro‘yxati (to‘ldiring):**

| # | Do‘kon nomi | Telefon | CRM login | Publish |
|---|-------------|---------|-----------|---------|
| 1 | | | ☐ | ☐ |
| 2 | | | ☐ | ☐ |
| … | | | | |

---

## 6. Haqiqiy mahsulot rasmlari (S3/CDN)

**Nima:** Picsum/placeholder emas — mijoz ishonadi. Batafsil: [MEDIA_S3_CDN.md](MEDIA_S3_CDN.md)

**Qadamlar:**
- [ ] `.env`: `MEDIA_STORAGE_BACKEND=s3`, R2 kalitlari, `S3_PUBLIC_BASE_URL=https://media.topdim.uz`
- [ ] `NEXT_PUBLIC_MEDIA_CDN_URL` — frontend build (xuddi CDN URL)
- [ ] `./scripts/preflight-deploy.sh` → S3 OK
- [ ] `docker compose exec backend python /app/scripts/verify_media_storage.py` → OK
- [ ] Merchant bot → **haqiqiy rasm** → CRM moderatsiya → publish
- [ ] `audit_product_images.py` — buzilgan URL 0
- [ ] (ixtiyoriy) `migrate_local_uploads_to_s3.py` — eski disk yuklamalar

```bash
docker compose exec backend python /app/scripts/verify_media_storage.py
docker compose exec backend python /app/scripts/audit_product_images.py
docker compose exec backend python /app/scripts/fix_product_images.py --seed-only
```

**Muvaffaqiyat:** Yangi yuklamalar `https://media.topdim.uz/...` — bosh sahifada buzilgan rasm yo‘q.

---

## 7. Mijoz QA (5 daqiqa)

**Kim:** Siz yoki tester — oddiy telefon, 4G/Wi‑Fi.

| # | Senariy | OK? |
|---|---------|-----|
| 1 | `topdim.uz` ochiladi, katalog ko‘rinadi | ☐ |
| 2 | Qidiruv: “qora kurtka” → natija | ☐ |
| 3 | AI chat: savol → mahsulot kartochkalari | ☐ |
| 4 | Mahsulot → checkout → **naqd/terminal** bron | ☐ |
| 5 | `/orders` — bron ko‘rinadi (login yoki telefon) | ☐ |
| 6 | `/map` — do‘kon tanlash, navigatsiya | ☐ |
| 7 | Demo stories/banner **ko‘rinmaydi** (mock off) | ☐ |

**Muvaffaqiyat:** 7/7 ✅

---

## 8. Merchant QA (5 daqiqa)

**Kim:** 2 ta haqiqiy sotuvchi + siz.

| # | Senariy | OK? |
|---|---------|-----|
| 1 | CRM login (Telegram OTP) | ☐ |
| 2 | Yangi buyurtma bildirishnoma (Telegram yoki CRM) | ☐ |
| 3 | Buyurtma statusini o‘zgartirish | ☐ |
| 4 | Mijoz chat — javob yozish | ☐ |
| 5 | Bot: rasm yuborish → moderatsiyada chiqish | ☐ |
| 6 | Banner/tanga (ixtiyoriy) ko‘rinishi | ☐ |

**Muvaffaqiyat:** 5/6 ✅ (banner ixtiyoriy)

---

## 9. Soft launch (kun 12–14)

**Nima:** Cheklangan auditoriya — Ippodromdagi 2–3 qator, keyin kengaytirish.

**Qadamlar:**
- [ ] `NEXT_PUBLIC_ALLOW_DEV_MOCKS` productionda **yo‘q**
- [ ] Yandex Metrika ID qo‘yilgan (ixtiyoriy lekin tavsiya)
- [ ] Support kanal: Telegram guruh yoki @username
- [ ] 10–20 ta tanish mijozga link yuborish
- [ ] Kunlik: `docker compose logs backend --tail=50` xatolarni tekshirish

**Muvaffaqiyat:** Birinchi **5 ta haqiqiy bron** (test emas).

---

## 10. Birinchi hafta support (kun 15–30)

**Nima:** Muammolarni tez yig‘ish va tuzatish.

| Kunlik | Vazifa |
|--------|--------|
| Ertalab | `smoke-all.sh` yoki `/health` tekshiruv |
| Kechqurun | Buyurtmalar soni, AI xatolari, merchant shikoyatlari |
| Haftada 1 | `git pull` + `docker compose ... up -d --build` |
| Haftada 1 | 1–2 yangi merchant onboard |

**Tez-tez muammolar:**

| Belgi | Yechim |
|-------|--------|
| CRM login ishlamaydi | Bot `/start`, telefon `owner_phone` bilan mos |
| Rasmlar buzilgan | Merchant haqiqiy rasm + S3 |
| AI javob bermaydi | `GROQ_API_KEY`, katalog reembed |
| Xarita bo‘sh | Yandex API key + referrer domen |

**Muvaffaqiyat (30 kun oxirida):** 50+ bron, 10+ faol merchant, uptime > 99%.

---

## Kunlik reja (qisqa)

| Kun | Asosiy ish |
|-----|------------|
| 1–2 | Vazifa 1–2 (server, env) |
| 3 | Vazifa 3–4 (deploy, katalog) |
| 4–10 | Vazifa 5–6 (merchant + rasmlar) |
| 10–11 | Vazifa 7–8 (QA) |
| 12–14 | Vazifa 9 (soft launch) |
| 15–30 | Vazifa 10 (support + o‘sish) |

---

## Launch “tayyor” belgisi

Quyidagilar barchasi ✅ bo‘lsa — **launch qiling**:

- [ ] Preflight + smoke productionda PASS
- [ ] 10 merchant CRM + botda ishlaydi
- [ ] Mijoz 5 daqiqa QA PASS
- [ ] Birinchi haqiqiy bron qabul qilindi
- [ ] Mock/demo kontent ko‘rinmaydi

Keyingi bosqich (world-class): [PRODUCT_MASTER_PLAN.md](PRODUCT_MASTER_PLAN.md) — P1 (to‘lov, trust UI, analytics).
