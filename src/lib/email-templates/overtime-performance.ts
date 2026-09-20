/**
 * Mesai performans maili HTML şablonu (PR-B).
 * Bölüm bazlı (kişi detayı YOK — link ile sayfaya yönlendirir).
 * Kurumsal yerleşim (layout.ts, üst şerit "Mesai"); çubuklar barRow ile (tablo hücresi).
 */
import type { PerfResult } from '@/lib/overtime-performance'
import { renderEmail, kpiRow, barRow, sectionTitle, TOKENS } from '@/lib/email-templates/layout'

function perfColor(yuzde: number): string {
  if (yuzde < 70) return TOKENS.red
  if (yuzde < 90) return TOKENS.amber
  return TOKENS.green
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
  const genelRenk = ozet.yuzde != null ? perfColor(ozet.yuzde) : TOKENS.navy

  const bolumSatirlari = data.bolumler
    .map((b) =>
      barRow(
        b.ad,
        b.yuzde,
        perfColor(b.yuzde),
        `<span style="color:${perfColor(b.yuzde)};font-weight:bold;">%${b.yuzde}</span> &nbsp;${b.gerceklesen}/${b.hedef}`,
      ),
    )
    .join('')

  return renderEmail({
    module: 'Mesai',
    title: opts.baslik,
    subtitle: opts.tarihMetni,
    preheader: `${opts.baslik} — ${opts.tarihMetni} · Genel %${ozet.yuzde ?? '—'}`,
    afterHtml:
      kpiRow([
        { label: 'Toplam Hedef', value: String(ozet.hedef) },
        { label: 'Gerçekleşen', value: String(ozet.gerceklesen) },
        { label: 'Genel %', value: ozet.yuzde != null ? `%${ozet.yuzde}` : '—', accent: genelRenk },
      ]) +
      sectionTitle('Bölüm performansı') +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;">${bolumSatirlari}</table>`,
    cta: { label: "Kişi bazında performansı ILERIHub'da görüntüle", url: opts.sayfaUrl },
    footnote: `${opts.haftalikMi ? 'Haftalık' : 'Günlük'} mesai üretim performans raporu.`,
  })
}
