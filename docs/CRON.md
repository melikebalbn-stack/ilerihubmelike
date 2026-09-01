# Cron Yönetimi — ILERIHub

ILERIHub'ın zamanlanmış görevleri (notification mailleri, hatırlatmalar,
periyodik kontroller) **sistem-seviye cron** ile tetiklenir.

## Neden Sistem Cron?

Önceki yaklaşım `node-cron` ile in-process schedule idi
(`src/lib/cron.ts`). Sorun: PM2 restart sonrası in-memory schedule
sıfırlanıyor, manuel olarak `/api/cron/init` çağrılana kadar tüm
cron'lar uyuyor. 2026-05-02 ile 2026-05-04 arası personel evaluation
mailleri bu sebeple gitmedi.

In-process mekanizma 2026-09-01'de tamamen kaldırıldı (`src/lib/cron.ts`,
`src/app/api/cron/init/route.ts` ve `node-cron` bağımlılığı silindi).
Sistem cron artık tek tetikleyici.

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

> Adres DOMAIN olmalı — `localhost:3000` doğrudan BLUE slotunu çağırır ve o slot
> pasifken (ya da kapalıyken) yanlış/eksik sonuç verir. `--resolve` ile domain
> 127.0.0.1'e çözülür; istek nginx'ten geçip HER ZAMAN aktif slota gider.

```bash
SECRET=$(grep ^CRON_SECRET /home/rokunet/projects/ilerihub/.env | cut -d= -f2)

curl -sS --fail-with-body -X POST -H "x-cron-secret: $SECRET" \
  --resolve hub.ilerigroup.com:443:127.0.0.1 \
  https://hub.ilerigroup.com/api/personnel/check-evaluations

curl -sS --fail-with-body -X POST -H "x-cron-secret: $SECRET" \
  --resolve hub.ilerigroup.com:443:127.0.0.1 \
  https://hub.ilerigroup.com/api/akademi/cron/check-deadlines
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
- In-process cron kaldırıldı; tekrar eklenmediğini teyit et:
  `grep -rn "node-cron" src/` → boş dönmeli
- Aynı ucun `/etc/cron.d/ilerihub-cron` içinde iki satırı olabilir

## İlgili Kodlar

- `src/app/api/personnel/check-evaluations/route.ts` — endpoint
- `src/app/api/akademi/cron/check-*/route.ts` — Akademi endpoint'leri

## Geçmiş

- **2026-05-04:** node-cron in-process'ten sistem cron'a taşındı.
  PM2 restart kaynaklı 3 günlük mail kaybı (3-4 Mayıs personel
  evaluation) bu değişiklikle çözüldü.
- **2026-09-01:** In-process scheduler kalıntısı silindi. `(dashboard)/layout.tsx`
  her mount'ta `/api/cron/init` çağırdığı için node-cron sessizce yeniden
  kuruluyordu; header'sız çağrılan üç iş 401 alıyor, header'lı olanlar sistem
  cron ile çift mail üretiyordu (17.08.2026'da aynı alıcıya 3 kopya).
- **Auto-bootstrap denemesi:** Aynı tarihte instrumentation.ts hook'u
  ile auto-init denendi, Next.js v15 build pipeline'ını kırdı,
  geri alındı.
