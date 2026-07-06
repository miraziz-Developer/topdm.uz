# Production deploy

Batafsil operatsion qo'llanma. Server hajmi: [SERVER_SIZING.md](./SERVER_SIZING.md) · Split: [SPLIT_DEPLOYMENT.md](./SPLIT_DEPLOYMENT.md)

## Server va domenlar

| Resurs | Qiymat |
|--------|--------|
| Server | `8.222.211.54` |
| Do'kon | `bozorliii.online` |
| API | `api.bozorliii.online` |
| CRM | `crm.bozorliii.online` |

## DNS

| Type | Host | Value |
|------|------|--------|
| A | `@` | `8.222.211.54` |
| A | `www` | `8.222.211.54` |
| A | `api` | `8.222.211.54` |
| A | `crm` | `8.222.211.54` |

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
