import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Tracing konfigürasyonu
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay (opsiyonel)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Development ortamında debug mod
  debug: process.env.NODE_ENV === 'development',

  // Hata filtreleme
  beforeSend(event) {
    // Kişisel bilgileri temizle
    if (event.user) {
      delete event.user.ip_address
    }
    return event
  },

  // Ortam bilgisi
  environment: process.env.NODE_ENV,

  // Uygulama release versiyonu
  release: process.env.npm_package_version,
})
