# Nginx Config (IaC)

ILERIHub nginx configuration repo'da tutulur. Sunucu reimage edilirse veya
config kaybolursa, bu repo'dan tek komutla geri yüklenir.

## İçerik

- `sites-available/hub.ilerigroup.com.conf` — production nginx config (canlı snapshot)
- `deploy.sh` — sunucuya yükleme scripti (backup + test + rollback)

## Deployment

Sunucuda (172.16.16.33):

```bash
cd /home/rokunet/projects/ilerihub
sudo ./infrastructure/nginx/deploy.sh
```

Script şunları yapar:
1. Mevcut `/etc/nginx/sites-available/hub.ilerigroup.com`'u backup'lar (timestamp'li)
2. Repo'daki config'i kopyalar
3. Symlink yoksa `/etc/nginx/sites-enabled/hub.ilerigroup.com` oluşturur
4. `nginx -t` ile test eder
5. Başarılı olursa `systemctl reload nginx`
6. Test başarısızsa otomatik rollback

## Config güncelleme akışı

1. `infrastructure/nginx/sites-available/hub.ilerigroup.com.conf` dosyasını düzenle
2. Commit + push
3. Sunucuda `git pull && sudo ./infrastructure/nginx/deploy.sh`

## Mevcut canlı config notları

- `listen 443 ssl;` (HTTP/1.1) — http2 directive **yok**
  - Memory `nginx_http2_2026-05-08.md`'de 8 May 2026'da http2 eklendiği yazılı
  - Mevcut canlıda yok (reimage veya manuel revert sonrası kaybolmuş)
  - Yeniden eklemek için ayrı PR (PR-NGINX-HARDEN) gerekir
- Security header'ları minimal: `X-Frame-Options`, `X-Content-Type-Options`,
  `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
  - HSTS (`Strict-Transport-Security`) **yok**
  - CSP (`Content-Security-Policy`) **yok**
  - Eski `.backup` dosyasında bunlar vardı (önceki state) — sonradan
    minimize edilmiş
- SSL sertifikaları: `/etc/nginx/ssl/hub.crt` + `hub.key` (Let's Encrypt değil,
  self-signed veya internal CA — repo dışı)

## Hardening önerileri (ayrı PR)

`PR-NGINX-HARDEN` backlog item:
- `listen 443 ssl http2;` (RSC re-render performance + SSE multiplex)
- HSTS: `max-age=31536000; includeSubDomains`
- CSP: önceki `.backup`'taki content (test edilmesi gerek — `unsafe-inline`
  Next.js script execution için zorunlu)

Deploy öncesi browser DevTools console testi şart (CSP browser tarafında
catastrophic kırılma yapabilir).

## Önemli notlar

- SSL sertifikaları repo dışı (`/etc/nginx/ssl/`) — sertifika rotasyonu ayrı
- WAN portları FortiGate Trusted Hosts/Local-In Policy ile kısıtlı
- `client_max_body_size 50M` — dosya yükleme limiti
- Proxy: `http://127.0.0.1:3000` (Next.js pm2)
