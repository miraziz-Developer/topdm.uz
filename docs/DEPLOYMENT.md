# Production deploy — 1x 4GB (oddiy variant)

> **Diqqat:** hozirgi jonli production 2x 4GB **split** topologiyada ishlaydi
> (`docker-compose.core.yml` + `docker-compose.web.yml`, GitHub Actions
> `deploy.yml` orqali avtomatik) — batafsil: [SPLIT_DEPLOYMENT.md](./SPLIT_DEPLOYMENT.md).
> Shu hujjat quyida `docker-compose.prod.yml` bilan **bitta serverga** deploy
> qilishni tasvirlaydi — kam trafikli boshlanish yoki split'dan orqaga tushish
> uchun. Server hajmi tanlash: [SERVER_SIZING.md](./SERVER_SIZING.md).

## Server va domenlar

| Resurs | Qiymat |
|--------|--------|
| Server | droplet'ning public IP'i (o'zingiznikini yozing) |
| Do'kon | `bozorliii.online` |
| API | `api.bozorliii.online` |
| CRM | `crm.bozorliii.online` |

## DNS

Barcha quyidagi hostlarni **server public IP**'siga yo'naltiring (registrar panelida):

| Type | Host |
|------|------|
| A | `@` |
| A | `www` |
| A | `api` |
| A | `crm` |
| A | `admin` |

```bash
bash deploy/check-dns.sh
bash deploy/bootstrap-ssl.sh
docker compose -f docker-compose.prod.yml restart nginx
```

Security Group: **22, 80, 443** ochiq.

## Environment

```bash
./scripts/generate-production-env.sh > .env
nano .env
```

Majburiy production qiymatlar:

| O'zgaruvchi | Qiymat |
|-------------|--------|
| `PRODUCTION` | `true` |
| `ALLOW_DEV_MOCKS` | `false` |
| `RUN_SEED` | `false` |
| `PREMIUM_CHINA_DEMO_MODE` | `false` |

Namuna: `.env.production.example`

## Deploy

Mac dan:

```bash
./scripts/deploy-from-mac.sh
```

Serverda:

```bash
bash deploy/install-docker.sh
bash deploy/bootstrap-ssl.sh
./scripts/deploy-prod.sh
```

Tekshirish:

```bash
make prod-smoke
curl -sf https://bozorliii.online/health
```

## Media (S3 / R2)

Batafsil: [MEDIA_S3_CDN.md](./MEDIA_S3_CDN.md)

```bash
bash scripts/enable_r2_media.sh
```
