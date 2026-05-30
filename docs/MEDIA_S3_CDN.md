# Topdim.UZ — S3/CDN (haqiqiy mahsulot rasmlari)

Productionda barcha merchant rasmlari **S3-compatible storage + CDN** orqali xizmat qiladi (tavsiya: **Cloudflare R2**).

---

## 1. Cloudflare R2 (tavsiya)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Create bucket**  
   - Nom: `topdim-media`  
   - Location: avtomatik

2. **API token** → R2 → Manage → Create token (Object Read & Write)

3. **Public access** — Custom domain:
   - R2 → bucket → Settings → **Public access** → `media.topdim.uz` (yoki `cdn.topdim.uz`)
   - DNS: CNAME `media` → R2 berilgan hostname

4. `.env` (production):

```bash
MEDIA_STORAGE_BACKEND=s3
S3_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_BUCKET=topdim-media
S3_ACCESS_KEY_ID=<r2_access_key>
S3_SECRET_ACCESS_KEY=<r2_secret>
S3_PUBLIC_BASE_URL=https://media.topdim.uz
S3_REGION=auto

# Frontend Next/Image (build vaqtida)
NEXT_PUBLIC_MEDIA_CDN_URL=https://media.topdim.uz
```

5. **CORS** (bucket policy yoki R2 CORS rules):

```json
[
  {
    "AllowedOrigins": ["https://topdim.uz", "https://www.topdim.uz", "https://crm.topdim.uz"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Fayl: `deploy/r2-cors.example.json`

---

## 2. Tekshiruv

```bash
# .env to'ldirilgandan keyin
./scripts/preflight-deploy.sh

# Yuklash testi (1 ta JPEG S3 ga)
docker compose exec backend python /app/scripts/verify_media_storage.py

# Bazadagi rasmlar 404 emasligi
docker compose exec backend python /app/scripts/audit_product_images.py
```

---

## 3. Merchant oqimi (haqiqiy rasm)

1. Telegram bot → mahsulot **rasm** yuborish  
2. CRM → **Moderatsiya** → Publish  
3. Backend `ObjectMediaStore` → S3 → URL `https://media.topdim.uz/products/{shop_id}/...jpg`

Seed/picsum rasmlarini almashtirmaslik uchun faqat placeholderlarni yangilash:

```bash
docker compose exec backend python /app/scripts/fix_product_images.py --seed-only
```

**Eslatma:** `--seed-only` sotuvchi yuklagan S3 rasmlarga tegmaydi.

---

## 4. Local disk → S3 migratsiya

Avval `uploads/products/` da fayllar bo‘lsa:

```bash
docker compose exec backend python /app/scripts/migrate_local_uploads_to_s3.py --dry-run
docker compose exec backend python /app/scripts/migrate_local_uploads_to_s3.py
```

---

## 5. Dev: MinIO (ixtiyoriy)

```bash
docker compose --profile s3dev up -d minio
# .env:
# MEDIA_STORAGE_BACKEND=s3
# S3_ENDPOINT_URL=http://minio:9000
# S3_BUCKET=topdim-media
# S3_ACCESS_KEY_ID=minioadmin
# S3_SECRET_ACCESS_KEY=minioadmin
# S3_PUBLIC_BASE_URL=http://localhost:9000/topdim-media
```

---

## Muvaffaqiyat mezonlari (Launch #6)

- [ ] `verify_media_storage.py` → `OK`
- [ ] `audit_product_images.py` → 0 ta broken (yoki faqat publish qilinmagan mahsulotlar)
- [ ] Bosh sahifada buzilgan rasm ikonkasi yo‘q
- [ ] Yangi bot yuklamalari `media.topdim.uz` URL qaytaradi
