# Frontend (mijoz web)

Next.js 14 PWA — bozor katalogi, qidiruv, checkout, profil.

## Tuzilma

| Papka | Vazifa |
|-------|--------|
| `app/` | Sahifalar (App Router) |
| `src/components/` | UI komponentlar |
| `src/lib/` | API, utils |
| `src/hooks/` | React hooks |
| `public/` | Static, PWA, brand |

Import: `@/` → `src/`

## Ishga tushirish

```bash
# Root dan (tavsiya)
docker compose up frontend

# Lokal
npm ci && npm run dev   # :3002
```

Konfiguratsiya: root `.env` (`NEXT_PUBLIC_*` kalitlar).
