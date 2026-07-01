# Media storage — production runbook

## Strategiya tanlash

| Rejim | Qachon | `.env` |
|-------|--------|--------|
| **Local volume** (hozirgi VPS default) | Bitta server, tez start | `MEDIA_STORAGE_BACKEND=local` |
| **S3 / Cloudflare R2** | CDN, ko‘p server, backup | `MEDIA_STORAGE_BACKEND=s3` + R2 kalitlar |

Production bootstrap `MEDIA_STORAGE_BACKEND=s3` bo‘lsa S3 kalitlarni majburiy tekshiradi.

## Local volume (tavsiya — hozirgi prod)

```env
MEDIA_STORAGE_BACKEND=local
```

- Docker volume: `bozor_uploads:/app/uploads`
- URL: `https://api.bozorliii.online/api/v1/media/...`
- Backend, bot, celery bir xil volume’ni ulashadi

## S3 / R2

```env
MEDIA_STORAGE_BACKEND=s3
S3_BUCKET=bozorliii-media
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://media.bozorliii.online
S3_REGION=auto
S3_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com

NEXT_PUBLIC_MEDIA_CDN_URL=https://media.bozorliii.online
```

Migratsiya:

```bash
# Mavjud /app/uploads fayllarni R2 ga ko‘chirish (serverda)
docker compose -f docker-compose.prod.yml exec backend python /app/scripts/migrate_local_uploads_to_s3.py
```

## Tekshirish

```bash
docker compose exec backend python /app/scripts/verify_integrations.py
curl -I "https://api.bozorliii.online/api/v1/media/products/<filename>"
```

## Xatoliklar

| Belgi | Sabab | Yechim |
|-------|-------|--------|
| Bot rasmlar 404 | Volume ulashilmagan | `bozor_uploads` backend+bot+celery |
| Aralash URL (CDN + local) | S3 yoqilgan, eski fayllar local | Re-upload yoki migrate script |
| Bootstrap S3 xato | Kalitlar bo‘sh | `.env` to‘ldirish yoki `local` qiling |
