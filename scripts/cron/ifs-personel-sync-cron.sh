#!/usr/bin/env bash
# Hub → IFS personel senkronu — GÜNLÜK tam tarama (cron sarmalayıcı).
#
#   /etc/cron.d/ilerihub-cron:  30 3 * * * rokunet /home/rokunet/scripts/ifs-personel-sync-cron.sh >> /var/log/ilerihub-cron.log 2>&1
#
# Ne yapar:
#   1) Deploy kilidi tutuluyorsa (fuser) ÇALIŞMAZ — slot değişirken yarım senkron olmasın; ATLANDI yazar.
#   2) POST /api/cron/ifs-personel-sync?tam=1 — şema (ORG/POZISYON/LABOR_CLASS) + tüm aktif ILR siciller
#      (EMPLOYEE/SF); ATLA kuralları ve EMPLOYEE_PASIF_DESTEKLI koddadır, burada bayrak yok.
#      Aktör: IFS_SYNC_AKTOR_ID ('sistem'). Hedef host .env.local IFS_* ile belirlenir (ifscloudtest / ILER2).
#   3) Log: ~/logs/ifs-personel-sync/YYYY-MM-DD.log (özet + hata satırları), yanına YYYY-MM-DD.json (tam yanıt).
#      30 günden eski log/json silinir.
#   4) HATA>0 → log'da KIRMIZI özet; in-app bildirim sunucu tarafında (route) düşer.
#   Kuru koşu: DRY=1 ~/scripts/ifs-personel-sync-cron.sh  (IFS'e yazmaz, bildirim yok)
#
# Secret cron dosyasına YAZILMAZ; çalışma anında aktif slot .env'inden okunur.
set -uo pipefail

LOG_DIR=/home/rokunet/logs/ifs-personel-sync
LOCKFILE=/var/lock/ilerihub-deploy.lock
ENV_FILE=/home/rokunet/projects/ilerihub/.env
URL_BASE="https://hub.ilerigroup.com/api/cron/ifs-personel-sync"
GUN=$(date +%F)
LOG="$LOG_DIR/$GUN.log"
JSON="$LOG_DIR/$GUN.json"
KIRMIZI=$'\e[31m'; SIFIR=$'\e[0m'
DRY=${DRY:-0}

mkdir -p "$LOG_DIR"; chmod 700 "$LOG_DIR"
log() { echo "[$(date -Is)] $*" | tee -a "$LOG"; }

# 30 gün rotasyon
find "$LOG_DIR" -type f \( -name '*.log' -o -name '*.json' \) -mtime +30 -delete 2>/dev/null || true

# (1) deploy kilidi
if [ -e "$LOCKFILE" ] && fuser "$LOCKFILE" >/dev/null 2>&1; then
  log "ATLANDI — deploy kilidi tutuluyor ($LOCKFILE), senkron bu gece koşmadı"
  exit 0
fi

S=$(grep -m1 '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
[ -n "$S" ] || { log "${KIRMIZI}HATA — CRON_SECRET okunamadı ($ENV_FILE)${SIFIR}"; exit 1; }

URL="$URL_BASE?tam=1"; [ "$DRY" = "1" ] && URL="$URL&dryRun=1"
log "BAŞLADI tam=1 dry=$DRY"
HTTP=$(curl -sS -o "$JSON" -w '%{http_code}' --max-time 900 -X POST -H "x-cron-secret: $S" \
  --resolve hub.ilerigroup.com:443:127.0.0.1 "$URL" 2>>"$LOG") || { rc=$?; log "${KIRMIZI}CRON-FAIL curl=$rc http=${HTTP:-}${SIFIR}"; exit 1; }
chmod 600 "$JSON" 2>/dev/null || true

if [ "$HTTP" != "200" ]; then
  log "${KIRMIZI}HATA — HTTP $HTTP: $(head -c 300 "$JSON")${SIFIR}"
  exit 1
fi

# Özet + hata satırları (jq varsa; yoksa ham ilk 300 karakter)
if command -v jq >/dev/null 2>&1; then
  OZET=$(jq -r '"yazıldı \(.ozet.yazildi // 0) · hata \(.ozet.hata // 0) · atlandı \(.ozet.atlandi // 0) · noop \(.ozet.noop // 0) · host=\(if .hostTest then "test" else "PROD" end)"' "$JSON" 2>/dev/null || echo '?')
  HATA=$(jq -r '.ozet.hata // 0' "$JSON" 2>/dev/null || echo 0)
  jq -r '.planOzeti // empty' "$JSON" 2>/dev/null | sed 's/^/    /' >> "$LOG"
  if [ "${HATA:-0}" -gt 0 ]; then
    log "${KIRMIZI}HATA>0 — $OZET${SIFIR}"
    jq -r '.hatalar[]? | "    ✗ \(.varlik) \(.anahtar): \(.hata)"' "$JSON" 2>/dev/null | tee -a "$LOG"
    exit 2
  fi
  log "TAMAM — $OZET"
else
  log "TAMAM (jq yok) — $(head -c 300 "$JSON")"
fi
