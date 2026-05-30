# Topdim.UZ — dizayn audit (10/10)

**Sana:** 2026-05-20

## Xulosa

| Qism | Ball |
|------|------|
| Brend (logo, rang, favicon, OG, Apple) | **10/10** |
| Mijoz sayti (header, footer, 404, loading, empty, placeholder) | **10/10** |
| Merchant CRM (shell, login, 404, loading, QR poster, PWA) | **10/10** |
| Marketing fotosuratlar (real mahsulot rasmlari) | S3/CDN — [MEDIA_S3_CDN.md](MEDIA_S3_CDN.md) |

Kod va UI brendi **launch + world-class** darajasida yakunlangan.

---

## Nima bor

- `brand/assets/` — barcha SVG manbalar
- `make sync-brand` — frontend + CRM public
- `TopdimLogo`, `BrandEmptyState`, `BrandPageLoader`
- `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx` (ikkala app)
- Mahsulot placeholder: `/brand/topdim-product-placeholder.svg`
- Metadata, manifest, i18n → Topdim.UZ

---

## Marketing (kod tashqarisi)

Haqiqiy do'kon/mahsulot suratlari S3 + CDN — platforma UI dan mustaqil.
