# 2× 4GB split deploy (DigitalOcean)

Server 1 = **WEB** (internetga ochiq)  
Server 2 = **CORE** (API + DB, faqat VPC)

## 1. Dropletlar

| | WEB | CORE |
|---|-----|------|
| RAM | 4 GB | 4 GB |
| Public IP | ✅ (DNS shu yerga) | ixtiyoriy (SSH uchun) |
| VPC | bir xil VPC | bir xil VPC |

Ikkalasida:

```bash
bash deploy/install-docker.sh
bash deploy/setup-swap.sh 2
```

## 2. VPC private IP

DigitalOcean panel → Networking → VPC → har droplet **private IP** (masalan `10.116.0.2`).

Quyida:
- `CORE_PRIVATE` = Server 2 private IP
- `WEB_PRIVATE` = Server 1 private IP

## 3. Firewall

**CORE server:**
- SSH (22): faqat sizning IP
- TCP 8000: faqat `WEB_PRIVATE` (yoki butun VPC subnet)

**WEB server:**
- SSH (22): sizning IP
- HTTP 80, HTTPS 443: hamma (`0.0.0.0/0`)

## 4. DNS

Barcha domenlar **WEB public IP** ga:

| Host | IP |
|------|-----|
| `@`, `www` | WEB public |
| `api` | WEB public |
| `crm` | WEB public |

Nginx WEB da `api` ni CORE ga proxy qiladi.

## 5. CORE server (Server 2)

```bash
git clone https://github.com/miraziz-Developer/topdm.uz.git /opt/bozorliii
cd /opt/bozorliii
cp .env.production.example .env
nano .env   # POSTGRES_PASSWORD, JWT, kalitlar...

docker compose -f docker-compose.core.yml up -d --build
```

Tekshirish (CORE ichida):

```bash
curl -s http://127.0.0.1:8000/health
```

## 6. WEB server (Server 1)

`.env` ga qo‘shing:

```env
CORE_BACKEND_HOST=10.116.0.2
BACKEND_API_URL=http://10.116.0.2:8000
NEXT_PUBLIC_BACKEND_ORIGIN=https://api.bozorliii.online
```

SSL (WEB da):

```bash
bash deploy/bootstrap-ssl.sh
# yoki self-signed: bash deploy/bootstrap-selfsigned-ssl.sh
```

```bash
docker compose -f docker-compose.web.yml up -d --build
```

## 7. Tekshirish

```bash
curl -s https://bozorliii.online/health
curl -s https://api.bozorliii.online/api/v1/health
curl -sI https://crm.bozorliii.online
```

## 8. Yangilash (deploy)

**CORE:**

```bash
cd /opt/bozorliii && git pull
docker compose -f docker-compose.core.yml up -d --build
```

**WEB:**

```bash
cd /opt/bozorliii && git pull
docker compose -f docker-compose.web.yml up -d --build
```

Build og‘ir bo‘lsa — image larni Mac/CI da build qilib registry orqali tortish mumkin (keyingi bosqich).

## Muammolar

| Belgi | Yechim |
|-------|--------|
| 502 Bad Gateway | CORE `CORE_BACKEND_HOST` noto‘g‘ri yoki firewall 8000 yopiq |
| CRM API ishlamaydi | `BACKEND_API_URL` CORE private IP bo‘lishi kerak |
| OOM | `deploy/setup-swap.sh 2` ikkala serverda |
