# 2× 4GB split deploy (DigitalOcean)

**Tez boshlash:** [SPLIT_QUICKSTART.md](./SPLIT_QUICKSTART.md)

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
bash scripts/split-bootstrap.sh core --web-private-ip WEB_PRIVATE_IP
nano .env   # kalitlar: .env.core.example asosida
bash scripts/preflight-deploy.sh
bash deploy/ufw-core.sh
bash scripts/deploy-core-only.sh
```

Tekshirish (CORE ichida):

```bash
curl -s http://127.0.0.1:8000/health
```

## 6. WEB server (Server 1)

```bash
git clone https://github.com/miraziz-Developer/topdm.uz.git /opt/bozorliii
cd /opt/bozorliii
bash scripts/split-bootstrap.sh web --core-ip CORE_PRIVATE_IP
nano .env
```

`.env` da (bootstrap avtomatik to'ldiradi):

```env
CORE_BACKEND_HOST=CORE_PRIVATE_IP
BACKEND_API_URL=http://CORE_PRIVATE_IP:8000
NEXT_PUBLIC_BACKEND_ORIGIN=https://api.bozorliii.online
```

DNS → **WEB public IP**. Keyin:

```bash
bash deploy/ufw-web.sh
bash deploy/bootstrap-ssl.sh
bash deploy/verify-split.sh
bash scripts/deploy-web-only.sh
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
