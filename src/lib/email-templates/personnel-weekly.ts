/**
 * Haftalık Personel Raporu mail şablonu.
 *
 * Kurumsal yerleşim (layout.ts, üst şerit "İnsan Varlıkları"): KPI kutuları kpiRow,
 * çubuklar barRow (Outlook: tablo hücresi genişliği), listeler dataTable.
 */
import { escapeHtml } from '@/lib/email-templates/akademi/_base'
import type { HaftalikPersonelRaporu, HareketSatiri } from '@/lib/personnel-weekly-report'
import { renderEmailHtml, p, dataTable, sectionTitle, kpiRow, barRow, TOKENS } from '@/lib/email-templates/layout'

/** Yaka renkleri ekrandaki YAKA_RENK ile aynı: beyaz→teal, mavi→blue, gri→slate. */
const YAKA = {
  beyaz: { ad: 'Beyaz Yaka', renk: '#0d9488' },
  mavi: { ad: 'Mavi Yaka', renk: '#2563eb' },
  gri: { ad: 'Gri Yaka', renk: '#64748b' },
} as const

export interface HaftalikMailOpts {
  baslik: string
  sayfaUrl: string
  /** Bar listesinde gösterilecek en fazla bölüm sayısı. */
  bolumLimiti?: number
}

export function buildPersonnelWeeklyText(veri: HaftalikPersonelRaporu, opts: HaftalikMailOpts): string {
  const { ozet, cinsiyetDagilimi } = veri.rapor
  const satirlar = [
    `${opts.baslik} — ${veri.tarihMetni}`,
    '',
    `Toplam çalışan: ${ozet.toplamCalisan}`,
    `Beyaz yaka: ${ozet.beyazYaka} · Mavi yaka: ${ozet.maviYaka} · Gri yaka: ${ozet.griYaka}`,
    `Kadın/Erkek: ${cinsiyetDagilimi.kadin} / ${cinsiyetDagilimi.erkek}`,
    '',
    'Bölüm dağılımı:',
    ...veri.rapor.tumBolumler.slice(0, opts.bolumLimiti ?? 12).map(b => `  ${b.bolum}: ${b.sayi} (%${b.oran})`),
  ]
  if (veri.girenler.length > 0) {
    satirlar.push('', `Hafta içinde işe girenler (${veri.tarihMetni}):`, ...veri.girenler.map(g => `  ${g.adSoyad} — ${g.bolum} / ${g.gorev} (${g.tarih})`))
  }
  if (veri.cikanlar.length > 0) {
    satirlar.push('', `Hafta içinde işten çıkanlar (${veri.tarihMetni}):`, ...veri.cikanlar.map(c => `  ${c.adSoyad} — ${c.bolum} / ${c.gorev} (${c.tarih})`))
  }
  satirlar.push('', `Canlı görünüm: ${opts.sayfaUrl}`)
  return satirlar.join('\n')
}

function hareketTablosu(baslik: string, satirlar: HareketSatiri[]): string {
  if (satirlar.length === 0) return ''
  return (
    sectionTitle(baslik, `${satirlar.length} kişi`) +
    dataTable(
      ['Ad Soyad', 'Bölüm', 'Görev', 'Tarih'],
      satirlar.map((s) => [
        escapeHtml(s.adSoyad),
        `<span style="color:${TOKENS.muted};">${escapeHtml(s.bolum)}</span>`,
        `<span style="color:${TOKENS.muted};">${escapeHtml(s.gorev)}</span>`,
        `<span style="white-space:nowrap;color:${TOKENS.muted};">${escapeHtml(s.tarih)}</span>`,
      ]),
      ['left', 'left', 'left', 'right'],
    )
  )
}

export function buildPersonnelWeeklyHtml(veri: HaftalikPersonelRaporu, opts: HaftalikMailOpts): string {
  const { ozet, cinsiyetDagilimi, yakaCinsiyetTablosu, tumBolumler } = veri.rapor
  const bolumler = tumBolumler.slice(0, opts.bolumLimiti ?? 12)
  const enBuyuk = bolumler.reduce((m, b) => Math.max(m, b.sayi), 0)

  const yakaSatiri = (anahtar: keyof typeof YAKA) => {
    const y = YAKA[anahtar]
    const s = yakaCinsiyetTablosu[anahtar]
    return [
      `<strong style="color:${y.renk};">${y.ad}</strong>`,
      `<strong>${s.genel}</strong>`,
      String(s.erkek),
      String(s.kadin),
      String(s.engelli),
    ]
  }
  const t = yakaCinsiyetTablosu.toplam
  const yakaTablosu = dataTable(
    ['Yaka Tipi', 'Genel', 'Erkek', 'Kadın', 'Engelli'],
    [
      yakaSatiri('beyaz'),
      yakaSatiri('mavi'),
      yakaSatiri('gri'),
      ['<strong>TOPLAM</strong>', `<strong>${t.genel}</strong>`, `<strong>${t.erkek}</strong>`, `<strong>${t.kadin}</strong>`, `<strong>${t.engelli}</strong>`],
    ],
    ['left', 'right', 'right', 'right', 'right'],
  )

  const bolumSatirlari = bolumler
    .map((b) =>
      barRow(
        b.bolum,
        enBuyuk > 0 ? (b.sayi / enBuyuk) * 100 : 0,
        TOKENS.navy,
        `<span style="color:${TOKENS.textDark};font-weight:bold;">${b.sayi}</span> &nbsp;%${b.oran}`,
      ),
    )
    .join('')

  const hareketYok =
    veri.girenler.length === 0 && veri.cikanlar.length === 0
      ? p(`<span style="color:${TOKENS.muted};">${escapeHtml(veri.tarihMetni)} haftasında işe giren veya işten çıkan personel yok.</span>`)
      : ''

  return renderEmailHtml({
    module: 'İnsan Varlıkları',
    title: opts.baslik,
    subtitle: `Hafta: ${veri.tarihMetni} · Pazartesi–Pazar, Europe/Istanbul`,
    preheader: `${opts.baslik} — ${veri.tarihMetni} · Toplam çalışan ${ozet.toplamCalisan}`,
    afterHtml:
      kpiRow([
        { label: 'Toplam Çalışan', value: String(ozet.toplamCalisan), accent: TOKENS.textDark },
        { label: YAKA.beyaz.ad, value: String(ozet.beyazYaka), accent: YAKA.beyaz.renk },
        { label: YAKA.mavi.ad, value: String(ozet.maviYaka), accent: YAKA.mavi.renk },
        { label: YAKA.gri.ad, value: String(ozet.griYaka), accent: YAKA.gri.renk },
        { label: 'Kadın / Erkek', value: `${cinsiyetDagilimi.kadin} / ${cinsiyetDagilimi.erkek}`, accent: '#be123c' },
      ]) +
      sectionTitle('Yaka · Cinsiyet · Engelli dağılımı') +
      yakaTablosu +
      sectionTitle('Bölüm dağılımı', `en kalabalık ${bolumler.length} bölüm / toplam ${tumBolumler.length}`) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;">${bolumSatirlari}</table>` +
      hareketTablosu('Hafta içinde işe girenler', veri.girenler) +
      hareketTablosu('Hafta içinde işten çıkanlar', veri.cikanlar) +
      hareketYok,
    cta: { label: 'Canlı görünüm', url: opts.sayfaUrl },
    footnote: 'Haftalık personel raporu — kaynak: aktif personel kayıtları.',
  })
}
