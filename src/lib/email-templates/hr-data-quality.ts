import type { AuditCategory } from '@/lib/hr-data-quality'

// Personel Veri Kalitesi Raporu maili. Kurumsal yerleşim (layout.ts, üst şerit
// "İnsan Varlıkları"). Kategori boşsa gösterilmez (çağıran zaten boşları elemiş olur).

import { renderEmail, p, dataTable, sectionTitle, TOKENS } from '@/lib/email-templates/layout'

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function tarihTR(): string {
  return new Date().toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul',
  })
}

export function buildHrDataQualityMailHtml(kategoriler: AuditCategory[]): string {
  const tarih = tarihTR()
  const toplam = kategoriler.reduce((s, k) => s + k.kayitlar.length, 0)

  const kategoriBloklari = kategoriler
    .map(
      (kat) =>
        sectionTitle(kat.baslik, String(kat.kayitlar.length)) +
        dataTable(
          ['Sicil', 'Ad Soyad', 'Eksik / Detay'],
          kat.kayitlar.map((r) => [
            `<span style="white-space:nowrap;">${escapeHtml(r.sicil)}</span>`,
            escapeHtml(r.adSoyad),
            `<span style="color:${TOKENS.muted};">${escapeHtml(r.detay)}</span>`,
          ]),
        ),
    )
    .join('')

  return renderEmail({
    module: 'İnsan Varlıkları',
    title: 'Personel veri kalitesi raporu',
    subtitle: `${tarih} · ${toplam} sorun, ${kategoriler.length} kategori`,
    preheader: `Haftalık denetim: ${toplam} sorun, ${kategoriler.length} kategori`,
    bodyHtml: p(
      `Haftalık otomatik denetimde <strong>${toplam} sorun</strong> (${kategoriler.length} kategori) tespit edildi. Detaylar aşağıdadır.`,
    ),
    afterHtml:
      kategoriBloklari +
      p(`<strong>Özet:</strong> Toplam ${toplam} sorun, ${kategoriler.length} kategori.`),
    footnote: 'Haftalık İK veri kalitesi denetimi.',
  })
}

export function buildHrDataQualityMailText(kategoriler: AuditCategory[]): string {
  const tarih = tarihTR()
  const toplam = kategoriler.reduce((s, k) => s + k.kayitlar.length, 0)
  const lines: string[] = []
  lines.push(`PERSONEL VERİ KALİTESİ RAPORU — ${tarih}`)
  lines.push(`Toplam ${toplam} sorun, ${kategoriler.length} kategori.`)
  lines.push('')
  for (const kat of kategoriler) {
    lines.push(`== ${kat.baslik} (${kat.kayitlar.length}) ==`)
    for (const r of kat.kayitlar) {
      lines.push(`  ${r.sicil} | ${r.adSoyad} | ${r.detay}`)
    }
    lines.push('')
  }
  lines.push(`Özet: Toplam ${toplam} sorun, ${kategoriler.length} kategori.`)
  return lines.join('\n')
}
