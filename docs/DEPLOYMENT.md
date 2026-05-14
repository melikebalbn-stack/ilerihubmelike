# ILERIHub Deployment Runbook

Son güncelleme: 2026-05-14 (Faz 2.1 — PR-FAZ-2.1-PROD-ECOSYSTEM-MIGRATE)

## Mimari

3 ortam, hepsi aynı sunucuda (172.16.16.33), tamamı PM2 ecosystem'de yönetiliyor:

| Ortam | Path | PM2 name | Port | DB | Domain |
|---|---|---|---|---|---|
| **Production (blue)** | `/home/rokunet/projects/ilerihub` | `ilerihub-blue` | 3000 | `ilerihub` | hub.ilerigroup.com |
| **Production (green)** | `/home/rokunet/projects/ilerihub-green` | `ilerihub-green` | 3002 | `ilerihub` (aynı, paylaşılır) | hub.ilerigroup.com (switch'le) |
| **Staging** | `/home/rokunet/projects/ilerihub-staging` | `ilerihub-staging` | 3001 | `ilerihub_staging` (her gece 06:00 prod'dan sync) | staging.hub.ilerigroup.com |

**PM2 config:** `/home/rokunet/projects/ecosystem.config.js` — 3 process. `pm2 save` ile boot survive.

**Shared uploads:** `/home/rokunet/shared/uploads/` — 3 ortamın `public/uploads`'ı buraya symlink.

**Nginx upstream:** `/etc/nginx/conf.d/ilerihub-upstream.conf` — `upstream ilerihub_pool` tek aktif server (blue VEYA green). Vhost (`hub.ilerigroup.com`) `proxy_pass http://ilerihub_pool` ile bu pool'a bağlı.

## Yardımcı scriptler

| Script | Açıklama |
|---|---|
| `/home/rokunet/scripts/status.sh` | PM2 + port health + nginx aktif renk + disk + symlink doğrulaması |
| `/home/rokunet/scripts/deploy.sh [--switch]` | Pasif renkte git pull + build + PM2 reload |
| `/home/rokunet/scripts/rollback.sh` | Aktif↔pasif renk arası nginx upstream switch (hedef DOWN'sa iptal) |
| `/home/rokunet/scripts/staging-db-sync.sh` | Cron 06:00 — prod DB → staging DB |

## Normal deploy akışı

```bash
# 1. Pasif renkte (aktif değil olan) git pull + build + reload
/home/rokunet/scripts/deploy.sh

# 2. Manuel test (pasif port'ta)
# Eğer aktif=blue (port 3000), test http://127.0.0.1:3002/
# Eğer aktif=green (port 3002), test http://127.0.0.1:3000/

# 3. Sağlıklıysa switch
/home/rokunet/scripts/rollback.sh   # aslında "switch" — adı yanıltıcı, hedef tarafa geçer

# 4. Doğrula
/home/rokunet/scripts/status.sh
```

## Rollback (acil)

`rollback.sh` her zaman aktif renkten pasif renge geçer. Hedef sağlık kontrolü
başarısızsa iptal eder (mevcut aktif kalır):

```bash
/home/rokunet/scripts/rollback.sh
```

İçeride atomic akış:
1. Upstream config'i oku, aktif port → renk mapping
2. Hedef port'a curl health check
3. Upstream config'i sed ile değiştir (server satırını swap)
4. `nginx -t` + `systemctl reload nginx`
5. Doğrulama curl

## Database migration disiplini

**Detaylı kurallar + senaryolar:** [MIGRATION-RULES.md](./MIGRATION-RULES.md) — Expand → Migrate → Contract pattern, 5 senaryo, pre-deploy checklist, bilinen tuzaklar.

Blue ve green **aynı prod DB'yi** paylaşır. Migration yapılırken **geri uyumluluk** kritik:

1. **Eklemeler güvenli:** Yeni tablo, yeni nullable kolon, yeni index → blue+green ikisi de çalışır.
2. **Riskli değişiklikler:** Kolon silme, kolon adı değiştirme, NOT NULL ekleme, FK değiştirme → **iki aşamalı**:
   - **Aşama 1:** Migration (eski + yeni alan birlikte) + kod hem ikisini de okur/yazar. Deploy edip her iki rengi sync'le.
   - **Aşama 2:** Eski alan kullanımını koddan kaldır, deploy. Sonra ayrı migration ile eski alanı drop et.
3. **Enum değişiklikleri:** PostgreSQL `ALTER TYPE ADD VALUE` non-transactional — migration tek başına çalışır, kod sonra deploy edilir.
4. **Index**: `CREATE INDEX CONCURRENTLY` ile online; downtime yok.

Migration'ları staging'de test et (her gece 06:00 prod sync'i mevcut schema'yı taşır).

## Public uploads (shared)

`/home/rokunet/shared/uploads/` — her yeni klonda symlink kur:

```bash
rm -rf /home/rokunet/projects/ilerihub-YYY/public/uploads
ln -s /home/rokunet/shared/uploads /home/rokunet/projects/ilerihub-YYY/public/uploads
```

Aksi halde her renk kendi uploads'ını tutar → tutarsızlık.

## Snapshot dizinleri (rollback için arşiv)

| Dizin | Aşama |
|---|---|
| `/home/rokunet/backups/pre-staging-setup-20260514-074020/` | Faz 1 öncesi |
| `/home/rokunet/backups/pre-bluegreen-20260514-090345/` | Faz 2 öncesi (uploads + green klonu) |
| `/home/rokunet/backups/pre-faz2.1-20260514-174904/` | Faz 2.1 öncesi (ecosystem migration) |

## Bilinen sınırlar / Faz 3 sıradakiler

- **Migration discipline pekiştirme**: örnek PR senaryosu (örn. kolon rename) ile end-to-end test
- **Disk takip**: `df -h` haftada kontrol; %90'ı aşarsa `npm cache clean --force` + `.next/cache` temizliği
- **Git pull credentials**: `deploy.sh` git pull HTTPS için `gh auth status` veya SSH key gerek (ilk deploy'da netleşir)
- **pnpm workspaces**: 3 klon × 1.4GB node_modules duplicate. Faz 3'te hoist edilebilir (~3GB kazanç)

<!-- deploy test: 2026-05-14T18:06:57Z -->
