import type { AuditCategory } from '@/lib/hr-data-quality'

// Personel Veri Kalitesi Raporu maili. Outlook-uyumlu (role="presentation" + inline style).
// Navy (#1B4F72) header. Kategori boşsa gösterilmez (çağıran zaten boşları elemiş olur).

const NAVY = '#1B4F72'

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

  const kategoriBloklari = kategoriler.map((kat) => {
    const satirlar = kat.kayitlar.map((r, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f4f7fa'
      return `<tr>
        <td style="padding:7px 12px;border-bottom:1px solid #e5e9ef;background:${bg};font-size:13px;color:#2d3748;white-space:nowrap;">${escapeHtml(r.sicil)}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #e5e9ef;background:${bg};font-size:13px;color:#2d3748;">${escapeHtml(r.adSoyad)}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #e5e9ef;background:${bg};font-size:13px;color:#5a6a7d;">${escapeHtml(r.detay)}</td>
      </tr>`
    }).join('')

    return `<tr><td style="padding:22px 0 8px 0;">
      <div style="font-size:15px;font-weight:bold;color:${NAVY};border-left:4px solid ${NAVY};padding-left:10px;">
        ${escapeHtml(kat.baslik)} <span style="font-weight:normal;color:#8795a5;">(${kat.kayitlar.length})</span>
      </div>
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px;">
        <tr>
          <th align="left" style="padding:7px 12px;background:${NAVY};color:#ffffff;font-size:12px;font-weight:600;white-space:nowrap;">Sicil</th>
          <th align="left" style="padding:7px 12px;background:${NAVY};color:#ffffff;font-size:12px;font-weight:600;">Ad Soyad</th>
          <th align="left" style="padding:7px 12px;background:${NAVY};color:#ffffff;font-size:12px;font-weight:600;">Eksik / Detay</th>
        </tr>
        ${satirlar}
      </table>
    </td></tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:${NAVY};padding:24px 28px;">
          <div style="color:#ffffff;font-size:19px;font-weight:bold;">Personel Veri Kalitesi Raporu</div>
          <div style="color:#c5d4e3;font-size:13px;margin-top:4px;">İleri Group · İnsan Varlıkları · ${escapeHtml(tarih)}</div>
        </td></tr>
        <tr><td style="padding:20px 28px 8px 28px;">
          <div style="font-size:14px;color:#2d3748;line-height:1.6;">
            Haftalık otomatik denetimde <strong style="color:${NAVY};">${toplam} sorun</strong>
            (${kategoriler.length} kategori) tespit edildi. Detaylar aşağıdadır.
          </div>
        </td></tr>
        <tr><td style="padding:0 28px 8px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${kategoriBloklari}</table>
        </td></tr>
        <tr><td style="padding:18px 28px 24px 28px;">
          <div style="background:#f4f7fa;border-radius:6px;padding:14px 16px;font-size:13px;color:#2d3748;">
            <strong style="color:${NAVY};">Özet:</strong> Toplam ${toplam} sorun, ${kategoriler.length} kategori.
          </div>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e9ef;font-size:12px;color:#8795a5;text-align:center;">
          Bu e-posta ILERIHub tarafından otomatik oluşturulmuştur (haftalık İK veri kalitesi denetimi).
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
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
