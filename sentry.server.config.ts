import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Tracing konfigürasyonu
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Development ortamında debug mod
  debug: process.env.NODE_ENV === 'development',

  // Ortam bilgisi
  environment: process.env.NODE_ENV,

  // Uygulama release versiyonu
  release: process.env.npm_package_version,
})
