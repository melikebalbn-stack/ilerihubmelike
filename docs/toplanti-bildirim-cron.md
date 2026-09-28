# Toplantı karar gecikme cron'u — HAZIRLIK (henüz EKLENMEDİ)

Uç: `POST /api/cron/toplanti-karar-gecikme`
Sıklık: **günde 1, sabah 07:00** (fif-hatirlatma 06:00, personnel/check-evaluations 09:45 —
aralarına girip yükü dağıtır).

## /etc/cron.d/ilerihub-cron içine eklenecek satır

`<SECRET>` yerine `CRON_SECRET` değeri konur; **satır loglanırken secret maskelenmelidir**
(`sed -E 's/x-cron-secret: [a-f0-9]+/x-cron-secret: ***/'`).

```
0 7 * * * rokunet { curl -sS --fail-with-body -w '\n[\%{http_code}] toplanti-karar-gecikme\n' -X POST -H "x-cron-secret: <SECRET>" --resolve hub.ilerigroup.com:443:127.0.0.1 https://hub.ilerigroup.com/api/cron/toplanti-karar-gecikme || { rc=$?; echo "[$(date -Is)] CRON-FAIL toplanti-karar-gecikme curl=$rc"; }; } >> /var/log/ilerihub-cron.log 2>&1
```

## Devreye almadan önce kuru koşu

```
curl -sS -X POST -H "x-cron-secret: <SECRET>" \
  --resolve hub.ilerigroup.com:443:127.0.0.1 \
  'https://hub.ilerigroup.com/api/cron/toplanti-karar-gecikme?kuru=1'
```

`kuru=1` hiçbir şey YAZMAZ: ne `status` OVERDUE yapılır, ne bildirim gönderilir —
yalnız kaç karar etkileneceğini sayar.

## İlk gerçek koşuda beklenen

28.09.2026 ölçümü: 8 kararın 3'ünde `dueDate` dolu, hepsi `PENDING`, hiçbirinde sorumlu yok
(sorumlu FK hatası bugün düzeldi). Yani ilk koşuda süresi geçmiş kararlar **OVERDUE** olur
ama sorumlusuz oldukları için **bildirim çıkmaz**. Bu beklenen davranıştır — durum damgası
bildirimden bağımsızdır.
