/**
 * Haftalık Personel Raporu mail şablonu.
 *
 * Kurumsal yerleşim (layout.ts, üst şerit "İnsan Varlıkları"): KPI kutuları kpiRow,
 * çubuklar barRow (Outlook: tablo hücresi genişliği), listeler dataTable.
 */
import { escapeHtml } from '@/lib/email-templates/akademi/_base'
import type { ImalatTablosu, OfisTablosu } from '@/lib/personnel-report-core'
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
  /** Bar listesinde gösterilecek en fazla bölüm sayısı; verilmezse TÜMÜ. */
  bolumLimiti?: number
}

/** Metin tablosu: sütunları içeriğe göre hizalar (tek aralıklı yazı tipinde okunur). */
function metinTablosu(basliklar: string[], satirlar: string[][]): string[] {
  const tum = [basliklar, ...satirlar]
  const genislik = basliklar.map((_, i) => Math.max(...tum.map(r => (r[i] ?? '').length)))
  const ciz = (r: string[]) =>
    '  ' + r.map((h, i) => (i === 0 ? (h ?? '').padEnd(genislik[i]) : (h ?? '').padStart(genislik[i]))).join('  ')
  return [ciz(basliklar), '  ' + genislik.map(g => '-'.repeat(g)).join('  '), ...satirlar.map(ciz)]
}

function imalatMetin(t: ImalatTablosu): string[] {
  return metinTablosu(
    ['', ...t.sutunlar, 'GENEL TOPLAM'],
    t.satirlar.map(sat => [sat.ad, ...sat.hucreler.map(h => String(h.sayi)), String(sat.genelToplam)]),
  )
}

function ofisMetin(t: OfisTablosu): string[] {
  return metinTablosu(
    ['', ...t.sutunlar, 'GENEL TOPLAM'],
    [[t.satir.ad, ...t.satir.hucreler.map(h => String(h.sayi)), String(t.satir.genelToplam)]],
  )
}

/**
 * Geniş tablo (14+ sütun) — dataTable dar tablolar için biçimlendirilmiş,
 * burada küçük punto + yatay kaydırma gerekiyor. Outlook tabloyu geniş çizer.
 */
function genisTablo(basliklar: string[], satirlar: { ad: string; hucreler: number[]; toplam: number; kalin?: boolean }[]): string {
  const th = ['', ...basliklar, 'GENEL TOPLAM']
    .map((h, i) =>
      `<th align="${i === 0 ? 'left' : 'right'}" style="padding:6px 5px;font-family:${TOKENS.font};font-size:10px;line-height:13px;font-weight:bold;color:${TOKENS.muted};text-transform:uppercase;border-bottom:1px solid ${TOKENS.line};white-space:nowrap;">${escapeHtml(h)}</th>`)
    .join('')
  const trs = satirlar
    .map(sat => {
      const kalin = sat.kalin ? 'font-weight:bold;' : ''
      const hucreler = [...sat.hucreler.map(String), String(sat.toplam)]
        .map((v, i) =>
          `<td align="right" style="padding:6px 5px;font-family:${TOKENS.font};font-size:12px;line-height:16px;color:${TOKENS.textDark};border-bottom:1px solid ${TOKENS.lineSoft};${kalin}${i === sat.hucreler.length ? `background-color:${TOKENS.soft};` : ''}">${v}</td>`)
        .join('')
      return `<tr><td align="left" style="padding:6px 5px;font-family:${TOKENS.font};font-size:12px;line-height:16px;color:${TOKENS.textDark};border-bottom:1px solid ${TOKENS.lineSoft};font-weight:bold;white-space:nowrap;">${escapeHtml(sat.ad)}</td>${hucreler}</tr>`
    })
    .join('')
  return `<div style="overflow-x:auto;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-collapse:collapse;"><tr>${th}</tr>${trs}</table></div>`
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
    `Direkt: ${ozet.direkt} · Endirekt: ${ozet.endirekt}`,
    '',
    'İMALAT (mavi + gri yaka):',
    ...imalatMetin(veri.rapor.imalatTablosu),
    '',
    'OFİS (beyaz yaka):',
    ...ofisMetin(veri.rapor.ofisTablosu),
    '',
    'Bölüm dağılımı:',
    ...(opts.bolumLimiti ? veri.rapor.tumBolumler.slice(0, opts.bolumLimiti) : veri.rapor.tumBolumler)
      .map(b => `  ${b.bolum}: ${b.sayi} (%${b.oran})`),
  ]
  if (veri.girenler.length > 0) {
    satirlar.push(
      '',
      `Hafta içinde işe girenler (${veri.tarihMetni}):`,
      ...veri.girenler.map(g => `  ${g.adSoyad} [${g.sicilNo ?? '—'}] — ${g.bolum} / ${g.gorev} (${g.tarih})`),
    )
  }
  if (veri.cikanlar.length > 0) {
    satirlar.push(
      '',
      `Hafta içinde işten çıkanlar (${veri.tarihMetni}):`,
      ...veri.cikanlar.map(c => {
        const sebep = [c.cikisTarafi, c.cikisSebebi].filter(Boolean).join(' / ') || 'sebep girilmemiş'
        return `  ${c.adSoyad} [${c.sicilNo ?? '—'}] — ${c.bolum} / ${c.gorev} (${c.tarih}) — ${sebep}`
      }),
    )
  }
  satirlar.push('', `Canlı görünüm: ${opts.sayfaUrl}`)
  return satirlar.join('\n')
}

