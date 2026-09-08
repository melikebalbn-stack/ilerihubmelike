/**
 * ILERIHUB PM2 Ecosystem
 *
 * 3 process:
 *   - ilerihub-blue    (port 3000) — production blue
 *   - ilerihub-green   (port 3002) — production green
 *   - ilerihub-staging (port 3001) — staging
 *
 * Deploy:   /home/rokunet/scripts/deploy.sh
 * Rollback: /home/rokunet/scripts/rollback.sh
 * Status:   /home/rokunet/scripts/status.sh
 *
 * PR-FAZ-2.1-PROD-ECOSYSTEM-MIGRATE: Mevcut "ilerihub" prod process
 * burada `ilerihub-blue` olarak yönetiliyor (önceden manuel `npm start`).
 */
module.exports = {
  apps: [
    {
      name: 'ilerihub-blue',
      cwd: '/home/rokunet/projects/ilerihub',
      // PM2 DOĞRUDAN next-server'ı denetlesin (2026-09-05).
      // Eskiden `script: 'npm'` idi; süreç ağacı npm → sh -c → next-server
      // şeklindeydi ve PM2 en üstteki npm sarmalayıcısını ölçüyordu (~57 MB).
      // Bu yüzden max_memory_restart: '512M' HİÇ tetiklenmedi — asıl sunucu
      // (700-800 MB) PM2'nin görüş alanı dışındaydı. bin/next kendi süreç
      // başlığını 'next-server' yapar ve AYRICA FORK ETMEZ; bu script doğrudan
      // çalıştırılınca PM2'nin denetlediği pid = asıl sunucu olur.
      script: 'node_modules/next/dist/bin/next',
      // HARDEN-2b: -H 127.0.0.1 → yalnız loopback'e bağlan (nginx 127.0.0.1'den
      // proxy'ler; ufw'ya ek derinlemesine savunma — port dışa açılmaz).
      // `npm start` aracısı kalktığı için `--` ayracı da gerekmiyor.
      // PORT MEKANİZMASI DEĞİŞMEDİ: aşağıdaki env.PORT geçerli.
      args: 'start -H 127.0.0.1',
      // Dosyanın uzantısı yok; PM2'nin yorumlayıcı tahminine bırakılmaz.
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      // IFS TLS: ifscloudtest.ilerigroup.com ara CA'sını (RapidSSL TLS RSA CA G1)
      // sunmuyor; Node kendi kök deposuyla zinciri kuramıyor → "fetch failed".
      // Node sistem CA deposunu (/etc/ssl/certs) okumaz, bu yüzden ek CA şart.
      env: { NODE_ENV: 'production', PORT: 3000, NODE_EXTRA_CA_CERTS: '/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem' },
      // SINIR 512M -> 1536M (2026-09-05 gece, SAHA KANITIYLA).
      // 512M degeri, PM2 npm sarmalayicisini (~60 MB) olctugu donemde kondu ve
      // HIC tetiklenmedi. bin/next'e gecince PM2 asil sunucuyu olcmeye basladi
      // (~790 MB normal calisma) ve sinir ANINDA olumcul oldu: blue 3 dakikada
      // 8 kez oldurulup yeniden basladi. PM2 log'u birebir:
      //   "restarted because it exceeds --max-memory-restart value
      //    (current_memory=793694208 max_memory_limit=536870912)"
      // 1536M ~2x bas alani birakir: normal yuk altinda tetiklenmez, gercek bir
      // sizinti (kalici buyume) yine yakalanir. Kaynak baskisi yok: makinede
      // 42 GB var, iki slot toplam ~1.6 GB kullaniyor.
      max_memory_restart: '1536M',
      // FRENSİZ AUTORESTART KORUMASI (2026-09-05).
      // 23.07 green 2329 · 08.08 blue 1986 · 26.08 blue 155 restart: üçünde de
      // `.next` / `next` eksikken açılış denendi, süreç milisaniyede çöktü ve
      // autorestart saatte binlerce kez döndü. Bu ikisiyle 10 denemeden sonra
      // `errored` durumunda DURUR; arıza loglarda göze batar.
      min_uptime: '30s',
      max_restarts: 10,
      error_file: '/home/rokunet/.pm2/logs/ilerihub-blue-error.log',
      out_file: '/home/rokunet/.pm2/logs/ilerihub-blue-out.log',
      time: true,
      autorestart: true,
      watch: false,
    },
    {
      name: 'ilerihub-green',
      cwd: '/home/rokunet/projects/ilerihub-green',
      // PM2 doğrudan next-server'ı denetlesin — gerekçe için bkz. blue.
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1', // HARDEN-2b: loopback bind · port env.PORT'tan
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      // IFS TLS: bkz. blue — ara CA Node'a ayrıca verilmeli.
      env: { NODE_ENV: 'production', PORT: 3002, NODE_EXTRA_CA_CERTS: '/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem' },
      // SINIR 512M -> 1536M (2026-09-05 gece, SAHA KANITIYLA).
      // 512M degeri, PM2 npm sarmalayicisini (~60 MB) olctugu donemde kondu ve
      // HIC tetiklenmedi. bin/next'e gecince PM2 asil sunucuyu olcmeye basladi
      // (~790 MB normal calisma) ve sinir ANINDA olumcul oldu: blue 3 dakikada
      // 8 kez oldurulup yeniden basladi. PM2 log'u birebir:
      //   "restarted because it exceeds --max-memory-restart value
      //    (current_memory=793694208 max_memory_limit=536870912)"
      // 1536M ~2x bas alani birakir: normal yuk altinda tetiklenmez, gercek bir
      // sizinti (kalici buyume) yine yakalanir. Kaynak baskisi yok: makinede
      // 42 GB var, iki slot toplam ~1.6 GB kullaniyor.
      max_memory_restart: '1536M',
      // FRENSİZ AUTORESTART KORUMASI (2026-09-05).
      // 23.07 green 2329 · 08.08 blue 1986 · 26.08 blue 155 restart: üçünde de
      // `.next` / `next` eksikken açılış denendi, süreç milisaniyede çöktü ve
      // autorestart saatte binlerce kez döndü. Bu ikisiyle 10 denemeden sonra
      // `errored` durumunda DURUR; arıza loglarda göze batar.
      min_uptime: '30s',
      max_restarts: 10,
      error_file: '/home/rokunet/.pm2/logs/ilerihub-green-error.log',
      out_file: '/home/rokunet/.pm2/logs/ilerihub-green-out.log',
      time: true,
      autorestart: true,
      watch: false,
    },
    {
      name: 'ilerihub-staging',
      cwd: '/home/rokunet/projects/ilerihub-staging',
      script: 'npm',
      args: 'start -- -H 127.0.0.1', // HARDEN-2b: loopback bind
      exec_mode: 'fork',
      instances: 1,
      // IFS TLS: bkz. blue — ara CA Node'a ayrıca verilmeli.
      env: { NODE_ENV: 'production', PORT: 3001, NODE_EXTRA_CA_CERTS: '/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem' },
      max_memory_restart: '512M',
      error_file: '/home/rokunet/.pm2/logs/ilerihub-staging-error.log',
      out_file: '/home/rokunet/.pm2/logs/ilerihub-staging-out.log',
      time: true,
      autorestart: true,
      watch: false,
    },
  ],
}
