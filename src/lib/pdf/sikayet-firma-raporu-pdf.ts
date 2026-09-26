/**
 * Servis Yönetimi — Şikâyet / Firma Performansı PDF üretimi (Adım 5G).
 *
 * Desen: visit-report-pdf-server.ts (jsPDF + jspdf-autotable, sunucu tarafı,
 * Buffer döner) — birebir izlendi. Poppins fontu AYNEN yeniden kullanılıyor
 * (./fonts/poppins.ts): jsPDF'in standart fontları Türkçe karakterleri
 * (ğ, ş, ı, İ, ö, ü, ç) doğru render etmiyor, bu yüzden repodaki HER PDF
 * üretici bir TTF gömüyor. Yeni font eklenmedi.
 *
 * 🔴 ORTAK İSKELE YOK — bilinçli (Melih'in kararı: B). src/lib/pdf/ altındaki
 * 10 üretici de aynı font/başlık/tablo bloğunu kendi içinde tekrarlıyor; bu
 * dosya 11.'si ve mevcut normu izliyor. İskele ayrı bir iş olarak duruyor.
 *
 * 🔴 KOLONLAR BURADA YENİDEN TANIMLANMAZ: tek kaynak
 * src/lib/servis-yonetimi/sikayet-excel.ts içindeki SIKAYET_EXPORT_KOLONLARI
 * (rule 6). Excel'den bir kolon eklenip PDF'e eklenmemesi mümkün değil —
 * PDF alt kümesi oradaki `pdf` bayrağından türer. (guzergah-detay-pdf.ts de
 * tipini servis-yonetimi/export.ts'ten alıyor; aynı yön.)
 *
 * 🔴 KVKK: girdi FİRMA GÖRÜNÜMÜNÜN satırlarıdır; şikâyetçi kimliği ne
 * select'te ne satırlarda vardır, uç ayrıca sınır bekçisinden geçirir.
 * Bu dosya veri ayıklamaz — ayıklama ikinci bir doğruluk kaynağı olurdu.
 *
 * 🔴 KIRPMA YOK: gelen satırların hepsi yazılır, slice/limit yoktur.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PoppinsBold, PoppinsRegular, PoppinsSemiBold } from './fonts/poppins'
import { SIKAYET_PDF_KOLONLARI } from '@/lib/servis-yonetimi/sikayet-excel'
import type { Satir } from '@/lib/rapor/gorunum'

const NAVY: [number, number, number] = [27, 79, 114] // #1B4F72
const GRI: [number, number, number] = [120, 120, 120]
const ACIK_GRI: [number, number, number] = [245, 247, 250]

export type SikayetPdfGirdisi = {
  baslik: string
  altBaslik: string
  /** sikayetExcelSatirlari() çıktısı — Excel ile AYNI satırlar. */
  satirlar: Satir[]
}

/** Hücre metni: tarih ise gg.aa.yyyy, yoksa düz metin. Boş değer "—". */
function hucre(deger: unknown): string {
  if (deger === null || deger === undefined || deger === '') return '—'
  if (deger instanceof Date) {
    return Number.isNaN(deger.getTime()) ? '—' : deger.toLocaleDateString('tr-TR', { timeZone: 'UTC' })
  }
  return String(deger)
}

/** Satırları firmaya göre, GELİŞ SIRASINI koruyarak öbekler. */
function firmayaGoreGrupla(satirlar: Satir[]): { firma: string; satirlar: Satir[] }[] {
  const gruplar = new Map<string, Satir[]>()
  for (const s of satirlar) {
    const firma = String(s.firmaAd ?? 'Firma belirtilmemiş')
    const mevcut = gruplar.get(firma)
    if (mevcut) mevcut.push(s)
    else gruplar.set(firma, [s])
  }
  return [...gruplar].map(([firma, satirlar]) => ({ firma, satirlar }))
}

export function generateSikayetFirmaRaporuPdfBuffer(girdi: SikayetPdfGirdisi): Buffer {
  // A4 YATAY: tabloda 9 kolon var, dikey sayfada okunaksız olurdu.
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

  // ── Başlık ────────────────────────────────────────────────────────────────
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  doc.text(girdi.baslik, margin, yPos)
  yPos += 6

  doc.setFont('Poppins', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRI)
  doc.text(`Oluşturulma: ${new Date().toLocaleString('tr-TR')}`, margin, yPos)
  yPos += 5

  // Alt başlık uzun (Ders 79 uyarısı) — sayfaya sığması için sarılır.
  for (const satir of doc.splitTextToSize(girdi.altBaslik, pageWidth - margin * 2) as string[]) {
    doc.text(satir, margin, yPos)
    yPos += 4
  }
  yPos += 3
  doc.setTextColor(0, 0, 0)

  const basliklar = SIKAYET_PDF_KOLONLARI.map(k => k.baslik)
  const columnStyles = Object.fromEntries(
    SIKAYET_PDF_KOLONLARI.flatMap((k, i) =>
      'pdfGenislik' in k ? [[i, { cellWidth: k.pdfGenislik }]] : [],
    ),
  )

  if (girdi.satirlar.length === 0) {
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(10)
    doc.text('Seçilen filtrelerde şikâyet kaydı bulunmuyor.', margin, yPos)
  }

  // ── Firma başına bölüm ────────────────────────────────────────────────────
  for (const grup of firmayaGoreGrupla(girdi.satirlar)) {
    doc.setFont('Poppins', 'semibold')
    doc.setFontSize(10)
    doc.setTextColor(...NAVY)
    doc.text(`${grup.firma}  ·  ${grup.satirlar.length} şikâyet`, margin, yPos)
    doc.setTextColor(0, 0, 0)
    yPos += 2

    autoTable(doc, {
      startY: yPos,
      head: [basliklar],
      body: grup.satirlar.map(s => SIKAYET_PDF_KOLONLARI.map(k => hucre(s[k.alan]))),
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: { font: 'Poppins', fontSize: 7, cellPadding: 1.8, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: ACIK_GRI },
      columnStyles,
    })

    const sonY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
    yPos = (sonY ?? yPos) + 8
  }

  // ── Altbilgi (her sayfada) ────────────────────────────────────────────────
  const toplamSayfa = doc.getNumberOfPages()
  for (let i = 1; i <= toplamSayfa; i++) {
    doc.setPage(i)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRI)
    doc.text(`Toplam ${girdi.satirlar.length} şikâyet kaydı`, margin, pageHeight - 6)
    doc.text(`Sayfa ${i} / ${toplamSayfa}`, pageWidth - margin, pageHeight - 6, { align: 'right' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}

/**
 * Dosya adı — 🔴 SALT ASCII (Content-Disposition latin-1 bir başlık alanıdır,
 * Türkçe karakter bozulur). Excel'deki sikayetExcelDosyaAdi ile aynı kural.
 */
export function sikayetPdfDosyaAdi(now = new Date()): string {
  return `Servis-Sikayet-Firma-Raporu-${now.toISOString().slice(0, 10)}.pdf`
}
