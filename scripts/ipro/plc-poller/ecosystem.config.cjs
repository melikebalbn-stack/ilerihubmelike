/**
 * PM2 konfigürasyonu — IPRO PLC Poller (bağımsız process, Next.js'ten ayrı).
 * BAŞLATMA: bu dosyayı Melih çalıştıracak. Örn:
 *   pm2 start scripts/ipro/plc-poller/ecosystem.config.cjs
 *
 * DATABASE_URL cwd'deki .env'den okunur (poller `import 'dotenv/config'` yapar).
 * Prod'da .env'in DOĞRU DB'yi gösterdiğini Melih doğrulayacak.
 */
const path = require('path')
const root = path.resolve(__dirname, '../../..') // scripts/ipro/plc-poller → proje kökü

module.exports = {
  apps: [
    {
      name: 'ilerihub-ipro-poller',
      script: path.join(__dirname, 'index.ts'),
      interpreter: path.join(root, 'node_modules/.bin/tsx'),
      cwd: root, // .env buradan yüklenir
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        IPRO_POLLER_PORT: '3020',
        IPRO_POLLER_INTERVAL_MS: '5000',
        // IPRO_POLLER_DEBUG: '1',  // delta debug logları için
      },
    },
  ],
}
