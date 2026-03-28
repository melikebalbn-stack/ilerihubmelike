const { withSentryConfig } = require('@sentry/nextjs')

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  customWorkerSrc: 'service-worker',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
        },
      },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\/_next\/static.+\.js$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-static-js-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-style-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      // Dosya yükleme API'leri - cache'leme yok
      urlPattern: /\/api\/iso27001\/controls\/.*\/evidences/i,
      handler: 'NetworkOnly',
    },
    {
      // Diğer API'ler
      urlPattern: /\/api\/.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'apis',
        networkTimeoutSeconds: 60, // 10'dan 60 saniyeye çıkarıldı
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
  ],
})

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
            value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
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

module.exports = withSentryConfig(withPWA(nextConfig), sentryWebpackPluginOptions)
