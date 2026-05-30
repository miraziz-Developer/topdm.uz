# Topdim.UZ — Launch Checklist

> **Mobil store ilovalari (Android/iOS) vaqtincha to‘xtatilgan** — [docs/MOBILE_APPS_PAUSED.md](docs/MOBILE_APPS_PAUSED.md)  
> **Hozirgi production:** [docs/PRODUCTION_LAUNCH_NOW.md](docs/PRODUCTION_LAUNCH_NOW.md)  
> **30 kunlik reja:** [docs/LAUNCH_30_DAYS.md](docs/LAUNCH_30_DAYS.md)  
> **Server deploy:** [docs/DEPLOY_SERVER.md](docs/DEPLOY_SERVER.md) · **Holat:** [docs/PRODUCTION_READY.md](docs/PRODUCTION_READY.md)  
> Mijoz web: [docs/CUSTOMER_WEB_STATUS.md](docs/CUSTOMER_WEB_STATUS.md) · CRM: [docs/CRM_LAUNCH_CHECKLIST.md](docs/CRM_LAUNCH_CHECKLIST.md)

## Before deploy

```bash
./scripts/preflight-deploy.sh
```

- [ ] `.env` filled: `JWT_SECRET`, `POSTGRES_PASSWORD`, `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `RESEND_*`, `YANDEX_MAPS` (build arg)
- [ ] `ENABLE_ONLINE_CHECKOUT=true` va `NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT=true` (Click/Payme checkout yoqilgan)
- [ ] `NEXT_PUBLIC_API_BASE_URL=/api/v1` (relative — browser uses Next proxy)
- [ ] `BACKEND_API_URL=http://backend:8000` on frontend container
- [ ] TLS: `deploy/ssl/fullchain.pem` + `privkey.pem`
- [ ] Nginx routes `/api/v1/` → **frontend** (session cookie → Bearer)
- [ ] `NEXT_PUBLIC_ALLOW_DEV_MOCKS` **unset** in production
- [ ] `PAYMENT_CALLBACK_IP_WHITELIST` to‘ldirilgan (provider IP/CIDR)
- [ ] `PAYMENT_CALLBACK_MAX_AGE_SECONDS` (tavsiya: 300–900)

## Smoke test (staging or prod)

```bash
./scripts/smoke-all.sh https://topdim.uz https://crm.topdim.uz https://api.topdim.uz
./scripts/smoke-payment-callbacks.sh https://api.topdim.uz
```

Manual:

1. **Auth** — Email OTP or Telegram → profil ochiladi, `/api/v1/auth/me` 200
2. **Bron** — Mahsulot → checkout → `POST /orders/reserve` → muvaffaqiyat
3. **Buyurtmalar** — `/orders` login bilan ro‘yxat (telefon profilda = bron telefoni)
4. **Xarita** — `/map` pin yoki xarita bosish → do‘kon tanlanadi, Yandex navigatsiya
5. **Mock yo‘q** — Stories/banner bo‘sh bo‘lsa demo kontent ko‘rinmasin

## Architecture (production)

| Path | Upstream |
|------|----------|
| `https://topdim.uz/` | Next.js frontend |
| `https://topdim.uz/api/v1/*` | Next.js → FastAPI (Bearer from cookie) |
| `https://topdim.uz/ws/*` | FastAPI (token query / cookie) |
| `https://api.topdim.uz/*` | FastAPI direct (mobile / Bearer) |
| `https://crm.topdim.uz` | merchant-crm |

## Rollback

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## Post-launch

- [ ] Yandex Metrika: `NEXT_PUBLIC_YANDEX_METRIKA_ID`
- [ ] Click/Payme: `CLICK_*` / `PAYME_*` to‘liq va callback URL provider panelda yangilangan
- [ ] Redis cache flush after map location deploy: `redis-cli KEYS 'map:stores:*'`

## E2E (local)

```bash
cd frontend && npm ci && npx playwright install chromium
npm run build && npm run test:e2e
```
