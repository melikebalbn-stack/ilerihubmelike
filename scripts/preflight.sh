#!/usr/bin/env bash
# preflight.sh — Hub deploy öncesi hafif kapılar.
#
# KAPI: ortak e-posta şablonu. src altında `sendEmail(` çağıran ama aynı dosyada
# renderEmail / renderEmailHtml / akademiMail import ETMEYEN dosyaları listeler.
# Bunlar inline/düz-metin HTML üreten "ortak şablon dışı" mail gönderimleridir.
#
# ŞİMDİLİK UYARI (exit 0). Liste boşaldığında aşağıdaki `MODE=error` satırını açıp
# UYARI'yı HATA'ya çevireceğiz (çıkış 1) — regresyon kapısı olur.
#   TODO(email-standardizasyon): 7 düz-metin modül (ipro/kalite-bildirim,
#   yillik-calisma-takvimi/notifications, ldap-sync, tasks/atama-bildirimi,
#   tasks/check-notifications, personnel/check-evaluations, cron/fif-hatirlatma)
#   ortak şablona geçince MODE=error yap.
set -euo pipefail

cd "$(dirname "$0")/.."

MODE="warn"   # liste boşalınca: MODE="error"

echo "── preflight: ortak e-posta şablonu kapısı ──"

# sendEmail( çağıran dosyalar (test ve email.ts'in kendisi hariç)
mapei=$(grep -rln "sendEmail(" src 2>/dev/null | grep -v -- '-test\.' | grep -v '\.test\.' | grep -v 'src/lib/email.ts' | sort -u)

ihlal=()
for f in $mapei; do
  # Ortak şablon kullanımı: doğrudan renderEmail(Html)/akademiMail, VEYA bir
  # email-templates/ şablon modülünden içerik (o modül renderEmailHtml üretir).
  if ! grep -qE "renderEmailHtml|renderEmail\b|akademiMail|email-templates/" "$f"; then
    ihlal+=("$f")
  fi
done

if [ ${#ihlal[@]} -eq 0 ]; then
  echo "  ✓ ortak şablon dışı mail dosyası kalmadı."
  exit 0
fi

echo "  ortak şablon dışı (inline/düz-metin) mail gönderen ${#ihlal[@]} dosya:"
for f in "${ihlal[@]}"; do echo "    - $f"; done

if [ "$MODE" = "error" ]; then
  echo "  ✗ HATA: yukarıdaki dosyalar renderEmail() ortak şablonunu kullanmalı."
  exit 1
fi

echo "  ⚠ UYARI (şimdilik geçiyor). Hedef: liste boşalınca MODE=error."
exit 0
