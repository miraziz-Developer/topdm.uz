# Bozorliii — disaster recovery

The production servers are a low-trust free tier. If a droplet disappears,
everything needed to stand the platform back up is in two places:

| What | Where |
|---|---|
| Code | this GitHub repo (`main`) |
| DB dump, uploaded media, **both** servers' `.env` | the founder's Mac: `~/Backups/bozorliii/` |

`~/Backups/bozorliii/latest/` always points at the newest verified snapshot:

```
latest/
├── db.sql.gz        # pg_dump of the CORE database
├── uploads.tar.gz   # contents of the bozorliii_bozor_uploads volume
├── core.env         # CORE server /opt/bozorliii/.env  (secrets!)
└── web.env          # WEB server /opt/bozorliii/.env   (secrets!)
```

`~/Backups/bozorliii/server-stage/` holds the last ~4 days of 6-hourly dumps
pulled from the CORE server (`db-<ts>.sql.gz`, `uploads-<ts>.tar.gz`).

---

## Backup schedule

- **CORE server**, every 6h (root cron): `scripts/backup/stage-backup.sh`
  → dumps into `/opt/bozorliii/backups/`, keeps 4 days.
- **Mac**, every 6h (launchd `uz.bozorliii.backup.plist` → `~/Backups/bozorliii/backup.sh`,
  a copy of `scripts/backup/local-pull.sh`)
  → rsyncs the CORE staging dir down (catch-up) + takes its own verified
    snapshot + pulls both `.env` files. macOS notification on failure.

Check health:

```bash
tail -20 ~/Backups/bozorliii/.logs/backup.log
ls -la ~/Backups/bozorliii/latest/
```

---

## Restore onto a fresh server

Assume a new Ubuntu 24.04 droplet, single-server layout (`docker-compose.prod.yml`).
For the 2-server split, do the CORE steps on the CORE box and WEB steps on the WEB box.

```bash
# 0. on the Mac — copy the artefacts up
scp ~/Backups/bozorliii/latest/db.sql.gz \
    ~/Backups/bozorliii/latest/uploads.tar.gz \
    ~/Backups/bozorliii/latest/core.env \
    root@<NEW_CORE_IP>:/root/

# 1. on the new server — install Docker, clone, restore .env
curl -fsSL https://get.docker.com | sh
git clone https://github.com/miraziz-Developer/topdm.uz.git /opt/bozorliii
cd /opt/bozorliii
cp /root/core.env .env            # (web.env on the WEB box)

# 2. bring up just the database first
docker compose -f docker-compose.core.yml up -d postgres redis
sleep 10

# 3. restore the database
DB_USER=$(grep -E '^POSTGRES_USER=' .env | head -1 | cut -d= -f2-)
DB_NAME=$(grep -E '^POSTGRES_DB=' .env | head -1 | cut -d= -f2-)
gunzip -c /root/db.sql.gz | docker exec -i bozorliii-postgres-1 psql -U "$DB_USER" -d "$DB_NAME"

# 4. restore uploaded media into the named volume
docker run --rm -v bozorliii_bozor_uploads:/data -v /root:/backup alpine \
  sh -c 'cd /data && tar xzf /backup/uploads.tar.gz'

# 5. bring up the rest
docker compose -f docker-compose.core.yml up -d --build
curl -s localhost:8000/health

# 6. WEB box
#    cp web.env .env ; docker compose -f docker-compose.web.yml up -d --build

# 7. repoint DNS (bozorliii.online / api / crm / admin) at the new IP(s)
```

### Re-arm the backups on the new server

```bash
mkdir -p /opt/bozorliii/.logs
( crontab -l 2>/dev/null; \
  echo '20 */6 * * * /opt/bozorliii/scripts/backup/stage-backup.sh >> /opt/bozorliii/.logs/stage-backup.log 2>&1' \
) | crontab -
```

Add the Mac's backup public key (`~/.ssh/bozorliii_backup_key.pub`) to the new
server's `/root/.ssh/authorized_keys`, then update `CORE_HOST` / `WEB_HOST` in
`~/Backups/bozorliii/backup.sh` on the Mac.

---

## Restore a single 6-hourly dump (point-in-time)

```bash
ls ~/Backups/bozorliii/server-stage/          # pick a db-<ts>.sql.gz
gunzip -c ~/Backups/bozorliii/server-stage/db-<ts>.sql.gz \
  | docker exec -i bozorliii-postgres-1 psql -U <user> -d <db>
```
