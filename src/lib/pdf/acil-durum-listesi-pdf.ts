/**
 * MASTER Madde 49 — Acil Durum Servis Listesi PDF üretimi.
 *
 * Desen: operasyonel-servis-listesi-pdf.ts / visit-report-pdf-server.ts
 * (jsPDF + jspdf-autotable + gömülü Poppins; Buffer döner). Yeni bağımlılık yok.
 *
 * SIRALAMA ekranla AYNI ve acil durum önceliğine göre: önce KİME ULAŞILACAK
 * (araç/şoför → sorumlu → firma), sonra KİM ETKİLENDİ (yolcular), en sonda
 * güzergâh detayı (duraklar). Uzun yolcu listesi kısa iletişim bloklarını
 * aşağı itmesin diye bu sıra korunuyor; yolcu SAYISI başlıkta görünür.
 *
 * EKSİK GÖRÜNÜR OLMALI: blok durumu ATANMAMIS/SEFER_TANIMLI_DEGIL ise satır
 * boş bırakılmaz, açık metin yazılır (kâğıda basılınca da eksik görünsün).
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PoppinsBold, PoppinsRegular, PoppinsSemiBold } from './fonts/poppins'
import type {
  AcilDurumListesiSonucu,
  Blok,
  RolluBlok,
} from '@/lib/servis-yonetimi/acil-durum-listesi'

const ATANMAMIS_METNI = '— ATANMAMIŞ —'
const SEFER_YOK_METNI = 'Bu dilimde sefer tanımlı değil'

function durumMetni<T>(b: Blok<T>): string {
  return b.durum === 'SEFER_TANIMLI_DEGIL' ? SEFER_YOK_METNI : ATANMAMIS_METNI
}

function tarihTR(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('tr-TR', { timeZone: 'UTC' })
}

export function generateAcilDurumListesiPdfBuffer(data: AcilDurumListesiSonucu): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  doc.addFileToVFS('Poppins-Regular.ttf', PoppinsRegular)
  doc.addFileToVFS('Poppins-Bold.ttf', PoppinsBold)
  doc.addFileToVFS('Poppins-SemiBold.ttf', PoppinsSemiBold)
  doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal')
  doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
  doc.addFont('Poppins-SemiBold.ttf', 'Poppins', 'semibold')
  doc.setFont('Poppins', 'normal')

  const margin = 14
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPos = margin

  doc.setFont('Poppins', 'bold')
  doc.setFontSize(14)
  doc.text('ACİL DURUM SERVİS LİSTESİ', margin, yPos)
  yPos += 7

  doc.setFont('Poppins', 'semibold')
  doc.setFontSize(10)
  doc.text(
    `${data.guzergah.kod} — ${data.guzergah.ad}  ·  ${data.dilim.ad} (${data.dilim.yon})`,
    margin,
    yPos,
  )
  yPos += 5

  doc.setFont('Poppins', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(110, 110, 110)
  doc.text(
    `Yerleşke: ${data.guzergah.yerleskeKod} — ${data.guzergah.yerleskeAd}  ·  ${tarihTR(data.tarih)}` +
      `  ·  Beklenen yolcu: ${data.yolcular.kayitlar.length}  ·  Oluşturulma: ${new Date().toLocaleString('tr-TR')}`,
    margin,
    yPos,
  )
  doc.setTextColor(0, 0, 0)
  yPos += 6

  function sonY(varsayilan: number): number {
    const d = doc as unknown as { lastAutoTable?: { finalY: number } }
    return d.lastAutoTable ? d.lastAutoTable.finalY + 5 : varsayilan
  }

  function tablo(baslik: string, head: string[], body: (string | number)[][]) {
    autoTable(doc, {
      startY: yPos,
      head: [[{ content: baslik, colSpan: head.length, styles: { halign: 'left' } }], head],
      body: body.length > 0 ? body : [[{ content: '—', colSpan: head.length }]],
      theme: 'grid',
      styles: { font: 'Poppins', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [27, 79, 114], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      margin: { left: margin, right: margin, top: margin },
    })
    yPos = sonY(yPos)
  }

  /** ANA/YEDEK'i tek tabloda, boş rolü açık metinle gösterir. */
  function rolluSatirlar<T>(b: RolluBlok<T>, esle: (x: T) => (string | number)[], sutunSayisi: number) {
    const satirlar: (string | number)[][] = []
    for (const [etiket, blok] of [['ANA', b.ana], ['YEDEK', b.yedek]] as const) {
      if (blok.kayitlar.length === 0) {
        satirlar.push([etiket, durumMetni(blok), ...Array(Math.max(0, sutunSayisi - 2)).fill('')])
      } else {
        for (const k of blok.kayitlar) satirlar.push([etiket, ...esle(k)])
      }
    }
    return satirlar
  }

  // 1) Araç
  tablo(
    'ARAÇ',
    ['ROL', 'PLAKA', 'KAPASİTE', 'FİRMA'],
    rolluSatirlar(data.arac, a => [a.plaka, a.kapasite, a.firmaAd], 4),
  )

  // 2) Şoför
  tablo(
    'ŞOFÖR',
    ['ROL', 'AD SOYAD', 'TELEFON', 'TİP'],
    rolluSatirlar(data.sofor, s => [s.adSoyad, s.telefon ?? '—', s.dahiliMi ? 'Dahili' : 'Dış firma'], 4),
  )

  // 3) Güzergâh sorumlusu
  tablo(
    'GÜZERGÂH SORUMLUSU',
    ['ROL', 'AD SOYAD', 'SİCİL', 'TELEFON'],
    rolluSatirlar(data.sorumlu, s => [s.adSoyad, s.sicilNo ?? '', s.telefon ?? '—'], 4),
  )

  // 4) Firma iletişimi
  tablo(
    'TAŞERON FİRMA İLETİŞİMİ',
    ['FİRMA', 'YETKİLİ', 'TELEFON', 'E-POSTA'],
    data.firmalar.kayitlar.length > 0
      ? data.firmalar.kayitlar.map(f => [f.ad, f.yetkiliAdi ?? '', f.telefon ?? '—', f.eposta ?? ''])
      : [[durumMetni(data.firmalar), '', '', '']],
  )

  // 5) Beklenen yolcular
  tablo(
    `BEKLENEN YOLCULAR (${data.yolcular.kayitlar.length})`,
    ['SİCİL', 'AD SOYAD', 'DURAK', 'TELEFON'],
    data.yolcular.kayitlar.length > 0
      ? data.yolcular.kayitlar.map(y => [
          y.sicilNo ?? '',
          y.adSoyad,
          y.durakKod ? `${y.durakKod} — ${y.durakAd}` : '',
          y.telefon ?? '—',
        ])
      : [[durumMetni(data.yolcular), '', '', '']],
  )

  // 6) Duraklar
  tablo(
    'DURAKLAR',
    ['SIRA', 'DURAK', 'KONUM', 'SAAT'],
    data.duraklar.kayitlar.length > 0
      ? data.duraklar.kayitlar.map(d => [
          d.sira,
          `${d.durakKod} — ${d.durakAd}`,
          [d.il, d.ilce].filter(Boolean).join(' / '),
          d.saat ?? '—',
        ])
      : [[durumMetni(data.duraklar), '', '', '']],
  )

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(110, 110, 110)
    doc.text('KVKK: iletişim bilgisi içerir — yalnız acil durum kullanımı.', margin, pageHeight - 6)
    doc.text(`Sayfa ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
