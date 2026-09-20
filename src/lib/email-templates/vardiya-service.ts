// Vardiya Faz 3: son onaydan (İK final, status=APPROVED) sonra İnsan Varlıkları'na
// gönderilen servis güzergahı listesi maili. Kurumsal yerleşim (layout.ts, üst
// şerit "Mesai"). Yalnız VARDIYA formları için.

import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { formatVardiyaHafta } from '@/lib/vardiya-hafta'
import { escapeHtml } from '@/lib/email-templates/akademi/_base'
import { renderEmail, p, dataTable, sectionTitle } from '@/lib/email-templates/layout'

export type VardiyaServiceRow = { ad: string; guzergah: string; durak: string }
// Vardiya Hafta Modu: mail'de hafta/tarih bilgisi. date = "YYYY-MM-DD".
export type VardiyaServiceMeta = { date?: string; vardiyaHaftaMi?: boolean }

/** Onay tarihi metni (UTC → tr-TR gün ay yıl). */
function bugunMetni(): string {
  return new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Vardiya tarih/hafta metni: hafta modu → "38. Hafta (14-18 Temmuz)", gün modu → tam tarih. */
function vardiyaTarihMetni(meta?: VardiyaServiceMeta): string {
  if (!meta?.date) return ''
  if (meta.vardiyaHaftaMi) return formatVardiyaHafta(meta.date)
  const [y, m, d] = meta.date.slice(0, 10).split('-').map(Number)
  return format(new Date(y, (m ?? 1) - 1, d ?? 1), 'dd MMMM yyyy EEEE', { locale: tr })
}

/** Plain-text fallback (sendEmail text parametresi). */
export function buildVardiyaServiceMailText(formNo: string, rows: VardiyaServiceRow[], meta?: VardiyaServiceMeta): string {
  const tarih = vardiyaTarihMetni(meta)
  const lines = [
    `Vardiya Servis Listesi — ${formNo}`,
    ...(tarih ? [`${meta?.vardiyaHaftaMi ? 'Vardiya Haftası' : 'Vardiya Tarihi'}: ${tarih}`] : []),
    `Onay tarihi: ${bugunMetni()}`,
    '',
    'Personel | Güzergah | Durak',
    ...rows.map((r) => `${r.ad} | ${r.guzergah} | ${r.durak}`),
  ]
  return lines.join('\n')
}

export function buildVardiyaServiceMailHtml(formNo: string, rows: VardiyaServiceRow[], meta?: VardiyaServiceMeta): string {
  const esc = (s: string) => escapeHtml(String(s ?? '-'))
  const tarih = vardiyaTarihMetni(meta)
  const tarihEtiketi = meta?.vardiyaHaftaMi ? 'Vardiya Haftası' : 'Vardiya Tarihi'

  const liste =
    rows.length > 0
      ? dataTable(
          ['Personel', 'Güzergah', 'Durak'],
          rows.map((r) => [esc(r.ad), esc(r.guzergah), esc(r.durak)]),
        )
      : p('<span style="color:#6b7280;">Personel bulunmuyor.</span>')

  return renderEmail({
    module: 'Mesai',
    title: 'Vardiya servis listesi',
    subtitle: `${formNo} · Onay tarihi: ${bugunMetni()}`,
    preheader: `Vardiya Servis Listesi — ${formNo}${tarih ? ` · ${tarih}` : ''}`,
    infoRows: [
      { label: 'Form No', value: `<strong>${esc(formNo)}</strong>` },
      ...(tarih ? [{ label: tarihEtiketi, value: esc(tarih) }] : []),
      { label: 'Onay tarihi', value: esc(bugunMetni()) },
    ],
    afterHtml: sectionTitle('Servis güzergahları', `${rows.length} personel`) + liste,
    footnote: 'Vardiya formu onaylandığında servis planlaması için gönderilir.',
  })
}
