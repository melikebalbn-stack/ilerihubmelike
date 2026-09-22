/**
 * MASTER Madde 29 — Operasyonel Servis Listeleri PDF üretimi.
 *
 * Desen: visit-report-pdf-server.ts (jsPDF + jspdf-autotable, sunucu
 * tarafı, Buffer döner) — birebir izlendi. Poppins fontu AYNEN yeniden
 * kullanıldı (Türkçe karakterler jsPDF'in standart fontlarıyla doğru
 * render edilmiyor). Sütunlar Excel export'uyla (operasyonel-servis-
 * listesi-excel.ts) BİREBİR aynı — EXPORT_HEADERS oradan alınıyor,
 * ikinci kez tanımlanmıyor.
 *
 * Uzun liste: autoTable'ın `head` seçeneği VARSAYILAN OLARAK her sayfada
 * tekrar eder (showHead 'everyPage', elle bir şey ayarlamaya gerek yok).
 * Sayfa numarası footer'da (Sayfa i / N).
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PoppinsBold, PoppinsRegular, PoppinsSemiBold } from './fonts/poppins'
import type { OperasyonelServisListesiSatiri } from '@/lib/servis-yonetimi/operasyonel-servis-listesi'
import { EXPORT_HEADERS } from '@/lib/servis-yonetimi/operasyonel-servis-listesi-excel'

function tarihTR(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('tr-TR', { timeZone: 'UTC' })
}

export interface OperasyonelServisListesiPdfData {
  tarih: string
  satirlar: OperasyonelServisListesiSatiri[]
  /** gecmisTarihSecildi=true iken — Excel'deki AYNI gerekçeyle PDF'in
   * İÇİNE de yazılır (dosya firmaya gidiyor, uygulama dışında okunuyor). */
  not?: string
}

export function generateOperasyonelServisListesiPdfBuffer(data: OperasyonelServisListesiPdfData): Buffer {
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
  let yPos = margin

  // Başlık
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(13)
  doc.text('Operasyonel Servis Listesi', margin, yPos)
  yPos += 6

  doc.setFont('Poppins', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`${tarihTR(data.tarih)} itibarıyla · Oluşturulma: ${new Date().toLocaleString('tr-TR')}`, margin, yPos)
  doc.setTextColor(0, 0, 0)
  yPos += 6

  // 🔴 Geçmiş tarih uyarısı — Excel'deki aynı gerekçeyle PDF'in içine
  if (data.not) {
    doc.setFont('Poppins', 'semibold')
    doc.setFontSize(9)
    doc.setTextColor(153, 82, 5)
    const noteLines = doc.splitTextToSize(data.not, pageWidth - margin * 2) as string[]
    doc.text(noteLines, margin, yPos)
    yPos += noteLines.length * 4.5 + 3
    doc.setTextColor(0, 0, 0)
  }

  const body = data.satirlar.map(s => [
    s.sicilNo ?? '',
    s.adSoyad,
    s.bolum ?? '',
    `${s.guzergahKod} — ${s.guzergahAd}`,
    s.durakKod ? `${s.durakKod} — ${s.durakAd}` : '',
    s.sabahSaati ?? '',
    s.telefon ?? '',
  ])

  autoTable(doc, {
    startY: yPos,
    head: [[...EXPORT_HEADERS]],
    body,
    theme: 'grid',
    styles: { font: 'Poppins', fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [27, 79, 114], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: margin, right: margin, top: margin },
  })

  // Footer — sayfa numarası her sayfada
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(`Sayfa ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
