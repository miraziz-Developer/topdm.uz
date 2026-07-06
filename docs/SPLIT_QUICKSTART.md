# 2× 4GB DigitalOcean — tez yo'riqnoma

## 0. IP larni yozing

DigitalOcean panel → har ikkala Droplet → **Public** va **Private (VPC)** IP.

```
WEB  public:  _______________  → DNS shu yerga
WEB  private: _______________  → CORE firewall uchun
CORE public:  _______________  → faqat SSH
CORE private: _______________  → WEB .env da CORE_BACKEND_HOST
```

---

## 1. CORE server (API + DB) — avval shu

```bash
ssh root@CORE_PUBLIC_IP
git clone https://github.com/miraziz-Developer/topdm.uz.git /opt/bozorliii
cd /opt/bozorliii
bash scripts/split-bootstrap.sh core --web-private-ip WEB_PRIVATE_IP
nano .env          # POSTGRES_PASSWORD, JWT_SECRET, GROQ, TELEGRAM...
bash scripts/preflight-deploy.sh
bash deploy/ufw-core.sh
bash scripts/deploy-core-only.sh
```

Tekshirish:
```bash
curl -s http://127.0.0.1:8000/health
```

---

## 2. WEB server (sayt + CRM)

```bash
ssh root@WEB_PUBLIC_IP
git clone https://github.com/miraziz-Developer/topdm.uz.git /opt/bozorliii
cd /opt/bozorliii
bash scripts/split-bootstrap.sh web --core-ip CORE_PRIVATE_IP
nano .env          # CORE_BACKEND_HOST to'g'riligini tekshiring
```

DNS (registrar): `@`, `www`, `api`, `crm` → **WEB_PUBLIC_IP**

```bash
bash deploy/check-dns.sh
bash deploy/ufw-web.sh
bash deploy/bootstrap-ssl.sh
bash deploy/verify-split.sh
bash scripts/deploy-web-only.sh
```

---

## 3. Tekshirish

```bash
curl -s https://bozorliii.online/health
curl -s https://api.bozorliii.online/api/v1/health
```

---

## Yangilash

**CORE:** `git pull && bash scripts/deploy-core-only.sh`  
**WEB:** `git pull && bash scripts/deploy-web-only.sh`

---

Batafsil: [SPLIT_DEPLOYMENT.md](./SPLIT_DEPLOYMENT.md)
