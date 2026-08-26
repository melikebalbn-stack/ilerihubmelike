// Öneri sistemi mailleri — hr-basvuru.ts DESENİ: ortak iskelet + tip başına ince sarmalayıcı.
// Ortak yardımcılar (escapeHtml / ileriHubUrl) paylaşılan _base'ten gelir; yeni altyapı YOK.
//
// Şu an tek tip var: (b) yönetici onayladı → Öneri Kurulu değerlendirmesi bekleniyor.
// Diğer iki bildirim (a) ve (c) yalnız uygulama içi; mail göndermezler.

import { escapeHtml, ileriHubUrl } from '@/lib/email-templates/akademi/_base'

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
const RENK = {
  metin: '#2d3748',
  soluk: '#6b7280',
  teal: '#0d9488',
  tealAcik: '#f0fdfa',
  tealKoyu: '#134e4a',
  cizgi: '#e5e7eb',
}

export type OneriMetaSatiri = { etiket: string; deger: string }

export type OneriMail = { subject: string; html: string; text: string }

type IskeletGirdi = {
  onizleme: string
  baslik: string
  /** Kart üstündeki ana satır — öneri başlığı. */
  oneriBasligi: string
  /** Alt satır: öneriyi veren (anonimse "Anonim"). */
  verenSatiri: string
  vurguSatiri?: string | null
  metalar: OneriMetaSatiri[]
  ctaMetin: string
  ctaYol: string
}

function oneriMailHtml(g: IskeletGirdi): string {
  const url = ileriHubUrl(g.ctaYol)
  const metaSatirlari = g.metalar
    .map(
      (m) => `
              <tr>
                <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:${RENK.soluk};white-space:nowrap;">${escapeHtml(m.etiket)}</td>
                <td style="padding:6px 0 6px 16px;font-family:${FONT};font-size:13px;color:${RENK.metin};font-weight:600;">${escapeHtml(m.deger)}</td>
              </tr>`,
    )
    .join('')

  const vurgu = g.vurguSatiri
    ? `
            <tr>
              <td style="padding:0 32px 20px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:12px 16px;background-color:${RENK.tealAcik};border-left:3px solid ${RENK.teal};font-family:${FONT};font-size:14px;line-height:20px;color:${RENK.tealKoyu};">
                      ${escapeHtml(g.vurguSatiri)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
    : ''

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="tr">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(g.baslik)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(g.onizleme)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f7fa;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);">
              <div style="font-family:${FONT};font-size:18px;font-weight:600;color:#ffffff;">${escapeHtml(g.baslik)}</div>
              <div style="font-family:${FONT};font-size:13px;color:#d5f5f0;margin-top:4px;">İleri Group · ILERIHub</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 32px 8px 32px;">
              <div style="font-family:${FONT};font-size:16px;font-weight:600;color:${RENK.metin};">${escapeHtml(g.oneriBasligi)}</div>
              <div style="font-family:${FONT};font-size:13px;color:${RENK.soluk};margin-top:4px;">${escapeHtml(g.verenSatiri)}</div>
            </td>
          </tr>
          ${vurgu}
          <tr>
            <td style="padding:0 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">${metaSatirlari}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 28px 32px;">
              <a href="${url}" style="display:inline-block;background-color:${RENK.teal};color:#ffffff;padding:11px 22px;text-decoration:none;border-radius:6px;font-family:${FONT};font-size:14px;font-weight:500;">${escapeHtml(g.ctaMetin)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid ${RENK.cizgi};font-family:${FONT};font-size:12px;color:${RENK.soluk};text-align:center;">
              Öneri ve Sürekli İyileştirme · İleri Group<br />
              Bu otomatik bir bildirimdir, yanıtlamayın. Önerinin tamamı portalda.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function oneriMailText(g: IskeletGirdi): string {
  const satirlar = ['İleri Group · ILERIHub', '', g.baslik, '', g.oneriBasligi, g.verenSatiri]
  if (g.vurguSatiri) satirlar.push('', g.vurguSatiri)
  satirlar.push('')
  for (const m of g.metalar) satirlar.push(`${m.etiket}: ${m.deger}`)
  satirlar.push('', `${g.ctaMetin}: ${ileriHubUrl(g.ctaYol)}`, '')
  satirlar.push(
    'Öneri ve Sürekli İyileştirme · İleri Group',
    'Bu otomatik bir bildirimdir, yanıtlamayın. Önerinin tamamı portalda.',
  )
  return satirlar.join('\n')
}

/** (b) Yönetici onayladı — Öneri Kurulu değerlendirmesi bekleniyor. */
export function kurulDegerlendirmesiMaili(args: {
  suggestionId: string
  suggestionNumber: string
  baslik: string
  verenAdi: string
  bolum?: string | null
  kategori?: string | null
  onaylayanAdi: string
}): OneriMail {
  const g: IskeletGirdi = {
    onizleme: `${args.suggestionNumber} — Öneri Kurulu değerlendirmesi bekleniyor.`,
    baslik: 'Değerlendirmeniz bekleniyor',
    oneriBasligi: args.baslik,
    verenSatiri: `${args.verenAdi}${args.bolum ? ` · ${args.bolum}` : ''}`,
    vurguSatiri: `${args.onaylayanAdi} öneriyi onayladı ve Öneri Kuruluna iletti.`,
    metalar: [
      { etiket: 'Öneri No', deger: args.suggestionNumber },
      { etiket: 'Kategori', deger: args.kategori?.trim() || 'Kategorisiz' },
      { etiket: 'Durum', deger: 'Kurul değerlendirmesi bekliyor' },
    ],
    ctaMetin: 'Öneriyi değerlendir',
    ctaYol: `/suggestions/${args.suggestionId}`,
  }
  return {
    subject: `Değerlendirmeniz bekleniyor — ${args.suggestionNumber} ${args.baslik}`,
    html: oneriMailHtml(g),
    text: oneriMailText(g),
  }
}
