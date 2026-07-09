# Bozorliii Platform Admin CRM

Platforma egasi uchun biznes boshqaruv paneli (Next.js 14 + shadcn uslubida elite dark CRM).

**URL (production):** https://admin.bozorliii.online

## Imkoniyatlar

- Boshqaruv dashboard (KPI, grafiklar)
- Do'kon moderatsiyasi (tasdiqlash / rad)
- Merchant to'lovlar (payout)
- Platforma foydasi (sweep)
- Bozor analitikasi
- Buyurtmalar va foydalanuvchilar
- Support murojaatlar
- Premium tariflar va bannerlar

## Dev

```bash
cd platform-admin
npm install
# .env.local: BACKEND_API_URL, ADMIN_API_KEY, ADMIN_PANEL_PASSWORD
npm run dev
# http://localhost:3004
```

## Deploy

WEB serverda `docker-compose.web.yml` ichida `platform-admin` servisi.
DNS: `admin.bozorliii.online` → WEB public IP.

Login: `ADMIN_PANEL_USERNAME` / `ADMIN_PANEL_PASSWORD` (server `.env`).
