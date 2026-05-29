import { Manrope, JetBrains_Mono } from 'next/font/google'

/**
 * KALITE modülü özel tipografisi — global Inter'i etkilemez.
 * CSS variable olarak expose edilir; Tailwind config'te
 * `font-quality` ve `font-quality-mono` utility'lerine bağlanır.
 *
 * Sadece `src/app/(dashboard)/kalite/layout.tsx` üzerinden sarılan
 * KALITE sayfaları (sablonlar / raporlar / semboller) bu fontları kullanır.
 * Public verify sayfası ((dashboard) dışında) global Inter'de kalır.
 */
export const qualitySans = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-quality-sans',
  display: 'swap',
})

export const qualityMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-quality-mono',
  display: 'swap',
})
