# Server tanlash — DigitalOcean va 4GB

## Qisqa tavsiya

| Budget | Nima olish | Narx (taxminan) |
|--------|------------|-----------------|
| **Kam** (~$24/oy) | **1× 4GB** droplet | $24 |
| **Barqaror** (~$48/oy) | **2× 4GB** (split) | $48 |

**Boshlash uchun:** 1× 4GB yetadi. Trafik o‘sib, server qotasa — 2× 4GB split ga o‘ting.

---

## Variant A — 1 ta 4GB (oddiy)

Barcha servislar bitta serverda (`docker-compose.prod.yml`).

```bash
cp .env.production.example .env
bash deploy/setup-swap.sh 2    # 2GB swap — majburiy tavsiya
docker compose -f docker-compose.prod.yml up -d --build
```

**Mos:** launch, demo, kuniga ~100–300 tashrif.

**Cheklov:** AI vizual qidiruv og‘ir yukda sekinlashishi mumkin; deploy/build paytida RAM yetishmasligi mumkin (buildni Mac/CI da qiling).

---

## Variant B — 2 ta 4GB (split)

| Server | Rol | Compose fayl |
|--------|-----|--------------|
| **Server 1 (WEB)** | Nginx, Frontend, CRM | `docker-compose.web.yml` |
| **Server 2 (CORE)** | PostgreSQL, Redis, API, Celery, Bot | `docker-compose.core.yml` |

Batafsil: [SPLIT_DEPLOYMENT.md](./SPLIT_DEPLOYMENT.md)

**Mos:** barqaror production, bir vaqtda ko‘proq foydalanuvchi.

---

## DigitalOcean droplet

| Parametr | 1× 4GB | 2× 4GB (har biri) |
|----------|--------|-------------------|
| RAM | 4 GB | 4 GB |
| CPU | 2 vCPU | 2 vCPU |
| Disk | 80 GB SSD | 80 GB SSD |
| Region | bir xil (masalan `FRA1`) | bir xil |
| VPC | — | **majburiy** (private IP) |

Har ikkala serverda:

```bash
bash deploy/setup-swap.sh 2
```

---

## Xotira taqsimoti (taxminiy)

### 1× 4GB (hammasi birga)

| Servis | RAM |
|--------|-----|
| PostgreSQL | ~600 MB |
| Redis | ~400 MB |
| Backend + AI | ~1 GB |
| Celery + Bot | ~500 MB |
| 2× Next.js | ~400 MB |
| Nginx + OS | ~500 MB |
| **Jami** | ~3.5 GB (+ swap) |

### 2× 4GB split

**WEB (~1.2 GB ishlatadi):** nginx, frontend, CRM  
**CORE (~3.2 GB ishlatadi):** postgres, redis, backend, celery, bot

---

## Qaysi birini tanlash?

```
Budget $24  →  1× 4GB  ✅
Budget $48  →  2× 4GB split  ✅ (8GB yo‘q bo‘lsa eng yaxshi variant)
```

8GB bitta server DigitalOcean da odatda mavjud (~$48), lekin sizda yo‘q bo‘lsa — **2× 4GB split** 1× 4GB dan ancha barqaror.
