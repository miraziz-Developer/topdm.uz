# Production deployment (Docker)

**To‘liq qo‘llanma (o‘zbekcha):** [docs/DEPLOY_SERVER.md](../docs/DEPLOY_SERVER.md)

## Prerequisites

- Linux VPS (2+ vCPU, 4GB+ RAM recommended)
- DNS A records: `topdim.uz`, `api.topdim.uz`, `crm.topdim.uz` → server IP
- Ports **80** and **443** open

## Steps

1. Copy environment template:

   ```bash
   cp .env.production.example .env
   ```

2. Edit `.env`: database password, `JWT_SECRET`, `ADMIN_API_KEY`, SMTP, AI keys, `CORS_ORIGINS`, domains.

3. Preflight:

   ```bash
   ./scripts/preflight-deploy.sh
   ```

4. Build and start:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

5. Verify:

   ```bash
   ./scripts/smoke-all.sh https://topdim.uz https://crm.topdim.uz https://api.topdim.uz
   ```

## Architecture

| Service      | Internal port | Public (via Nginx)              |
|-------------|---------------|----------------------------------|
| frontend    | 3000          | `https://topdim.uz` + `/api/v1` (session proxy) |
| backend     | 8000          | internal; `https://api.topdim.uz` (direct API)   |
| merchant-crm| 3000          | `https://crm.topdim.uz`          |
| postgres    | 5432          | **not exposed** (backend-network)|
| redis       | 6379          | **not exposed** (backend-network)|

Nginx config: `nginx/production.conf`. TLS certificates:

```bash
mkdir -p deploy/ssl
# fullchain.pem + privkey.pem (Let's Encrypt or your CA)
```

WebSocket chat: `wss://topdim.uz/ws/chat/{thread_id}` (proxied with Upgrade headers).

Production images: `backend/Dockerfile.prod`, `frontend/Dockerfile.prod` (multi-stage, non-root).

## Media uploads (S3/CDN)

- **Production:** Cloudflare R2 + `S3_PUBLIC_BASE_URL` — to‘liq qo‘llanma: [docs/MEDIA_S3_CDN.md](../docs/MEDIA_S3_CDN.md)
- **Tekshiruv:** `make verify-media` · `make audit-images`
- **Local disk:** `MEDIA_STORAGE_BACKEND=local` (volume `bozor_uploads`)
- **Dev S3:** `docker compose --profile s3dev up -d minio minio-init`

## Updates

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations run automatically on backend container start.
