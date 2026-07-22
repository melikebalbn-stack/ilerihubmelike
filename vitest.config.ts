import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// Ortak resolve alias (her iki projede de geçerli):
//  - '@' → src
//  - 'server-only' npm'de kurulu değil (Next.js build-time alias'lar; runtime no-op).
//    Test altında boş stub'a yönlendir → server-only'lı modüller (IFS lib) test edilebilir.
const alias = {
  '@': path.resolve(__dirname, './src'),
  'server-only': path.resolve(__dirname, './src/test/server-only-stub.ts'),
}

// IPRO entegrasyon testleri — paylaşılan dev DB'ye yazar; cron endpoint'i tabloyu GLOBAL
// tarayıp mutasyona uğratır → dosyalar paralel koşarsa birbirinin satırlarını bozar.
const IPRO_INTEGRATION = [
  'src/**/ipro/**/*.{test,spec}.{ts,tsx}',
  'src/lib/ipro/**/*.{test,spec}.{ts,tsx}',
]

const sharedTest = {
  environment: 'jsdom' as const,
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
}

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
      ],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          ...sharedTest,
          name: 'unit',
          include: [
            'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            // PLC poller saf hesap testleri (PLC/DB dokunmaz → unit'te paralel koşar).
            'scripts/ipro/plc-poller/**/*.{test,spec}.{ts,mts,cts}',
          ],
          // IPRO entegrasyon testleri buradan HARİÇ — ayrı 'integration' projesinde seri koşar.
          exclude: ['node_modules', '.next', 'dist', ...IPRO_INTEGRATION],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          ...sharedTest,
          name: 'integration',
          include: IPRO_INTEGRATION,
          exclude: ['node_modules', '.next', 'dist'],
          // Seri koş — paylaşımlı dev DB + global cron taraması çakışmasın.
          fileParallelism: false,
        },
      },
    ],
  },
})
