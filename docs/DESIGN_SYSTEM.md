# Topdim.UZ — dizayn tizimi

## Brend

| Element | Qiymat |
|---------|--------|
| Nom | **Topdim.UZ** |
| Qisqa | Topdim |
| Tagline (mijoz) | AI bilan bozor toping |
| Tagline (CRM) | Do'kon boshqaruvi |

## Ranglar (ikkala ilovada bir xil)

| Token | Hex |
|-------|-----|
| `electric-500` | `#0066ff` |
| `gold-500` / `neon-500` | `#ff4d12` |
| `canvas` | `#f2f4f8` |
| `text-100` | `#030308` |

## Logo fayllar (manba)

`brand/assets/` — yagona manba. Yangilanganda:

```bash
./scripts/sync-brand-assets.sh
```

| Fayl | Ishlatilish |
|------|-------------|
| `topdim-icon.svg` | Favicon, mobil header, Telegram |
| `topdim-wordmark.svg` | Matnli logo |
| `topdim-logo.svg` | Icon + topdim.uz (asosiy) |
| `favicon.svg` | Brauzer tab |

## React komponent

```tsx
import { TopdimLogo } from "@/components/brand/topdim-logo";

<TopdimLogo variant="full" size="md" href="/" />
<TopdimLogo variant="icon" size="sm" badge="CRM" showTagline />
```

- **Frontend:** `frontend/src/components/brand/`
- **CRM:** `merchant-crm/src/components/brand/`

## Qoidalari

1. Headerda **Sparkles** o‘rniga `TopdimLogo` ishlating.
2. Metadata / PWA / favicon — `/favicon.svg` va `/brand/*`.
3. CRM da `badge="CRM"` qo‘shiladi, lekin logo bir xil.
4. Tailwind tokenlari ikkala `tailwind.config.ts` da sinxron.
