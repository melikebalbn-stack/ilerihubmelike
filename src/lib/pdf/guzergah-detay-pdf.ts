/**
 * Servis Yönetimi — Güzergah Bazlı Detay PDF üretimi (Export Adım 3).
 *
 * Desen: visit-report-pdf-server.ts (jsPDF + jspdf-autotable, sunucu tarafı,
 * Buffer döner) — birebir izlendi. Poppins fontu AYNEN yeniden kullanılıyor
 * (src/lib/pdf/fonts/poppins.ts) — Türkçe karakterler (ğ,ş,ı,İ,ö,ü,ç) jsPDF'in
 * standart 14 fontuyla (Helvetica vb.) doğru render edilmiyor, bu yüzden
 * repodaki HER PDF üretici bir TTF gömüyor; burada da aynı font tekrar
 * kullanıldı, yeni bir font eklenmedi.
 *
 * Kapsam notu: "kapasite özeti" bölümü BİLEREK YOK — bkz.
 * src/lib/servis-yonetimi/export.ts üstündeki not (kapasite motoru henüz
 * main'de değil, export dalı ona bağımlı hale getirilmiyor).
 *
 * Görsel olarak visit-report-pdf-server.ts kadar süslü DEĞİL (logo/renkli
 * header yok) — bu bilinçli bir sadeleştirme, "küçük adım" kapsamında.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PoppinsBold, PoppinsRegular, PoppinsSemiBold } from './fonts/poppins'
import type { GuzergahDetayPdfData } from '@/lib/servis-yonetimi/export'

function tarihTR(d: Date | null): string {
  if (!d) return ''
  return d.toLocaleDateString('tr-TR', { timeZone: 'UTC' })
}

export function generateGuzergahDetayPdfBuffer(data: GuzergahDetayPdfData): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  doc.addFileToVFS('Poppins-Regular.ttf', PoppinsRegular)
  doc.addFileToVFS('Poppins-Bold.ttf', PoppinsBold)
  doc.addFileToVFS('Poppins-SemiBold.ttf', PoppinsSemiBold)
  doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal')
  doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
  doc.addFont('Poppins-SemiBold.ttf', 'Poppins', 'semibold')
  doc.setFont('Poppins', 'normal')

  const margin = 15
  const pageWidth = doc.internal.pageSize.getWidth()
  let yPos = margin

  function docWithTable() {
    return doc as unknown as { lastAutoTable?: { finalY: number } }
  }

  // Başlık
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(14)
  doc.text('Güzergâh Detay Raporu', margin, yPos)
  yPos += 6
  doc.setFont('Poppins', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`Oluşturulma: ${new Date().toLocaleString('tr-TR')}`, margin, yPos)
  doc.setTextColor(0, 0, 0)
  yPos += 8

  // Güzergâh bilgisi
  doc.setFont('Poppins', 'semibold')
  doc.setFontSize(10)
  doc.text(`${data.guzergah.kod} — ${data.guzergah.ad}`, margin, yPos)
  yPos += 6

  doc.setFont('Poppins', 'normal')
  doc.setFontSize(9)
  const bilgiSatirlari = [
    `Yerleşke: ${data.guzergah.yerleske.kod} — ${data.guzergah.yerleske.ad}`,
    `Bölge: ${data.guzergah.bolge ?? '—'}`,
    `Geçerlilik: ${tarihTR(data.guzergah.gecerlilikBaslangici) || '—'} – ${tarihTR(data.guzergah.gecerlilikBitisi) || 'süresiz'}`,
    `Durum: ${data.guzergah.aktif ? 'Aktif' : 'Pasif'}`,
  ]
  for (const satir of bilgiSatirlari) {
    doc.text(satir, margin, yPos)
    yPos += 5
  }
  yPos += 3

  // Durak sırası + saatler
  doc.setFont('Poppins', 'semibold')
  doc.setFontSize(10)
  doc.text('Durak Sırası ve Saatler', margin, yPos)
  yPos += 3

  autoTable(doc, {
    startY: yPos,
    head: [['Sıra', 'Durak', 'Saatler']],
    body:
      data.duraklar.length > 0
        ? data.duraklar.map((d) => [String(d.sira), `${d.durakKod} — ${d.durakAd}`, d.saatlerMetni])
        : [['—', 'Aktif durak yok', '—']],
    theme: 'grid',
    styles: { font: 'Poppins', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [27, 79, 114], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 55 } },
    margin: { left: margin, right: margin },
  })
  yPos = (docWithTable().lastAutoTable?.finalY ?? yPos) + 8

  // Araç ataması
  doc.setFont('Poppins', 'semibold')
  doc.setFontSize(10)
  doc.text('Varsayılan Araç Ataması', margin, yPos)
  yPos += 3

  autoTable(doc, {
    startY: yPos,
    head: [['Dilim', 'Plaka', 'Kapasite', 'Rol']],
    body:
      data.aracAtamalari.length > 0
        ? data.aracAtamalari.map((a) => [a.dilimEtiket, a.plaka, String(a.kapasite), a.rol])
        : [['—', 'Atanmış araç yok', '—', '—']],
    theme: 'grid',
    styles: { font: 'Poppins', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [27, 79, 114], textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: margin, right: margin },
  })
  yPos = (docWithTable().lastAutoTable?.finalY ?? yPos) + 8

  // Şoför ataması
  doc.setFont('Poppins', 'semibold')
  doc.setFontSize(10)
  doc.text('Varsayılan Şoför Ataması', margin, yPos)
  yPos += 3

  autoTable(doc, {
    startY: yPos,
    head: [['Dilim', 'Ad Soyad', 'Rol']],
    body:
      data.soforAtamalari.length > 0
        ? data.soforAtamalari.map((s) => [s.dilimEtiket, s.adSoyad, s.rol])
        : [['—', 'Atanmış şoför yok', '—']],
    theme: 'grid',
    styles: { font: 'Poppins', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [27, 79, 114], textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: margin, right: margin },
  })

  // Footer — sayfa numarası
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
