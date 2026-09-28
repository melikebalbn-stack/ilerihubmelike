/**
 * KALITE modülü özel tipografisi — global Inter'i etkilemez.
 * CSS variable olarak expose edilir; Tailwind config'te
 * `font-quality` ve `font-quality-mono` utility'lerine bağlanır.
 *
 * Sadece `src/app/(dashboard)/kalite/layout.tsx` üzerinden sarılan
 * KALITE sayfaları (sablonlar / raporlar / semboller) bu fontları kullanır.
 * Public verify sayfası ((dashboard) dışında) global Inter'de kalır.
 *
 * YEREL FONT (2026-09-28): next/font/google build sırasında fonts.googleapis.com'a gidiyordu; ağ
 * aksayınca deploy build'i düştü. Aynı aile ve ağırlıklar @fontsource paketlerinden (latin + latin-ext
 * dahil tüm alt kümeler, unicode-range ile yalnız gereken indirilir; font-display: swap — aynı).
 * Değişken adları aynı kaldı (--font-quality-sans / --font-quality-mono) — tailwind.config değişmedi.
 */
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import './quality-fonts.css'

/** CSS değişkenlerini tanımlayan sınıf (quality-fonts.css) — layout alt ağacına uygular. */
export const qualityFontVars = 'kalite-font-degiskenleri'
