#!/bin/bash
# nginx config deployment — repo → sistem
# Kullanım: sudo ./infrastructure/nginx/deploy.sh
#
# 1. Mevcut /etc/nginx/sites-available/hub.ilerigroup.com'u backup'lar
# 2. Repo'daki config'i kopyalar
# 3. Symlink yoksa /etc/nginx/sites-enabled/hub.ilerigroup.com oluşturur
# 4. nginx -t ile test eder; başarısız olursa rollback
# 5. systemctl reload nginx

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NGINX_SOURCE="$REPO_ROOT/infrastructure/nginx/sites-available/hub.ilerigroup.com.conf"
NGINX_TARGET="/etc/nginx/sites-available/hub.ilerigroup.com"
NGINX_ENABLED="/etc/nginx/sites-enabled/hub.ilerigroup.com"

if [ ! -f "$NGINX_SOURCE" ]; then
  echo "❌ Source config bulunamadı: $NGINX_SOURCE"
  exit 1
fi

if [ "$EUID" -ne 0 ]; then
  echo "❌ sudo ile çalıştır"
  exit 1
fi

# Backup mevcut config
BACKUP=""
if [ -f "$NGINX_TARGET" ]; then
  BACKUP="$NGINX_TARGET.backup-$(date +%Y%m%d-%H%M%S)"
  cp "$NGINX_TARGET" "$BACKUP"
  echo "📦 Backup: $BACKUP"
fi

# Kopyala
cp "$NGINX_SOURCE" "$NGINX_TARGET"
echo "✅ Config kopyalandı: $NGINX_TARGET"

# Symlink yoksa oluştur
if [ ! -L "$NGINX_ENABLED" ]; then
  ln -sf "$NGINX_TARGET" "$NGINX_ENABLED"
  echo "🔗 Symlink: $NGINX_ENABLED"
fi

# Test
if ! nginx -t; then
  echo "❌ nginx config test başarısız, rollback yapılıyor"
  if [ -n "$BACKUP" ] && [ -f "$BACKUP" ]; then
    cp "$BACKUP" "$NGINX_TARGET"
    nginx -t
    echo "↩️  Rollback tamam: $BACKUP → $NGINX_TARGET"
  fi
  exit 1
fi

# Reload
systemctl reload nginx
echo "🔄 nginx reload edildi"
echo ""
echo "Doğrulama:"
nginx -V 2>&1 | grep -o 'with-http_v2_module' && echo "  http2 modülü: ✓ (binary destekli)"
ss -tlnp 2>/dev/null | grep ':443' | head -1 || echo "  443 port dinleyici: (ss izinsiz, sudo ile bak)"
echo ""
echo "Canlı http2 testi:"
echo "  openssl s_client -alpn h2,http/1.1 -connect hub.ilerigroup.com:443 </dev/null 2>/dev/null | grep ALPN"
