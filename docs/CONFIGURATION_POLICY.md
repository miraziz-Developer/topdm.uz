# Konfiguratsiya siyosati

Bu loyiha uchun **asosiy source of truth — root `.env`**.

## Qoidalar

- `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.core.yml`, `docker-compose.web.yml` faqat root `.env` dan foydalanadi.
- `backend/.env` va `frontend/.env.local` tarixiy/mahalliy yordamchi fayllar bo‘lishi mumkin, lekin deploy uchun authoritative emas.
- Production va split deploy uchun namunaviy fayllar:
  - `.env.production.example`
  - `.env.core.example`
  - `.env.web.example`
- Lokal productionga yaqin test uchun: `.env.local-prod`
- `.env.production.ready` generated artifact bo‘lishi mumkin; qo‘lda asosiy manba sifatida ishlatilmasin.

## Majburiy xavfsizlik qoidalari

- Production compose fayllarda secretlar uchun default fallback bo‘lmasligi kerak.
- `ADMIN_PANEL_PASSWORD`, `ADMIN_PANEL_SECRET`, `ADMIN_SESSION_SECRET`, `ADMIN_API_KEY`, `POSTGRES_PASSWORD` kabi qiymatlar `.env` da aniq berilishi shart.
- Hardcoded credential yoki remote hotfix skriptlar taqiqlanadi.

## Amaliy tavsiya

1. Root `.env` ni kerakli example fayldan yaratish.
2. Compose ishga tushirishdan oldin required envlar tekshirilishi.
3. Service-specific env fayllar faqat local yordamchi holatlarda ishlatilsin, lekin docs va deploy qarorlarini belgilamasin.
