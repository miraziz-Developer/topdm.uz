# Operatsion skriptlar

Faqat deploy va production operatsiyalari uchun. Dev seed skriptlari `RUN_SEED=true` bilan `seed.py` orqali ishga tushadi.

## Deploy

| Skript | Vazifa |
|--------|--------|
| `preflight-deploy.sh` | `.env` va majburiy kalitlarni tekshirish |
| `deploy-prod.sh` | 1× server — `docker-compose.prod.yml` |
| `deploy-core-only.sh` | 2× server — CORE (API+DB) |
| `deploy-web-only.sh` | 2× server — WEB (nginx+frontend) |
| `deploy-from-mac.sh` | rsync + remote deploy |
| `deploy-core.sh` | Katalog, integratsiya, embedding post-deploy |
| `remote-deploy.sh` | SSH orqali deploy |
| `generate-production-env.sh` | Production `.env` shablon |
| `smoke-prod.sh` | Health smoke test |

## Integratsiya va media

| Skript | Vazifa |
|--------|--------|
| `configure_production_integrations.sh` | Tashqi API kalitlarini `.env` ga yozish |
| `enable_r2_media.sh` | S3/R2 media backend yoqish |
| `migrate_local_uploads_to_s3.py` | Lokal uploadlarni S3 ga ko'chirish |
| `verify_integrations.py` | Tashqi servislar smoke |
| `verify_backend_core.py` | API endpoint smoke |
| `verify_media_storage.py` | Media storage tekshiruv |

## Ma'lumotlar

| Skript | Vazifa |
|--------|--------|
| `seed_categories.py` | Kategoriya katalogi (har startda) |
| `seed.py` | Demo ma'lumot (`RUN_SEED=true`) |
| `ensure_production_catalog.py` | Production katalog to'ldirish |
| `reembed_products.py` | Mahsulot embedding yangilash |
| `reembed_visual_batches.sh` | Batch embedding (cron) |

## Merchant va brend

| Skript | Vazifa |
|--------|--------|
| `run_merchant_bot.py` | Telegram merchant bot |
| `run_merchant_alerts.py` | Merchant alertlar |
| `sync-brand-assets.sh` | Brend PNG sinxronlash |
| `generate-brand-assets.py` | Brend asset generatsiya |

## Media tuzatish (dev/ops)

| Skript | Vazifa |
|--------|--------|
| `catalog_images.py` | Seed rasmlar pool (seed/fix skriptlari uchun) |
| `audit_product_images.py` | Mahsulot rasmlarini audit |
| `repair_broken_media.py` | Buzilgan media tuzatish |
| `fix_product_images.py` | Rasm URL tuzatish |
