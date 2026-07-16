/**
 * Mesai performans maili HTML şablonu (PR-B).
 * Bölüm bazlı (kişi detayı YOK — link ile sayfaya yönlendirir).
 * Çubuklar <table> ile kurulur (Outlook div-genişlik bug'ına karşı).
 */
import type { PerfResult } from '@/lib/overtime-performance'

const NAVY = '#1B4F72'
function perfColor(yuzde: number): string {
  if (yuzde < 70) return '#d03b3b'
  if (yuzde < 90) return '#c98500'
  return '#0ca30c'
}

export interface PerfMailOpts {
  baslik: string
  tarihMetni: string
  sayfaUrl: string
  haftalikMi?: boolean
}

export function buildPerfEmailText(data: PerfResult, opts: PerfMailOpts): string {
  const lines = [
    `${opts.baslik} — ${opts.tarihMetni}`,
    `Genel: ${data.genel.gerceklesen}/${data.genel.hedef} (%${data.genel.yuzde ?? '—'})`,
    '',
    ...data.bolumler.map((b) => `${b.ad}: ${b.gerceklesen}/${b.hedef} (%${b.yuzde})`),
    '',
    `Kişi bazında: ${opts.sayfaUrl}`,
  ]
  return lines.join('\n')
}

export function buildPerfEmailHtml(data: PerfResult, opts: PerfMailOpts): string {
  const ozet = data.genel
  const barRow = (b: { ad: string; hedef: number; gerceklesen: number; yuzde: number }) => {
    const w = Math.min(100, Math.max(0, b.yuzde))
    const color = perfColor(b.yuzde)
    return `
    <tr>
      <td style="padding:6px 8px;font-size:13px;color:#333;white-space:nowrap;">${b.ad}</td>
      <td style="padding:6px 8px;width:60%;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#eee;border-radius:3px;">
          <tr><td style="background:${color};height:16px;width:${w}%;border-radius:3px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
      <td style="padding:6px 8px;font-size:13px;color:${color};font-weight:bold;text-align:right;white-space:nowrap;">%${b.yuzde}</td>
      <td style="padding:6px 8px;font-size:12px;color:#777;text-align:right;white-space:nowrap;">${b.gerceklesen}/${b.hedef}</td>
    </tr>`
  }

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:640px;">
        <tr><td style="background:${NAVY};padding:18px 24px;">
          <span style="color:#fff;font-size:18px;font-weight:bold;">${opts.baslik}</span><br>
          <span style="color:#cdd9e5;font-size:13px;">${opts.tarihMetni}</span>
        </td></tr>
        <tr><td style="padding:20px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
            <tr>
              <td align="center" style="padding:10px;background:#f7f9fb;border-radius:6px;">
                <div style="font-size:12px;color:#777;">Toplam Hedef</div>
                <div style="font-size:22px;font-weight:bold;color:${NAVY};">${ozet.hedef}</div></td>
              <td style="width:10px;"></td>
              <td align="center" style="padding:10px;background:#f7f9fb;border-radius:6px;">
                <div style="font-size:12px;color:#777;">Gerçekleşen</div>
                <div style="font-size:22px;font-weight:bold;color:${NAVY};">${ozet.gerceklesen}</div></td>
              <td style="width:10px;"></td>
              <td align="center" style="padding:10px;background:#f7f9fb;border-radius:6px;">
                <div style="font-size:12px;color:#777;">Genel %</div>
                <div style="font-size:22px;font-weight:bold;color:${ozet.yuzde != null ? perfColor(ozet.yuzde) : NAVY};">${ozet.yuzde != null ? '%' + ozet.yuzde : '—'}</div></td>
            </tr>
          </table>
          <div style="font-size:14px;font-weight:bold;color:${NAVY};margin-bottom:6px;">Bölüm Performansı</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee;border-radius:6px;">
            ${data.bolumler.map(barRow).join('')}
          </table>
          <div style="margin-top:20px;text-align:center;">
            <a href="${opts.sayfaUrl}" style="display:inline-block;background:${NAVY};color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;">Kişi bazında performansı ILERIHub'da görüntüle</a>
          </div>
        </td></tr>
        <tr><td style="padding:14px 24px;background:#f7f9fb;color:#999;font-size:11px;">
          Bu otomatik bir ILERIHub bildirimidir. ${opts.haftalikMi ? 'Haftalık' : 'Günlük'} mesai üretim performans raporu.
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`
}
