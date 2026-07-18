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
      script: 'npm',
      // HARDEN-2b: -H 127.0.0.1 → yalnız loopback'e bağlan (nginx 127.0.0.1'den
      // proxy'ler; ufw'ya ek derinlemesine savunma — port dışa açılmaz).
      args: 'start -- -H 127.0.0.1',
      exec_mode: 'fork',
      instances: 1,
      // IFS TLS: ifscloudtest.ilerigroup.com ara CA'sını (RapidSSL TLS RSA CA G1)
      // sunmuyor; Node kendi kök deposuyla zinciri kuramıyor → "fetch failed".
      // Node sistem CA deposunu (/etc/ssl/certs) okumaz, bu yüzden ek CA şart.
      env: { NODE_ENV: 'production', PORT: 3000, NODE_EXTRA_CA_CERTS: '/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem' },
      max_memory_restart: '512M',
      error_file: '/home/rokunet/.pm2/logs/ilerihub-blue-error.log',
      out_file: '/home/rokunet/.pm2/logs/ilerihub-blue-out.log',
      time: true,
      autorestart: true,
      watch: false,
    },
    {
      name: 'ilerihub-green',
      cwd: '/home/rokunet/projects/ilerihub-green',
      script: 'npm',
      args: 'start -- -H 127.0.0.1', // HARDEN-2b: loopback bind
      exec_mode: 'fork',
      instances: 1,
      // IFS TLS: bkz. blue — ara CA Node'a ayrıca verilmeli.
      env: { NODE_ENV: 'production', PORT: 3002, NODE_EXTRA_CA_CERTS: '/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem' },
      max_memory_restart: '512M',
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
