# Customer Web — 100% Launch Status

Last updated: **server deploy ready** — pickup-only marketplace (Ippodrom + multi-market map). Click/Payme muzlatilgan.

## Completed

| Area | Status |
|------|--------|
| Auth (email OTP, Telegram, session proxy) | Done |
| Catalog, search, product, shop pages | Done |
| Checkout (cash/terminal, reserve + stock lock) | Done |
| Guest order lookup by phone | Done |
| Orders (login + guest) | Done |
| Map (Yandex, multi-market, external nav) | Done |
| Prod nginx → Next `/api/v1` proxy | Done |
| Mock content gated in production | Done |
| CRM dashboard blocked on customer domain | Done |
| CI build + Playwright smoke | Done |
| SEO robots/sitemap, PWA shell | Done |
| Click/Payme code (disabled by default) | Done |

## Turn on later

```env
# Online checkout (after merchant accounts)
ENABLE_ONLINE_CHECKOUT=true
NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT=true
CLICK_SERVICE_ID=...
PAYME_MERCHANT_ID=...
```

## Verify before go-live

```bash
./scripts/smoke-customer.sh https://topdim.uz
cd frontend && npm run test:e2e
```

Manual: auth → reserve → orders (guest phone) → map shop select → profile phone match.
