# Production readiness — barcha qatlamlar

**Oxirgi holat:** serverga deploy qilish uchun tayyor. Click/Payme **o‘chiq** (default).  
**Mobil ilovalar:** vaqtincha to‘xtatilgan — [MOBILE_APPS_PAUSED.md](MOBILE_APPS_PAUSED.md). Production: [PRODUCTION_LAUNCH_NOW.md](PRODUCTION_LAUNCH_NOW.md).

| Qism | Tayyorlik | Izoh |
|------|-----------|------|
| Mijoz sayti (`topdim.uz`) | **100%** deploy | Auth, bron, xarita, buyurtmalar |
| Merchant CRM (`crm.topdim.uz`) | **100%** deploy | Buyurtma, lead, chat, banner (tanga), moderatsiya |
| Telegram bot | **100%** deploy | `merchant-bot` servisi, OTP, mahsulot rasmi |
| Backend API | **100%** deploy | Migratsiya auto, health, rate limit |
| Click/Payme | **Muzlatilgan** | Kod bor, `ENABLE_ONLINE_CHECKOUT=false` |

## Deploy (qisqa)

```bash
cp .env.production.example .env   # to'ldiring
./scripts/preflight-deploy.sh
docker compose -f docker-compose.prod.yml up -d --build
./scripts/smoke-all.sh https://topdim.uz https://crm.topdim.uz https://api.topdim.uz
```

To‘liq qo‘llanma: **[DEPLOY_SERVER.md](DEPLOY_SERVER.md)**

## Checklist fayllar

- [LAUNCH_CHECKLIST.md](../LAUNCH_CHECKLIST.md) — mijoz web
- [CRM_LAUNCH_CHECKLIST.md](CRM_LAUNCH_CHECKLIST.md) — merchant CRM
- [CUSTOMER_WEB_STATUS.md](CUSTOMER_WEB_STATUS.md) — mijoz funksiyalar

## Click/Payme yoqish (keyinroq)

Faqat merchant accountlar tayyor bo‘lganda `.env` yangilang va `frontend` qayta build qiling.