function hareketTablosu(baslik: string, satirlar: HareketSatiri[], cikis = false): string {
  if (satirlar.length === 0) return ''
  const sonuk = (v: string) => `<span style="color:${TOKENS.muted};">${escapeHtml(v)}</span>`
  return (
    sectionTitle(baslik, `${satirlar.length} kişi`) +
    dataTable(
      ['Ad Soyad', 'Sicil', 'Bölüm', 'Görev', ...(cikis ? ['Çıkış sebebi'] : []), 'Tarih'],
      satirlar.map((s) => [
        escapeHtml(s.adSoyad),
        `<span style="white-space:nowrap;color:${TOKENS.muted};">${escapeHtml(s.sicilNo ?? '—')}</span>`,
        sonuk(s.bolum),
        sonuk(s.gorev),
        ...(cikis
          ? [sonuk([s.cikisTarafi, s.cikisSebebi].filter(Boolean).join(' / ') || 'sebep girilmemiş')]
          : []),
        `<span style="white-space:nowrap;color:${TOKENS.muted};">${escapeHtml(s.tarih)}</span>`,
      ]),
      ['left', 'left', 'left', 'left', ...(cikis ? ['left' as const] : []), 'right'],
    )
  )
}

export function buildPersonnelWeeklyHtml(veri: HaftalikPersonelRaporu, opts: HaftalikMailOpts): string {
  const { ozet, cinsiyetDagilimi, yakaCinsiyetTablosu, tumBolumler, imalatTablosu, ofisTablosu } = veri.rapor
  const bolumler = opts.bolumLimiti ? tumBolumler.slice(0, opts.bolumLimiti) : tumBolumler
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
        { label: 'Direkt / Endirekt', value: `${ozet.direkt} / ${ozet.endirekt}`, accent: TOKENS.navy },
      ]) +
      sectionTitle('Yaka · Cinsiyet · Engelli dağılımı') +
      yakaTablosu +
      sectionTitle('İmalat — mavi + gri yaka', 'direkt/endirekt kırılımı; gri yaka ayrı satır') +
      genisTablo(
        imalatTablosu.sutunlar,
        imalatTablosu.satirlar.map(sat => ({
          ad: sat.ad,
          hucreler: sat.hucreler.map(h => h.sayi),
          toplam: sat.genelToplam,
          kalin: sat.ad === 'TOPLAM',
        })),
      ) +
      sectionTitle('Ofis — beyaz yaka') +
      genisTablo(ofisTablosu.sutunlar, [
        { ad: ofisTablosu.satir.ad, hucreler: ofisTablosu.satir.hucreler.map(h => h.sayi), toplam: ofisTablosu.satir.genelToplam, kalin: true },
      ]) +
      sectionTitle('Bölüm dağılımı', bolumler.length === tumBolumler.length ? `${tumBolumler.length} bölüm` : `en kalabalık ${bolumler.length} bölüm / toplam ${tumBolumler.length}`) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;">${bolumSatirlari}</table>` +
      hareketTablosu('Hafta içinde işe girenler', veri.girenler) +
      hareketTablosu('Hafta içinde işten çıkanlar', veri.cikanlar, true) +
      hareketYok,
    cta: { label: 'Canlı görünüm', url: opts.sayfaUrl },
    footnote: 'Haftalık personel raporu — kaynak: aktif personel kayıtları.',
  })
}
