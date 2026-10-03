/**
 * Güzergâh Listesi PDF (Paket B3). Desen: operasyonel-servis-listesi-pdf.ts (jsPDF +
 * autotable, Poppins). Sütunlar Excel güzergâh listesiyle (export.ts
 * GUZERGAH_LISTESI_HEADERS) BİREBİR aynı + kapasite (Koltuk/Personel/Doluluk/Durum).
 * KVKK: yalnız güzergâh ve sayılar — kişi bilgisi yok.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PoppinsBold, PoppinsRegular, PoppinsSemiBold } from './fonts/poppins'
import { kapasiteDurumEtiketi, type ServisKapasiteOzeti } from '@/lib/servis-yonetimi/kapasite'

export type GuzergahListesiPdfSatiri = {
  kod: string
  ad: string
  bolge: string | null
  yerleske: string
  durakSayisi: number
  plakalar: string[]
  /** Kapasite motoru çıktısı; pasif güzergâhta null (kapasite hesaplanmaz). */
  kapasite: ServisKapasiteOzeti | null
  aktif: boolean
}

export const GUZERGAH_LISTESI_PDF_BASLIKLARI = [
  'KOD', 'AD', 'BÖLGE', 'YERLEŞKE', 'DURAK', 'ARAÇ', 'KOLTUK', 'PERSONEL', 'DOLULUK', 'DURUM',
] as const

const tarihTR = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('tr-TR', { timeZone: 'UTC' })
}

export function guzergahListesiPdfGovdesi(satirlar: GuzergahListesiPdfSatiri[]): string[][] {
  return satirlar.map((s) => {
    const k = s.kapasite
    const aracsiz = k?.durum === 'ARAC_YOK'
    return [
      s.kod,
      s.ad,
      s.bolge ?? '',
      s.yerleske,
      String(s.durakSayisi),
      s.plakalar.join(', '),
      k && !aracsiz ? String(k.kapasite) : '—',
      k ? String(k.atananPersonelSayisi) : '—',
      k && k.dolulukOrani !== null ? `%${k.dolulukOrani.toFixed(1)}` : '—',
      !s.aktif ? 'Pasif' : k ? kapasiteDurumEtiketi(k) : '—',
    ]
  })
}

export function generateGuzergahListesiPdfBuffer(data: { tarih: string; satirlar: GuzergahListesiPdfSatiri[] }): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.addFileToVFS('Poppins-Regular.ttf', PoppinsRegular)
  doc.addFileToVFS('Poppins-Bold.ttf', PoppinsBold)
  doc.addFileToVFS('Poppins-SemiBold.ttf', PoppinsSemiBold)
  doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal')
  doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
  doc.addFont('Poppins-SemiBold.ttf', 'Poppins', 'semibold')
  doc.setFont('Poppins', 'normal')

  const margin = 12
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFont('Poppins', 'bold')
  doc.setFontSize(13)
  doc.text('Güzergâh Listesi', margin, margin)
  doc.setFont('Poppins', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`${tarihTR(data.tarih)} itibarıyla kapasite · Oluşturulma: ${new Date().toLocaleString('tr-TR')}`, margin, margin + 6)
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: margin + 11,
    head: [[...GUZERGAH_LISTESI_PDF_BASLIKLARI]],
    body: guzergahListesiPdfGovdesi(data.satirlar),
    theme: 'grid',
    styles: { font: 'Poppins', fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [27, 79, 114], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: margin, right: margin, top: margin },
  })

  const sayfaSayisi = doc.getNumberOfPages()
  for (let i = 1; i <= sayfaSayisi; i++) {
    doc.setPage(i)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(`Sayfa ${i} / ${sayfaSayisi}`, pageWidth - margin, pageHeight - 6, { align: 'right' })
  }
  return Buffer.from(doc.output('arraybuffer'))
}
