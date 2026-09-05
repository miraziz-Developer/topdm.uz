# Production deploy

Batafsil operatsion qo'llanma. Server hajmi: [SERVER_SIZING.md](./SERVER_SIZING.md) · Split: [SPLIT_DEPLOYMENT.md](./SPLIT_DEPLOYMENT.md)

## Server va domenlar

| Resurs | Qiymat |
|--------|--------|
| WEB server | `103.253.145.151` |
| CORE server | `152.42.204.27` |
| Do'kon | `bozorliii.online` |
| API | `api.bozorliii.online` |
| CRM | `crm.bozorliii.online` |

## DNS

| Type | Host | Value |
|------|------|--------|
| A | `@` | `103.253.145.151` |
| A | `www` | `103.253.145.151` |
| A | `api` | `103.253.145.151` |
| A | `crm` | `103.253.145.151` |
| A | `media` | `103.253.145.151` |
| A | `admin` | `152.42.204.27` |

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
WEB_PUBLIC_IP=103.253.145.151 CORE_PUBLIC_IP=152.42.204.27 ./scripts/deploy-split-from-mac.sh
```

Serverda:

```bash
bash scripts/deploy-core-only.sh  # CORE serverda
bash scripts/deploy-web-only.sh   # WEB serverda
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
