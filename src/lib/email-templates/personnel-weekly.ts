/**
 * Haftalık Personel Raporu mail şablonu.
 *
 * Kurumsal yerleşim (layout.ts, üst şerit "İnsan Varlıkları"): KPI kutuları kpiRow,
 * oran sütunu tabloların içinde; tüm tablolar bu dosyadaki yerel çizicilerle.
 */
import { escapeHtml } from '@/lib/email-templates/akademi/_base'
import type { ImalatTablosu, OfisTablosu } from '@/lib/personnel-report-core'
import type { HaftalikPersonelRaporu, HareketSatiri } from '@/lib/personnel-weekly-report'
import { renderEmailHtml, p, sectionTitle, kpiRow, TOKENS } from '@/lib/email-templates/layout'

/** Yaka renkleri ekrandaki YAKA_RENK ile aynı: beyaz→teal, mavi→blue, gri→slate. */
const YAKA = {
  beyaz: { ad: 'Beyaz Yaka', renk: '#0d9488' },
  mavi: { ad: 'Mavi Yaka', renk: '#2563eb' },
  gri: { ad: 'Gri Yaka', renk: '#64748b' },
} as const

export interface HaftalikMailOpts {
  baslik: string
  sayfaUrl: string
  /**
   * @deprecated 24.09.2026 — "Bölüm dağılımı" bar listesi kaldırıldı (oran + çubuk
   * artık imalat/ofis tablolarının içinde). Bu alan ARTIK OKUNMUYOR; deneme geri
   * alınırsa listeyle birlikte yeniden devreye girer. Çağıranlar geçmiyor.
   */
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

// Metin sürümü de DÖNDÜRÜLMÜŞ: satır = bölüm (HTML ile aynı düzen ve sıra).
// Metin sürümünde oran sütunu; payda HTML ile aynı (tablonun kendi toplamı).
function oranSatiri(r: DikeySatir, payda: number): string[] {
  const son = r.degerler[r.degerler.length - 1] || 0
  return [r.ad, ...r.degerler.map(String), yuzdeMetni(payda > 0 ? (son / payda) * 100 : 0)]
}

function imalatMetin(t: ImalatTablosu): string[] {
  const d = imalatDikey(t)
  const payda = tabloToplami(d.toplam)
  return metinTablosu(
    ['BÖLÜM', 'DİREK', 'ENDİREK', 'GRİ YAKA', 'TOPLAM', '%'],
    [...d.satirlar, d.toplam].map(r => oranSatiri(r, payda)),
  )
}

function ofisMetin(t: OfisTablosu): string[] {
  const d = ofisDikey(t)
  const payda = tabloToplami(d.toplam)
  return metinTablosu(
    ['BÖLÜM', 'PERSONEL SAYISI', '%'],
    [...d.satirlar, d.toplam].map(r => oranSatiri(r, payda)),
  )
}

/**
 * DÖNDÜRÜLMÜŞ sayı tablosu — satırlar BÖLÜM, sütunlar ölçü.
 *
 * Neden döndürüldü: 14 bölüm sütun olduğunda her sütuna ~29px düşüyordu; başlıklar
 * okunmuyor, kısaltma gerekiyordu. Satır=bölüm düzeninde tam adlar tek satıra sığar.
 *
 * GENİŞLİK: kart 600px, gövde dolgusu 2×32 → kullanılabilir 536px. 600px tablo kartı
 * 64px taşardı; bu yüzden tam kullanılabilir genişlik (536px) alınır. İki tablo AYNI
 * genişlikte ve BÖLÜM sütunu ikisinde de aynı (220px); sayı sütunları kalanı eşit böler.
 *
 * Outlook: yalnız table + inline style, `cellpadding`/`cellspacing` öznitelik,
 * `table-layout:fixed` + hücrelerde `width` özniteliği, float/flex yok.
 */
const TABLO_GENISLIK = 536
// Ölçülen metin genişlikleri: "PAKETLEME & DİREKSİYON" 180,25px (12px kalın),
// "ENDİREK" 54,45px, "%100,0" 41,95px (11px). 8px yatay dolguyla toplam ihtiyaç
// 545px > 535 bütçe; bu yüzden yatay dolgu 6px. Gereken sütunlar (metin + 12 + 1):
// BÖLÜM 194, sayı 68, % 55 → 208 + 4×68 + 55 = 535 (çizilen 536).
const BOLUM_SUTUN = 208
const ORAN_SUTUN = 55
/**
 * DİKEY HİZA — SADE KURAL (24.09 kararı): yükseklik SABİTLENMEZ.
 *
 * Hücrelerde `height`, `line-height`, `mso-line-height-rule` ve CSS `vertical-align`
 * YOK. Satır yüksekliği içeriğe göre kendiliğinden oluşur; üst ve alt dolgu EŞİT
 * olduğu için metin kendiliğinden ortalanır. Dikey hiza yalnız `valign="middle"`
 * ÖZNİTELİĞİ ile verilir (Outlook'un güvenilir uyguladığı tek yol).
 *
 * Önceki denemeler bu yüzden bırakıldı: `height` içerik kutusunu ayarlayıp toplamı
 * şişiriyordu; `line-height`'i font boyutuna eşitlemek ise `mso-line-height-rule:exactly`
 * ile satır kutusunu yazıdan küçük yapıp metni üste itiyordu.
 */
/**
 * GENİŞLİK KUTU MODELİ (24.09 ölçümü): `width` varsayılan olarak İÇERİK genişliğidir;
 * dolgu ve kenarlık ÜSTÜNE eklenir. Ölçüm: 220px bildirilen sütun 237px çiziliyordu
 * (220 + 16 dolgu + 1 kenarlık), tablo 536 yerine 639px, kart 600 yerine 705px oluyordu
 * — tablo tek başına boş sayfada da 639px çıktığı için sebebin ata elemanlar olmadığı
 * doğrulandı. `box-sizing:border-box` ile `width` artık TOPLAM genişliktir; Outlook
 * zaten `width` ÖZNİTELİĞİNİ toplam kabul ettiği için iki motor da aynı sonuca gelir.
 */
const DIKEY_DOLGU = 6
const YATAY_DOLGU = 6
/**
 * MİRAS KESME (24.09 ölçümü): layout.ts'in gövde hücresinde `line-height:24px` var
 * ve tablo hücrelerimiz bunu MİRAS ALIYOR — hücreden line-height'i kaldırmak değeri
 * "yok" yapmıyor, ata değerine düşürüyor. Playwright ölçümü: satır 37px
 * (24 miras + 6+6 dolgu + 1+1 kenarlık). Bu yüzden line-height AÇIKÇA verilir;
 * ayrıca `table` elemanına da yazılır ki ara katmanlar 24px'i taşımasın.
 * layout.ts'e dokunulmaz (23 şablonda ortak).
 */
const SATIR_LH = 16   // veri hücreleri (font 12px)
const ORAN_LH = 15    // % sütunu (font 11px)
const BASLIK_LH = 15  // başlık hücreleri (font 11px)
// TEK yatay dolgu: başlık ve veri hücreleri BİREBİR aynı olmalı, yoksa metinler
// aynı x ekseninde durmuyor (ölçüm: % sütununda th 8px / td 4px → 7,95px kayma).
const dolgu = () => `${DIKEY_DOLGU}px ${YATAY_DOLGU}px`

interface DikeySatir { ad: string; degerler: number[] }

/** Tablonun genel toplamı = toplam satırının SON değeri (oran paydası). */
const tabloToplami = (toplam: DikeySatir): number => toplam.degerler[toplam.degerler.length - 1] || 0

const yuzdeMetni = (o: number) => `%${o.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`


/**
 * @param basliklar Sayı sütunu başlıkları (BÖLÜM hariç).
 * @param satirlar  Bölüm satırları — TOPLAM'a göre sıralanmış gelir.
 * @param toplam    En alttaki GENEL TOPLAM satırı (kalın + gri zemin).
 */
/**
 * @param oranPaydasi  Yüzde paydası — TABLONUN KENDİ toplamı (imalat 127, ofis 59).
 *   Böylece sütun gerçekten %100,0'e toplanır ve GENEL TOPLAM satırı doğal olarak
 *   %100,0 çıkar. (24.09'a kadar payda 186 idi; sütun %68,3'e toplanıyor ama toplam
 *   satırında elle %100 yazılıyordu — tutarsızdı.)
 */
function dikeyTablo(basliklar: string[], satirlar: DikeySatir[], toplam: DikeySatir, oranPaydasi: number): string {
  const sayiAdet = basliklar.length
  // Tam çerçeveli (border:1px) tabloda dış kenarlığın yarısı tablonun DIŞINA taşıyor;
  // sütunlar 536 toplayınca tablo 537px çiziliyordu (ölçüm). Bütçe 535 → çizilen 536.
  const ic = TABLO_GENISLIK - 1
  const sabit = BOLUM_SUTUN + ORAN_SUTUN
  const sayiW = Math.floor((ic - sabit) / sayiAdet)
  const bolumW = ic - sabit + BOLUM_SUTUN - sayiW * sayiAdet
  const cerceve = `1px solid ${TOKENS.line}`
  const ortak = `font-family:${TOKENS.font};border:${cerceve};box-sizing:border-box;`

  const thHucre = (metin: string, w: number, hiza: 'left' | 'right' | 'center') =>
    `<th align="${hiza}" valign="middle" width="${w}" style="width:${w}px;padding:${dolgu()};${ortak}font-size:11px;line-height:${BASLIK_LH}px;font-weight:bold;color:${TOKENS.muted};text-align:${hiza};background-color:${TOKENS.soft};">${escapeHtml(metin)}</th>`

  // Sayı sütunları ORTALI (başlık ve veri aynı hiza); BÖLÜM sütunu sola.
  const th =
    thHucre('BÖLÜM', bolumW, 'left') +
    basliklar.map((h) => thHucre(h, sayiW, 'center')).join('') +
    thHucre('%', ORAN_SUTUN, 'center')

  const satirCiz = (r: DikeySatir, vurgu: boolean) => {
    const kalin = vurgu ? 'font-weight:bold;' : ''
    const zemin = vurgu ? `background-color:${TOKENS.soft};` : ''
    const sonDeger = r.degerler[r.degerler.length - 1] || 0
    // Payda tablonun kendi toplamı → toplam satırı kendiliğinden %100,0 olur.
    const oranGoster = oranPaydasi > 0 ? (sonDeger / oranPaydasi) * 100 : 0
    return (
      `<tr>` +
      // nowrap YOK: kırılamaz içerik fixed-layout tabloyu bile 536px'in üzerine
      // zorluyordu (ölçüm: tablo 639px, kart 705px). Ölçülen ihtiyaç 199px < 220px,
      // yani sarma zaten oluşmuyor; nowrap sadece taşmayı zorluyordu.
      `<td align="left" valign="middle" width="${bolumW}" style="width:${bolumW}px;padding:${dolgu()};${ortak}font-size:12px;line-height:${SATIR_LH}px;color:${TOKENS.textDark};text-align:left;font-weight:bold;${zemin}">${escapeHtml(r.ad)}</td>` +
      r.degerler
        .map(
          (v) =>
            `<td align="center" valign="middle" width="${sayiW}" style="width:${sayiW}px;padding:${dolgu()};${ortak}font-size:12px;line-height:${SATIR_LH}px;color:${TOKENS.textDark};text-align:center;${kalin}${zemin}">${Number.isFinite(v) ? v : 0}</td>`,
        )
        .join('') +
      `<td align="center" valign="middle" width="${ORAN_SUTUN}" style="width:${ORAN_SUTUN}px;padding:${dolgu()};${ortak}font-size:11px;line-height:${ORAN_LH}px;color:${TOKENS.textDark};text-align:center;${kalin}${zemin}">${yuzdeMetni(oranGoster)}</td>` +
      `</tr>`
    )
  }

  return (
    `<table role="presentation" width="${TABLO_GENISLIK}" cellpadding="0" cellspacing="0" border="0" style="width:${TABLO_GENISLIK}px;margin:0 0 14px 0;border-collapse:collapse;table-layout:fixed;line-height:${SATIR_LH}px;">` +
    `<tr>${th}</tr>` +
    satirlar.map((r) => satirCiz(r, false)).join('') +
    satirCiz(toplam, true) +
    `</table>`
  )
}

/** İmalat tablosunu döndürür: bölüm satırları (TOPLAM'a göre azalan) + genel toplam. */
function imalatDikey(t: ImalatTablosu): { satirlar: DikeySatir[]; toplam: DikeySatir } {
  const sira = (ad: string) => t.satirlar.find((s) => s.ad === ad)!
  const direk = sira('DİREK'), endirek = sira('ENDİREK'), gri = sira('GRİ YAKA'), tp = sira('TOPLAM')
  const satirlar = t.sutunlar
    .map((ad, i) => ({
      ad,
      degerler: [direk.hucreler[i].sayi, endirek.hucreler[i].sayi, gri.hucreler[i].sayi, tp.hucreler[i].sayi],
    }))
    .sort((a, b) => b.degerler[3] - a.degerler[3] || a.ad.localeCompare(b.ad, 'tr-TR'))
  return {
    satirlar,
    toplam: { ad: 'GENEL TOPLAM', degerler: [direk.genelToplam, endirek.genelToplam, gri.genelToplam, tp.genelToplam] },
  }
}

/** Ofis tablosunu döndürür: bölüm satırları (sayıya göre azalan) + genel toplam. */
function ofisDikey(t: OfisTablosu): { satirlar: DikeySatir[]; toplam: DikeySatir } {
  const satirlar = t.satir.hucreler
    .map((h) => ({ ad: h.baslik, degerler: [h.sayi] }))
    .sort((a, b) => b.degerler[0] - a.degerler[0] || a.ad.localeCompare(b.ad, 'tr-TR'))
  return { satirlar, toplam: { ad: 'GENEL TOPLAM', degerler: [t.satir.genelToplam] } }
}

/**
 * Yaka · Cinsiyet · Engelli tablosu — paylaşılan `dataTable` yerine YEREL çizici.
 * Gerekçe: dataTable 12 şablonda ortak; burada istenen `vertical-align:middle`,
 * sabit satır yüksekliği ve başlık↔değer hizası için onu değiştirmek diğer
 * modüllerin maillerini de değiştirirdi. Kapsam bu mailde tutuldu.
 * İlk sütun sola, TÜM sayı sütunları (başlık dahil) SAĞA dayalı.
 */
function yakaTablosu(basliklar: string[], satirlar: { etiket: string; renk?: string; degerler: number[]; kalin?: boolean }[]): string {
  const cerceve = `1px solid ${TOKENS.line}`
  const ortak = `font-family:${TOKENS.font};border-bottom:${cerceve};box-sizing:border-box;`
  const sayiAdet = basliklar.length - 1
  const sayiW = Math.floor((TABLO_GENISLIK - 150) / sayiAdet)
  // Yuvarlama artığı ilk sütuna eklenir → toplam TAM 536px (2px açık kalmasın).
  const ILK = TABLO_GENISLIK - sayiW * sayiAdet
  // Hücrelerde yalnız alt kenarlık var (1px) → içerik yüksekliği imalat/ofisten
  // 1px FAZLA; çizilen toplam üç tabloda da aynı (24 / 28px) çıkar.

  const th =
    `<th align="left" valign="middle" width="${ILK}" style="width:${ILK}px;padding:${dolgu()};${ortak}font-size:11px;line-height:${BASLIK_LH}px;font-weight:bold;color:${TOKENS.muted};text-align:left;">${escapeHtml(basliklar[0])}</th>` +
    basliklar
      .slice(1)
      .map(
        (h) =>
          `<th align="center" valign="middle" width="${sayiW}" style="width:${sayiW}px;padding:${dolgu()};${ortak}font-size:11px;line-height:${BASLIK_LH}px;font-weight:bold;color:${TOKENS.muted};text-align:center;">${escapeHtml(h)}</th>`,
      )
      .join('')

  const trs = satirlar
    .map((sat) => {
      const kalin = sat.kalin ? 'font-weight:bold;' : ''
      return (
        `<tr>` +
        `<td align="left" valign="middle" width="${ILK}" style="width:${ILK}px;padding:${dolgu()};${ortak}font-size:12px;line-height:${SATIR_LH}px;text-align:left;font-weight:bold;color:${sat.renk ?? TOKENS.textDark};">${escapeHtml(sat.etiket)}</td>` +
        sat.degerler
          .map(
            (v) =>
              `<td align="center" valign="middle" width="${sayiW}" style="width:${sayiW}px;padding:${dolgu()};${ortak}font-size:12px;line-height:${SATIR_LH}px;color:${TOKENS.textDark};text-align:center;${kalin}">${v}</td>`,
          )
          .join('') +
        `</tr>`
      )
    })
    .join('')

  return `<table role="presentation" width="${TABLO_GENISLIK}" cellpadding="0" cellspacing="0" border="0" style="width:${TABLO_GENISLIK}px;margin:0 0 14px 0;border-collapse:collapse;table-layout:fixed;line-height:${SATIR_LH}px;border-top:${cerceve};"><tr>${th}</tr>${trs}</table>`
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

/**
 * Giren/çıkan tablosu — paylaşılan `dataTable` yerine YEREL çizici (24.09).
 *
 * Gerekçe: `dataTable` başlık hücrelerine `text-transform:uppercase` koyuyor ve
 * Outlook bu dönüşümde Türkçe harfleri bozuyordu ("Bölüm" → "BOLUM", "Görev" →
 * "GOREV", "Çıkış sebebi" → "CIKIS SEBEBI"). Dönüşüm tamamen kaldırıldı; başlıklar
 * KODDA Türkçe büyük harf yazılıyor. `dataTable` 12 şablonda ortak olduğu için
 * layout.ts'e dokunulmadı — kapsam bu mailde tutuldu.
 *
 * Yükseklik sabitlenmez: diğer üç tabloyla aynı kural (eşit dolgu + valign).
 */
/**
 * Giren ve çıkan tabloları AYNI çiziciyi kullanır → yükseklik, hiza ve stil birebir.
 * Sütun genişlikleri de aynı şablonda: yalnız 3. sütunun başlığı farklı
 * (girenlerde GÖREV, çıkanlarda ÇIKIŞ SEBEBİ).
 *
 * SİCİL sütunu ÇIKARILDI (24.09) — sicil bilgisi düz metin sürümünde duruyor.
 * GÖREV çıkanlardan zaten çıkarılmıştı (yerini ÇIKIŞ SEBEBİ aldı).
 */
const HAREKET_SUTUN = {
  giren: [
    { baslik: 'AD SOYAD', w: 160, hiza: 'left' as const },
    { baslik: 'BÖLÜM', w: 130, hiza: 'left' as const },
    { baslik: 'GÖREV', w: 166, hiza: 'left' as const },
    { baslik: 'TARİH', w: 80, hiza: 'right' as const },
  ],
  cikan: [
    { baslik: 'AD SOYAD', w: 160, hiza: 'left' as const },
    { baslik: 'BÖLÜM', w: 130, hiza: 'left' as const },
    { baslik: 'ÇIKIŞ SEBEBİ', w: 166, hiza: 'left' as const },
    { baslik: 'TARİH', w: 80, hiza: 'right' as const },
  ],
}

function hareketTablosu(baslik: string, satirlar: HareketSatiri[], cikis = false): string {
  if (satirlar.length === 0) return ''
  const sutunlar = cikis ? HAREKET_SUTUN.cikan : HAREKET_SUTUN.giren
  const cerceve = `1px solid ${TOKENS.line}`
  const ortak = `font-family:${TOKENS.font};border-bottom:${cerceve};box-sizing:border-box;`

  const th = sutunlar
    .map(
      (c) =>
        `<th align="${c.hiza}" valign="middle" width="${c.w}" style="width:${c.w}px;padding:${dolgu()};${ortak}font-size:11px;line-height:${BASLIK_LH}px;font-weight:bold;color:${TOKENS.muted};text-align:${c.hiza};">${escapeHtml(c.baslik)}</th>`,
    )
    .join('')

  const trs = satirlar
    .map((r) => {
      const degerler = [
        { v: r.adSoyad, sonuk: false },
        { v: r.bolum, sonuk: true },
        // GÖREV yalnız GİRENLER tablosunda; çıkanlarda yerini ÇIKIŞ SEBEBİ aldı.
        ...(cikis
          ? [{ v: [r.cikisTarafi, r.cikisSebebi].filter(Boolean).join(' / ') || 'sebep girilmemiş', sonuk: true }]
          : [{ v: r.gorev, sonuk: true }]),
        { v: r.tarihKisa, sonuk: true },
      ]
      return (
        '<tr>' +
        degerler
          .map((d, i) => {
            const c = sutunlar[i]
            return `<td align="${c.hiza}" valign="middle" width="${c.w}" style="width:${c.w}px;padding:${dolgu()};${ortak}font-size:11px;line-height:${SATIR_LH}px;color:${d.sonuk ? TOKENS.muted : TOKENS.textDark};text-align:${c.hiza};">${escapeHtml(d.v)}</td>`
          })
          .join('') +
        '</tr>'
      )
    })
    .join('')

  return (
    sectionTitle(baslik, `${satirlar.length} kişi`) +
    `<table role="presentation" width="${TABLO_GENISLIK}" cellpadding="0" cellspacing="0" border="0" style="width:${TABLO_GENISLIK}px;margin:0 0 14px 0;border-collapse:collapse;table-layout:fixed;line-height:${SATIR_LH}px;border-top:${cerceve};"><tr>${th}</tr>${trs}</table>`
  )
}


export function buildPersonnelWeeklyHtml(veri: HaftalikPersonelRaporu, opts: HaftalikMailOpts): string {
  const { ozet, cinsiyetDagilimi, yakaCinsiyetTablosu, imalatTablosu, ofisTablosu } = veri.rapor

  const yakaSatiri = (anahtar: keyof typeof YAKA) => {
    const y = YAKA[anahtar]
    const s = yakaCinsiyetTablosu[anahtar]
    return { etiket: y.ad, renk: y.renk, degerler: [s.genel, s.erkek, s.kadin, s.engelli] }
  }
  const t = yakaCinsiyetTablosu.toplam
  const yakaTablosuHtml = yakaTablosu(
    ['YAKA TİPİ', 'GENEL', 'ERKEK', 'KADIN', 'ENGELLİ'],
    [
      yakaSatiri('beyaz'),
      yakaSatiri('mavi'),
      yakaSatiri('gri'),
      { etiket: 'TOPLAM', degerler: [t.genel, t.erkek, t.kadin, t.engelli], kalin: true },
    ],
  )

  const hareketYok =
    veri.girenler.length === 0 && veri.cikanlar.length === 0
      ? p(`<span style="color:${TOKENS.muted};">${escapeHtml(veri.tarihMetni)} haftasında işe giren veya işten çıkan personel yok.</span>`)
      : ''

  return renderEmailHtml({
    // NOT: üst şeritteki bu etiket layout.ts'in text-transform:uppercase kuralından
    // geçiyor (Outlook'ta "İNSAN VARLIKLARI" bozulabilir). Büyük harfli sabit
    // EmailModule birleşiminde olmadığı için burada çözülemez — layout.ts işi.
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
      yakaTablosuHtml +
      sectionTitle('İmalat — mavi + gri yaka', 'gri yaka ayrı sütun; en kalabalık üstte') +
      (() => { const d = imalatDikey(imalatTablosu); return dikeyTablo(['DİREK', 'ENDİREK', 'GRİ', 'TOPLAM'], d.satirlar, d.toplam, tabloToplami(d.toplam)) })() +
      sectionTitle('Ofis — beyaz yaka', 'en kalabalık üstte') +
      (() => { const d = ofisDikey(ofisTablosu); return dikeyTablo(['PERSONEL SAYISI'], d.satirlar, d.toplam, tabloToplami(d.toplam)) })() +
      hareketTablosu('Hafta içinde işe girenler', veri.girenler) +
      hareketTablosu('Hafta içinde işten çıkanlar', veri.cikanlar, true) +
      hareketYok,
    cta: { label: 'Canlı görünüm', url: opts.sayfaUrl },
    footnote: 'Haftalık personel raporu — kaynak: aktif personel kayıtları.',
  })
}
