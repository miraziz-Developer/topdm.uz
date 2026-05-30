# Merchant CRM — launch checklist

## Production env

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | `/api/v1` |
| `BACKEND_API_URL` | `http://backend:8000` (Docker) |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | bot username (no `@`) |

Nginx `crm.topdim.uz` must proxy:

- `/` → `merchant-crm:3000` (Next.js, includes `/api/v1` proxy)
- `/ws/` → `backend:8000` (shop chat WebSocket)

## Merchant onboarding

1. Admin creates shop with `owner_phone` (+998…).
2. Merchant opens Telegram bot → `/start shop_<uuid>` → shares contact (phone must match `owner_phone`).
3. Botda **«CRM Panel»** tugmasi → to'liq CRM (buyurtma, lead, chat) Telegram ichida.
4. **«Xarita / Joylashuv»** — Mini App precision map.
5. Alternativa: `https://crm.topdim.uz/login` → Telegram OTP.
6. `/crm` — menyuni qayta ko'rsatish.

**Bot → CRM:** `POST /auth/telegram/webapp` (initData) · sahifa `/telegram`

## Smoke test

```bash
./scripts/smoke-all.sh https://topdim.uz https://crm.topdim.uz https://api.topdim.uz
# yoki faqat CRM:
./scripts/smoke-merchant-crm.sh https://crm.topdim.uz https://api.topdim.uz/api/v1
```

## Manual QA

- [ ] Login OTP → dashboard loads
- [ ] Orders status PATCH works
- [ ] Leads status PATCH works
- [ ] Chat WebSocket connects (green indicator)
- [ ] Pending product publish from moderation
- [ ] Banner purchase with coins (if wallet funded)
- [ ] `/mini` redirects to login without token
