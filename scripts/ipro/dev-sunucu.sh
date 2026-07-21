#!/usr/bin/env bash
#
# IPRO görsel tur dev sunucusu — İKİ .env'i doğru sırayla yükler.
#
# NEDEN: IPRO kiosk iş listesi (isler) IFS ShopOrderOperations'a gider; IFS kimlikleri
# (IFS_INT_BASE_URL, IFS_CLIENT_ID, …) bu worktree'nin .env'inde DEĞİL, ilerihub-terminal/.env'de.
# Yalnız worktree .env'iyle kalkan sunucuda kiosk "iş listesi alınamadı" (503) verir.
#
# AYRICA: IFS TLS sertifikası iç CA imzalı → Node fetch'in NODE_EXTRA_CA_CERTS'e
# ihtiyacı var (yoksa "fetch failed"). Prod/pm2 süreçleri bunu env'den alıyor;
# bu script de aynı cert'i export eder.
#
# YÜKLEME SIRASI: önce IFS env (terminal), SONRA primary env (bu worktree) → çakışmada
# primary kazanır (DATABASE_URL/NEXTAUTH). NEXTAUTH_URL porta göre açıkça set edilir.
#
# Kullanım:
#   scripts/ipro/dev-sunucu.sh [PORT] [PRIMARY_ENV]
#   PORT              : varsayılan 3099
#   PRIMARY_ENV       : varsayılan <worktree>/.env
#   IFS_ENV           : ortam değişkeniyle geçilebilir (varsayılan ilerihub-terminal/.env)
#   NODE_EXTRA_CA_CERTS : ortam değişkeniyle geçilebilir (varsayılan rapidssl CA)
#
# Örnek: scripts/ipro/dev-sunucu.sh 3099
set -euo pipefail

PORT="${1:-3099}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PRIMARY_ENV="${2:-$ROOT/.env}"
IFS_ENV="${IFS_ENV:-/home/rokunet/projects/ilerihub-terminal/.env}"
IFS_CA_CERT="${NODE_EXTRA_CA_CERTS:-/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem}"

[ -f "$PRIMARY_ENV" ] || { echo "HATA: primary .env yok: $PRIMARY_ENV" >&2; exit 1; }
[ -f "$IFS_ENV" ]     || { echo "HATA: IFS .env yok: $IFS_ENV (IFS_ENV ile yol verebilirsin)" >&2; exit 1; }
[ -f "$IFS_CA_CERT" ] || { echo "HATA: IFS CA cert yok: $IFS_CA_CERT (NODE_EXTRA_CA_CERTS ile yol verebilirsin)" >&2; exit 1; }

# İki .env'i yükle: IFS önce, primary sonra (primary kazanır).
set -a
# shellcheck disable=SC1090
. "$IFS_ENV"
# shellcheck disable=SC1090
. "$PRIMARY_ENV"
set +a

# NEXTAUTH_URL'i porta sabitle (env'lerdeki değer ne olursa olsun) + IFS CA cert.
export PORT
export NEXTAUTH_URL="http://localhost:$PORT"
export NODE_EXTRA_CA_CERTS="$IFS_CA_CERT"

# Sağlık teyidi: IFS zorunlu değişkenler geldi mi?
: "${IFS_INT_BASE_URL:?IFS_INT_BASE_URL yüklenemedi — IFS_ENV yolunu kontrol et}"
: "${IFS_CLIENT_ID:?IFS_CLIENT_ID yüklenemedi}"

echo "▶ IPRO dev sunucu: port=$PORT  NEXTAUTH_URL=$NEXTAUTH_URL"
echo "  primary env: $PRIMARY_ENV"
echo "  IFS env    : $IFS_ENV  (IFS_INT_BASE_URL yüklendi ✓)"
echo "  IFS CA     : $NODE_EXTRA_CA_CERTS"

cd "$ROOT"
exec npx next dev -p "$PORT"
