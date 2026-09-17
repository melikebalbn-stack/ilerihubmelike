#!/bin/bash
# IFS personel senkronu cron satırlarını /etc/cron.d/ilerihub-cron'a ekler.
#   (A) 15 dk kuyruk boşaltma — şablonda YORUMLU gelir (17.09 kararı), açmak ayrı adım.
#   (B) 03:30 günlük tam tarama — açık.
# Kullanım:  sudo ~/scripts/cron-ifs-personel-sync-ekle.sh
# Secret .env'den okunur, ekrana YAZILMAZ ((A) yorumlu olsa da yer tutucu doldurulur; açınca hazır).
# Yedek: ilerihub-cron.bak-<tarih>. Sarmalayıcıyı ~/scripts'e kopyalar. Eski `ipro/cron/ifs-personel-sync`
# satırı zaten yorumlu, dokunulmaz.
set -euo pipefail
CRON_FILE=/etc/cron.d/ilerihub-cron
ENV_FILE=/home/rokunet/projects/ilerihub/.env
# Şablon AKTİF slottan okunur (nginx upstream: 3000=blue, 3002=green) — pasif slot eski olabilir.
AKTIF_PORT=$(grep -v '^\s*#' /etc/nginx/conf.d/ilerihub-upstream.conf | grep -oE 'server 127\.0\.0\.1:[0-9]+' | grep -oE '[0-9]+$' | head -1)
REPO=/home/rokunet/projects/ilerihub; [ "${AKTIF_PORT:-3000}" = "3002" ] && REPO=/home/rokunet/projects/ilerihub-green
SABLON=$REPO/scripts/cron/ilerihub-ifs-personel-sync.template
DAMGA=$(date +%Y-%m-%d-%H%M)
[ "$(id -u)" -eq 0 ] || { echo "root gerekli: sudo $0" >&2; exit 1; }
[ -f "$SABLON" ] || { echo "şablon yok: $SABLON (aktif slot :$AKTIF_PORT)" >&2; exit 1; }
grep -q "ifs-personel-sync-cron.sh" "$CRON_FILE" && { echo "satır zaten var — dokunulmadı"; exit 0; }
S=$(grep -m1 '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'); [ -n "$S" ] || { echo "CRON_SECRET okunamadı" >&2; exit 1; }
install -o rokunet -g rokunet -m 750 "$REPO/scripts/cron/ifs-personel-sync-cron.sh" /home/rokunet/scripts/ifs-personel-sync-cron.sh
cp -a "$CRON_FILE" "$CRON_FILE.bak-$DAMGA"; cmp -s "$CRON_FILE" "$CRON_FILE.bak-$DAMGA" || { echo "yedek doğrulanamadı" >&2; exit 1; }
{ echo; sed -n '/^# (A) IFS personel senkronu/,$p' "$SABLON" | sed "s|<CRON_SECRET>|$S|"; } >> "$CRON_FILE"
chown root:root "$CRON_FILE"; chmod 644 "$CRON_FILE"; service cron reload
echo "eklendi → $CRON_FILE (yedek: .bak-$DAMGA; şablon: $SABLON)"
echo "açık satırlar:"; grep -n 'ifs-personel-sync' "$CRON_FILE" | grep -v ':\s*#' | sed -E 's/x-cron-secret: [^"]*/x-cron-secret: ***/' | cut -c1-110
