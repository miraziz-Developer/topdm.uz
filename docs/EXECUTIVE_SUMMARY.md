# Bozorliii — Executive Summary

**Mahalliy bozor uchun AI marketplace platformasi**

---

## Muammo

O‘zbekistondagi bozorlarda (masalan, kiyim bozorlari) sotuvchilar va xaridorlar hali ham telefon, Telegram va naqd pulga tayanadi. Katalog tarqoq, qidiruv qiyin, bron va topshirish jarayoni tartibsiz.

## Yechim

**Bozorliii** — bitta platformada:

- Mijoz **web ilova** (PWA) — katalog, vizual qidiruv, onlayn bron
- **AI stylist** — kiyim maslahati va look tavsiyasi
- **Merchant CRM** — mahsulot, buyurtma, chat, analytics
- **Telegram bot** — sotuvchi uchun tez bildirishnomalar
- **Xarita** — do‘kon topish va piyoda marshrut

## Live demo

| Xizmat | URL |
|--------|-----|
| Do‘kon (mijoz) | https://bozorliii.online |
| Sotuvchi CRM | https://crm.bozorliii.online |
| API health | https://api.bozorliii.online/health |

## Texnologik qisqa xulosa

| Qatlam | Texnologiya |
|--------|-------------|
| Backend | Python 3.11, FastAPI, PostgreSQL + pgvector, Redis, Celery |
| Frontend | Next.js 14, PWA, Tailwind CSS |
| AI | Groq LLM, vizual embedding (CLIP), mahsulot moderatsiyasi |
| Infra | Docker, Nginx, GitHub Actions CI/CD |
| To‘lov | Click, Payme integratsiyasi |
| Logistika | BTS Express |

## Biznes qiymati

1. **Sotuvchi** — raqamli vitrina, buyurtma boshqaruvi, kamroq yo‘qotilgan mijoz
2. **Xaridor** — qulay qidiruv, bron, QR bilan xavfsiz topshirish
3. **Platforma** — obuna, reklama bannerlari, coin tizimi orqali daromad

## Loyiha hajmi

- **Monorepo** — backend, frontend, CRM, mobil ilova
- **49+ DB migratsiya** — production-ready schema
- **30+ backend test** — avtomatik sifat nazorati
- **CI pipeline** — build, E2E, migratsiya, Docker image

## Jamoa roli (namuna)

| Rol | Mas'uliyat |
|-----|------------|
| Full-stack / Backend | API, biznes logika, bot, to‘lov |
| Frontend | Mijoz PWA, UX, PWA |
| DevOps | Docker, deploy, monitoring |

## Hujjatlar

- [README](../README.md) — tez boshlash
- [STRUCTURE.md](./STRUCTURE.md) — kod tuzilmasi
- [ARCHITECTURE.md](./ARCHITECTURE.md) — texnik arxitektura
- [DEPLOYMENT.md](./DEPLOYMENT.md) — production deploy

---

*Bozorliii © 2026 — Proprietary*
