/**
 * Haftalık Personel Raporu mail şablonu.
 *
 * Mesai performans mailiyle (overtime-performance.ts) aynı iskelet: 640px
 * role="presentation" tablo, aynı gönderici, aynı sendEmail servisi.
 * Palet hub'ın mail teal'i (#0d9488, bkz. akademi/_base + oneri.ts).
 *
 * Outlook kısıtı: SVG, JS, flex/grid ve <div> genişliği YOK. Barlar iç içe
 * tablo hücresinin yüzde genişliği + arka plan rengi ile çiziliyor.
 */
import { escapeHtml } from '@/lib/email-templates/akademi/_base'
import type { HaftalikPersonelRaporu, HareketSatiri } from '@/lib/personnel-weekly-report'

const TEAL = '#0d9488'
const TEAL_KOYU = '#0f766e'
const METIN = '#334155'
const SOLUK = '#64748b'
const CIZGI = '#e2e8f0'
const FONT = 'Arial,Helvetica,sans-serif'

/** Yaka renkleri ekrandaki YAKA_RENK ile aynı: beyaz→teal, mavi→blue, gri→slate. */
const YAKA = {
  beyaz: { ad: 'Beyaz Yaka', renk: '#0d9488', zemin: '#f0fdfa' },
  mavi: { ad: 'Mavi Yaka', renk: '#2563eb', zemin: '#eff6ff' },
  gri: { ad: 'Gri Yaka', renk: '#64748b', zemin: '#f8fafc' },
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

/** KPI kutusu — tek hücre; kutular tek satırlık bir tabloda yan yana durur. */
function kpiHucre(etiket: string, deger: string, renk: string, zemin: string): string {
  return `<td width="19%" align="center" valign="top" style="padding:12px 6px;background-color:${zemin};border-top:3px solid ${renk};">
    <div style="font-family:${FONT};font-size:22px;font-weight:bold;color:${renk};line-height:26px;">${escapeHtml(deger)}</div>
    <div style="font-family:${FONT};font-size:11px;color:${SOLUK};padding-top:4px;">${escapeHtml(etiket)}</div>
  </td>`
}

function hareketTablosu(baslik: string, satirlar: HareketSatiri[], renk: string): string {
  if (satirlar.length === 0) return ''
  const govde = satirlar.map(s => `
    <tr>
      <td style="padding:7px 8px;font-family:${FONT};font-size:12px;color:${METIN};border-bottom:1px solid ${CIZGI};">${escapeHtml(s.adSoyad)}</td>
      <td style="padding:7px 8px;font-family:${FONT};font-size:12px;color:${SOLUK};border-bottom:1px solid ${CIZGI};">${escapeHtml(s.bolum)}</td>
      <td style="padding:7px 8px;font-family:${FONT};font-size:12px;color:${SOLUK};border-bottom:1px solid ${CIZGI};">${escapeHtml(s.gorev)}</td>
      <td align="right" style="padding:7px 8px;font-family:${FONT};font-size:12px;color:${SOLUK};white-space:nowrap;border-bottom:1px solid ${CIZGI};">${escapeHtml(s.tarih)}</td>
    </tr>`).join('')
  return `
  <div style="font-family:${FONT};font-size:14px;font-weight:bold;color:${TEAL_KOYU};margin:22px 0 8px 0;">
    ${escapeHtml(baslik)} <span style="font-weight:normal;color:${SOLUK};font-size:12px;">(${satirlar.length} kişi)</span>
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-left:3px solid ${renk};">
    ${govde}
  </table>`
}

export function buildPersonnelWeeklyHtml(veri: HaftalikPersonelRaporu, opts: HaftalikMailOpts): string {
  const { ozet, cinsiyetDagilimi, yakaCinsiyetTablosu, tumBolumler } = veri.rapor
  const bolumler = tumBolumler.slice(0, opts.bolumLimiti ?? 12)
  const enBuyuk = bolumler.reduce((m, b) => Math.max(m, b.sayi), 0)

  const yakaSatiri = (anahtar: keyof typeof YAKA) => {
    const y = YAKA[anahtar]
    const s = yakaCinsiyetTablosu[anahtar]
    return `
    <tr>
      <td style="padding:8px 10px;font-family:${FONT};font-size:12px;font-weight:bold;color:${y.renk};border-bottom:1px solid ${CIZGI};">${y.ad}</td>
      <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:12px;font-weight:bold;color:${METIN};border-bottom:1px solid ${CIZGI};">${s.genel}</td>
      <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:12px;color:${METIN};border-bottom:1px solid ${CIZGI};">${s.erkek}</td>
      <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:12px;color:${METIN};border-bottom:1px solid ${CIZGI};">${s.kadin}</td>
      <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:12px;color:${METIN};border-bottom:1px solid ${CIZGI};">${s.engelli}</td>
    </tr>`
  }

  // Bar: dış tablo %100, dolu hücre yüzde genişlikli. Outlook'ta div genişliği
  // çalışmadığı için barlar tablo hücresiyle çiziliyor.
  const barSatiri = (b: { bolum: string; sayi: number; oran: number }) => {
    const genislik = enBuyuk > 0 ? Math.max(2, Math.round(b.sayi / enBuyuk * 100)) : 0
    return `
    <tr>
      <td width="34%" style="padding:5px 8px 5px 0;font-family:${FONT};font-size:12px;color:${METIN};">${escapeHtml(b.bolum)}</td>
      <td style="padding:5px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#f1f5f9;">
          <tr>
            <td width="${genislik}%" style="background-color:${TEAL};height:14px;font-size:0;line-height:0;">&nbsp;</td>
            <td style="font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>
      </td>
      <td width="14%" align="right" style="padding:5px 0 5px 10px;font-family:${FONT};font-size:12px;color:${SOLUK};white-space:nowrap;">
        <span style="color:${METIN};font-weight:bold;">${b.sayi}</span> &nbsp;%${b.oran}
      </td>
    </tr>`
  }

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.baslik)}</title></head>
<body style="margin:0;padding:0;background-color:#f4f6f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px;background-color:#ffffff;border-radius:8px;overflow:hidden;">

      <!-- 1) Üst şerit -->
      <tr><td style="background-color:${TEAL};padding:20px 24px;">
        <div style="font-family:${FONT};font-size:19px;font-weight:bold;color:#ffffff;">${escapeHtml(opts.baslik)}</div>
        <div style="font-family:${FONT};font-size:13px;color:#cbfbf1;padding-top:4px;">Hafta: ${escapeHtml(veri.tarihMetni)} &nbsp;·&nbsp; Pazartesi–Pazar, Europe/Istanbul</div>
      </td></tr>

      <tr><td style="padding:22px 24px;">

        <!-- 2) KPI kutulari -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:5px 0;">
          <tr>
            ${kpiHucre('Toplam Çalışan', String(ozet.toplamCalisan), '#334155', '#f8fafc')}
            ${kpiHucre(YAKA.beyaz.ad, String(ozet.beyazYaka), YAKA.beyaz.renk, YAKA.beyaz.zemin)}
            ${kpiHucre(YAKA.mavi.ad, String(ozet.maviYaka), YAKA.mavi.renk, YAKA.mavi.zemin)}
            ${kpiHucre(YAKA.gri.ad, String(ozet.griYaka), YAKA.gri.renk, YAKA.gri.zemin)}
            ${kpiHucre('Kadın / Erkek', `${cinsiyetDagilimi.kadin} / ${cinsiyetDagilimi.erkek}`, '#e11d48', '#fff1f2')}
          </tr>
        </table>

        <!-- 3) Yaka x cinsiyet x engelli -->
        <div style="font-family:${FONT};font-size:14px;font-weight:bold;color:${TEAL_KOYU};margin:24px 0 8px 0;">Yaka · Cinsiyet · Engelli Dağılımı</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${CIZGI};">
          <tr style="background-color:#f8fafc;">
            <td style="padding:8px 10px;font-family:${FONT};font-size:11px;font-weight:bold;color:${SOLUK};text-transform:uppercase;">Yaka Tipi</td>
            <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:11px;font-weight:bold;color:${SOLUK};text-transform:uppercase;">Genel</td>
            <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:11px;font-weight:bold;color:${SOLUK};text-transform:uppercase;">Erkek</td>
            <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:11px;font-weight:bold;color:${SOLUK};text-transform:uppercase;">Kadın</td>
            <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:11px;font-weight:bold;color:${SOLUK};text-transform:uppercase;">Engelli</td>
          </tr>
          ${yakaSatiri('beyaz')}
          ${yakaSatiri('mavi')}
          ${yakaSatiri('gri')}
          <tr style="background-color:#f8fafc;">
            <td style="padding:8px 10px;font-family:${FONT};font-size:12px;font-weight:bold;color:${METIN};">TOPLAM</td>
            <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:12px;font-weight:bold;color:${METIN};">${yakaCinsiyetTablosu.toplam.genel}</td>
            <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:12px;font-weight:bold;color:${METIN};">${yakaCinsiyetTablosu.toplam.erkek}</td>
            <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:12px;font-weight:bold;color:${METIN};">${yakaCinsiyetTablosu.toplam.kadin}</td>
            <td align="center" style="padding:8px 10px;font-family:${FONT};font-size:12px;font-weight:bold;color:${METIN};">${yakaCinsiyetTablosu.toplam.engelli}</td>
          </tr>
        </table>

        <!-- 4) Bolum dagilimi — bar listesi -->
        <div style="font-family:${FONT};font-size:14px;font-weight:bold;color:${TEAL_KOYU};margin:24px 0 8px 0;">
          Bölüm Dağılımı
          <span style="font-weight:normal;color:${SOLUK};font-size:12px;">(en kalabalık ${bolumler.length} bölüm / toplam ${tumBolumler.length})</span>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          ${bolumler.map(barSatiri).join('')}
        </table>

        <!-- 5) Rapor haftasinda giren / cikan -->
        ${hareketTablosu('Hafta İçinde İşe Girenler', veri.girenler, '#0d9488')}
        ${hareketTablosu('Hafta İçinde İşten Çıkanlar', veri.cikanlar, '#e11d48')}
        ${veri.girenler.length === 0 && veri.cikanlar.length === 0
          ? `<div style="font-family:${FONT};font-size:12px;color:${SOLUK};margin-top:22px;padding:10px 12px;background-color:#f8fafc;">${escapeHtml(veri.tarihMetni)} haftasında işe giren veya işten çıkan personel yok.</div>`
          : ''}

        <!-- 6) Canli gorunum -->
        <div style="margin-top:26px;text-align:center;">
          <a href="${opts.sayfaUrl}" style="display:inline-block;background-color:${TEAL};color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:6px;font-family:${FONT};font-size:14px;font-weight:bold;">Canlı görünüm</a>
        </div>

      </td></tr>

      <tr><td style="padding:14px 24px;background-color:#f8fafc;border-top:1px solid ${CIZGI};font-family:${FONT};font-size:11px;color:#94a3b8;">
        Bu otomatik bir ILERIHub bildirimidir. Haftalık personel raporu — kaynak: aktif personel kayıtları.
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`
}
