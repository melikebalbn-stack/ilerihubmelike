import { ReactNode } from 'react'
import { qualityFontVars } from './quality-fonts'

/**
 * KALITE modülü için tipografi shell'i.
 *
 * Hiçbir mevcut layout/render davranışını değiştirmez — sadece yerel font
 * (@fontsource; eskiden next/font/google) CSS variable'larını alt ağaca enjekte eder ve `font-quality` utility'sini
 * default font olarak set eder. Mevcut sayfalar değişene kadar görsel etki
 * sıfırdır (Tailwind class'ları hâlâ Inter/sistem font veriyor).
 *
 * Atom componentler (sonraki commit'lerde) bilinçli olarak
 * `font-quality-mono`/`font-quality` class'larıyla bu fontlara opt-in eder.
 */
export default function QualityLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${qualityFontVars} font-quality`}
    >
      {children}
    </div>
  )
}
