# Cron Yönetimi — ILERIHub

ILERIHub'ın zamanlanmış görevleri (notification mailleri, hatırlatmalar,
periyodik kontroller) **sistem-seviye cron** ile tetiklenir.

## Neden Sistem Cron?

Önceki yaklaşım `node-cron` ile in-process schedule idi
(`src/lib/cron.ts`). Sorun: PM2 restart sonrası in-memory schedule
sıfırlanıyor, manuel olarak `/api/cron/init` çağrılana kadar tüm
cron'lar uyuyor. 2026-05-02 ile 2026-05-04 arası personel evaluation
mailleri bu sebeple gitmedi.

Çözüm: Linux `cron` daemon — PM2'den bağımsız, sistem reboot sonrası
otomatik başlar, log'lu.

Auto-bootstrap (Next.js instrumentation.ts) denendi, **build pipeline'ı
kırdığı için geri alındı** (240+ crash loop, 2026-05-04).

## Konum

- **Config:** `/etc/cron.d/ilerihub-cron` (sunucuda, repo dışı)
- **Log:** `/var/log/ilerihub-cron.log`
- **Owner:** `rokunet`

## Aktif Schedule'lar

| Saat | Endpoint | Görev |
|---|---|---|
| 09:00 | POST `/api/calibration/check-notifications` | Kalibrasyon hatırlatması |
| 09:15 | GET `/api/tasks/check-notifications` | Görev hatırlatması |
| 09:30 | GET `/api/tasks/check-escalation` | Görev eskalasyonu |
| 09:45 | POST `/api/personnel/check-evaluations` | Personel 2ay/6ay değerlendirme + belge süreleri |
| 10:00 | POST `/api/akademi/cron/check-deadlines` | Akademi son tarih kontrolü |
| 10:30 | POST `/api/akademi/cron/check-certificates` | Akademi sertifika geçerlilik |

Akademi endpoint'leri `x-cron-secret` header'ı ile auth.
Diğerleri internal localhost erişimine açık.

## Bakım Komutları

### Mevcut config'i göster
```bash
sudo cat /etc/cron.d/ilerihub-cron
```

### Son cron log'larını izle
```bash
sudo tail -50 /var/log/ilerihub-cron.log
sudo tail -f /var/log/ilerihub-cron.log  # canlı
```

### Cron daemon durumu
```bash
sudo systemctl status cron
```

### Config değişikliği sonrası reload
```bash
sudo systemctl reload cron
# veya: sudo service cron reload
```

### Manuel tetikleme (test için)
```bash
# Lokal test
curl -sX POST http://localhost:3000/api/personnel/check-evaluations

# Sertifika kontrolü (secret gerekli)
SECRET=$(grep ^CRON_SECRET /home/rokunet/projects/ilerihub/.env | cut -d= -f2)
curl -sX POST -H "x-cron-secret: $SECRET" \
  http://localhost:3000/api/akademi/cron/check-deadlines
```

## Yeni Cron Job Ekleme

1. Endpoint'i yaz (idempotent olmalı — duplicate run zarar vermesin)
2. `/etc/cron.d/ilerihub-cron` dosyasına yeni satır ekle
3. `sudo systemctl reload cron`
4. Bu dokümandaki tabloya ekle
5. Test için manuel curl ile çağır, log'u kontrol et

## Sorun Giderme

### Mail gitmiyor
1. Cron çalıştı mı? `sudo tail /var/log/ilerihub-cron.log`
2. Endpoint manuel çalışıyor mu? `curl ...`
3. SMTP env değişkenleri tanımlı mı? `grep SMTP .env`
4. NotificationLog tablosunda kayıt var mı, status nedir?

### Cron çalışıyor ama 401/403 dönüyor
- Akademi endpoint'lerinde `x-cron-secret` header'ı eksik veya yanlış
- `.env` içindeki `CRON_SECRET` değeri ile config'deki secret eşleşmeli

### Cron çift çalışıyor
- In-process cron (`src/lib/cron.ts`) tekrar etkinleştirilmiş olabilir
- `/api/cron/init` GET çağrısı yapılmamalı — sistem cron tek tetikleyici olmalı
- isSchedulerInitialized guard çift register'ı önler ama yine de teyit et:
  `pm2 logs ilerihub | grep "All notification schedulers initialized"`
  → 1 kere görünmeli, restart sonrası 0 (sistem cron geçişinde tekrar 1 olmaz)

## İlgili Kodlar

- `src/lib/cron.ts` — DEPRECATED, in-process schedule mantığı
- `src/app/api/cron/init/route.ts` — DEPRECATED, manuel debug için
- `src/app/api/personnel/check-evaluations/route.ts` — endpoint
- `src/app/api/akademi/cron/check-*/route.ts` — Akademi endpoint'leri

## Geçmiş

- **2026-05-04:** node-cron in-process'ten sistem cron'a taşındı.
  PM2 restart kaynaklı 3 günlük mail kaybı (3-4 Mayıs personel
  evaluation) bu değişiklikle çözüldü.
- **Auto-bootstrap denemesi:** Aynı tarihte instrumentation.ts hook'u
  ile auto-init denendi, Next.js v15 build pipeline'ını kırdı,
  geri alındı.
