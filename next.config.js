const { withSentryConfig } = require('@sentry/nextjs')

// PWA: vanilla service worker public/sw.js (PR-PWA-2, 3 May 2026)
// 29 Apr 2026 incident sonrası next-pwa wrapper'ı kaldırıldı; SW elle yazılı,
// ServiceWorkerRegister component register ediyor.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // X-Powered-By header'ını kaldır (bilgi sızdırma önleme)
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: ['172.16.16.33:3000', 'localhost:3000', 'hub.ilerigroup.com'],
      bodySizeLimit: '50mb',
    },
    // Build belleğini düşür (Next 15) — CI OOM hafifletme
    webpackMemoryOptimizations: true,
  },
  // Eski Arşiv URL'lerini yeni route group konumuna yönlendir
  // /dashboard/arsiv/* → /arsiv/*  (PR-ArsivHotfix-Sidebar, 28 Nis 2026)
  async redirects() {
    return [
      {
        source: '/dashboard/arsiv',
        destination: '/arsiv/koli',
        permanent: false,
      },
      {
        source: '/dashboard/arsiv/:path*',
        destination: '/arsiv/:path*',
        permanent: false,
      },
      // EL-1: Üretim terminali (dashboard) route group'undan bağımsız
      // /terminal grubuna taşındı. Eski URL'ler kırılmasın.
      {
        source: '/uretim/terminal',
        destination: '/terminal/uretim',
        permanent: false,
      },
      {
        source: '/uretim/terminal/:path*',
        destination: '/terminal/uretim/:path*',
        permanent: false,
      },
    ];
  },
  // Güvenlik header'ları
  async headers() {
    return [
      {
        // Tüm sayfalar için güvenlik header'ları
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // Clickjacking koruması
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // MIME type sniffing koruması
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            // PR-JOBAPP-CAMERA-AND-SUCCESS: camera=(self) — job-application
            // formundaki FormCameraCapture component'i getUserMedia çağırıyor.
            value: 'camera=(self), microphone=(), geolocation=(self), interest-cohort=()',
          },
          {
            // Content Security Policy
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js için gerekli
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com wss: ws:",
              "frame-ancestors 'self'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
}

// Sentry konfigürasyonu
const sentryWebpackPluginOptions = {
  // Source maps yükleme için token (CI'da set edilmeli)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Organizasyon ve proje slug'ları
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source maps'leri gizle
  hideSourceMaps: true,

  // Telemetry'yi devre dışı bırak
  telemetry: false,

  // Build sırasında hata vermesin (token yoksa)
  silent: !process.env.SENTRY_AUTH_TOKEN,
}

// Sentry webpack plugin (source-map üretimi/upload) build'de bellek canavarıdır.
// SENTRY_AUTH_TOKEN yoksa (CI'da ve mevcut prod .env'de yok) source-map upload
// zaten yapılmıyordu → plugin'i TAMAMEN atla; CI + prod build belleğini düşürür.
// Runtime Sentry SDK (instrumentation/sentry.*.config) bundan etkilenmez.
module.exports = process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig

