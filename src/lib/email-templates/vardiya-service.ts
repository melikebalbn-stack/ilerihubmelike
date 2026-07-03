// Vardiya Faz 3: son onaydan (İK final, status=APPROVED) sonra İnsan Varlıkları'na
// gönderilen servis güzergahı listesi maili. Perf maili (overtime-performance.ts)
// Outlook-uyumlu <table> desenini referans alır. Yalnız VARDIYA formları için.

const NAVY = '#1B4F72'

export type VardiyaServiceRow = { ad: string; guzergah: string; durak: string }

/** Onay tarihi metni (UTC → tr-TR gün ay yıl). */
function bugunMetni(): string {
  return new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Plain-text fallback (sendEmail text parametresi). */
export function buildVardiyaServiceMailText(formNo: string, rows: VardiyaServiceRow[]): string {
  const lines = [
    `Vardiya Servis Listesi — ${formNo}`,
    `Onay tarihi: ${bugunMetni()}`,
    '',
    'Personel | Güzergah | Durak',
    ...rows.map((r) => `${r.ad} | ${r.guzergah} | ${r.durak}`),
  ]
  return lines.join('\n')
}

export function buildVardiyaServiceMailHtml(formNo: string, rows: VardiyaServiceRow[]): string {
  const esc = (s: string) =>
    String(s ?? '-')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const bodyRows =
    rows.length > 0
      ? rows
          .map(
            (r, i) => `
            <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f7f9fb'};">
              <td style="padding:8px 10px;font-size:13px;color:#333;border-bottom:1px solid #eee;">${esc(r.ad)}</td>
              <td style="padding:8px 10px;font-size:13px;color:#333;border-bottom:1px solid #eee;">${esc(r.guzergah)}</td>
              <td style="padding:8px 10px;font-size:13px;color:#333;border-bottom:1px solid #eee;">${esc(r.durak)}</td>
            </tr>`
          )
          .join('')
      : `<tr><td colspan="3" style="padding:12px 10px;font-size:13px;color:#999;text-align:center;">Personel bulunmuyor.</td></tr>`

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:640px;">
        <tr><td style="background:${NAVY};padding:18px 24px;">
          <span style="color:#fff;font-size:18px;font-weight:bold;">Vardiya Servis Listesi</span><br>
          <span style="color:#cdd9e5;font-size:13px;">${esc(formNo)} • Onay tarihi: ${bugunMetni()}</span>
        </td></tr>
        <tr><td style="padding:20px 24px;">
          <div style="font-size:14px;font-weight:bold;color:${NAVY};margin-bottom:8px;">Servis Güzergahları (${rows.length} personel)</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee;border-radius:6px;overflow:hidden;">
            <tr style="background:#eef2f6;">
              <th align="left" style="padding:8px 10px;font-size:12px;color:#555;border-bottom:1px solid #ddd;">Personel</th>
              <th align="left" style="padding:8px 10px;font-size:12px;color:#555;border-bottom:1px solid #ddd;">Güzergah</th>
              <th align="left" style="padding:8px 10px;font-size:12px;color:#555;border-bottom:1px solid #ddd;">Durak</th>
            </tr>
            ${bodyRows}
          </table>
        </td></tr>
        <tr><td style="padding:14px 24px;background:#f7f9fb;color:#999;font-size:11px;">
          Bu otomatik bir ILERIHub bildirimidir. Vardiya formu onaylandığında servis planlaması için gönderilir.
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`
}
