/**
 * Zimmet Tutanağı PDF üretimi — Zimmet Teslim Formu modülü.
 *
 * offboarding-pdf.ts (İK-FR-001) ile AYNI desen: pdf-lib + @pdf-lib/fontkit,
 * statik Poppins TTF (public/fonts) — Türkçe karakter desteği için. Font
 * yükleme offboarding-fonts.ts'ten AYNEN yeniden kullanılıyor (aynı dosyalar,
 * tekrar kod yazmaya gerek yok).
 *
 * Checkbox YOK — bu formda unicode imza glyph'i de kullanılmıyor; imza
 * alanları çizgi + isim olarak çiziliyor (ıslak imza için).
 */

import fs from 'fs/promises'
import path from 'path'
import { PDFDocument, rgb, PageSizes, type PDFPage, type PDFFont, type RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { loadOffboardingFonts } from '@/lib/offboarding/offboarding-fonts'
import type { ZimmetTuru, ZimmetCihazDurumu, ZimmetOnayDurumu } from '@/generated/prisma'

export interface ZimmetPdfData {
  id: string
  zimmetSahibiAdi: string
  altZimmetSahibi: string | null
  departman: string | null
  tur: ZimmetTuru
  turDiger: string | null
  marka?: string
  model?: string
  seriNumarasi: string | null
  aciklama: string | null
  ozellik: string | null
  ram?: string
  ipAdresi?: string
  parcaNo?: string
  lisansBaslangic?: string
  lisansBitis?: string
  macAdresi: string | null
  pcAdi: string | null
  imeiNumarasi: string | null
  verilisTarihi: Date | null
  cihazDurumu: ZimmetCihazDurumu
  durum: ZimmetOnayDurumu
  teslimNotu: string | null
  teslimEdenAdi: string
  createdAt: Date
  teslimEdenImzalandi?: boolean
  teslimEdenImzaTarihi?: string
  zimmetSahibiImzalandi?: boolean
  zimmetSahibiImzaTarihi?: string
}

const TUR_LABELS: Record<ZimmetTuru, string> = {
  NOTEBOOK_BILGISAYAR: 'Notebook Bilgisayar',
  DESKTOP_BILGISAYAR: 'Desktop Bilgisayar',
  CEP_TELEFONU: 'Cep Telefonu',
  EL_TERMINALI: 'El Terminali',
  OFFICE_365: 'Office 365',
  DIGER: 'Diğer',
}

const LOGO_PATH = path.join(process.cwd(), 'public', 'images', 'zimmet', 'ileri-group-logo.png')
// Sadece BAŞARILI okuma cache'lenir — dosya henüz yoksa her çağrıda yeniden
// denenir (logo sonradan eklendiğinde sunucu restart'ı gerekmesin diye).
let cachedLogo: Buffer | null = null

async function loadLogo(): Promise<Buffer | null> {
  if (cachedLogo) return cachedLogo
  try {
    cachedLogo = await fs.readFile(LOGO_PATH)
  } catch {
    return null
  }
  return cachedLogo
}

// ── Renkler ──
function hexToRgb(hex: string): RGB {
  const c = hex.replace('#', '').trim()
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}
const NAVY = hexToRgb('#1B4F72')
const SLATE = rgb(0.28, 0.32, 0.36)
const BORDER = rgb(0.7, 0.74, 0.78)
const GREY = hexToRgb('#F2F3F4')
const WHITE = rgb(1, 1, 1)

const A4 = PageSizes.A4
const PAGE_W = A4[0]
const PAGE_H = A4[1]
const MARGIN = 36
const CONTENT_W = PAGE_W - 2 * MARGIN
const FOOTER_Y = 28

const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export async function generateZimmetPdf(data: ZimmetPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const fonts = await loadOffboardingFonts()
  const reg = await pdf.embedFont(fonts.regular, { subset: true })
  const bold = await pdf.embedFont(fonts.bold, { subset: true })

  const logoBytes = await loadLogo()
  const logoImage = logoBytes ? await pdf.embedPng(logoBytes) : null

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H])
  let y = 0

  function text(s: string, x: number, ty: number, size: number, font: PDFFont = reg, color: RGB = SLATE) {
    page.drawText(s ?? '', { x, y: ty, size, font, color })
  }
  function wrap(s: string, font: PDFFont, size: number, maxW: number): string[] {
    const words = (s || '').split(/\s+/).filter(Boolean)
    if (words.length === 0) return ['']
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w
      if (font.widthOfTextAtSize(trial, size) > maxW && cur) {
        lines.push(cur)
        cur = w
      } else {
        cur = trial
      }
    }
    if (cur) lines.push(cur)
    return lines
  }

  // Logo + başlık + NAVY çizgi altı (her sayfada tekrarlanır)
  // Yeni logo yatay/geniş format (~3.1:1) — sabit width/height yerine
  // image.scale() ile gerçek oranı koruyoruz, aksi halde gerilmiş görünür.
  function drawHeader() {
    const top = PAGE_H - MARGIN
    const logoTargetWidth = 90 // önceki: 140
    const logoDims = logoImage
      ? logoImage.scale(logoTargetWidth / logoImage.width)
      : { width: logoTargetWidth, height: 29 }

    if (logoImage) {
      page.drawImage(logoImage, {
        x: MARGIN,
        y: top - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      })
    }

    const title = 'ZİMMET TUTANAĞI'
    const textX = MARGIN + logoDims.width + 14
    text(title, textX, top - logoDims.height / 2 - 2, 16, bold, NAVY)
    text(`Kayıt No: ${data.id}`, textX, top - logoDims.height / 2 - 16, 8, reg, SLATE)

    const lineY = top - logoDims.height - 8
    page.drawLine({
      start: { x: MARGIN, y: lineY },
      end: { x: PAGE_W - MARGIN, y: lineY },
      color: NAVY,
      thickness: 1.4,
    })
    y = lineY - 18
  }
  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H])
    drawHeader()
  }
  function ensure(h: number) {
    if (y - h < FOOTER_Y + 16) newPage()
  }

  drawHeader()

  // ── İki kolonlu bilgi tablosu ──
  const turGosterim = data.tur === 'DIGER' ? data.turDiger || '—' : TUR_LABELS[data.tur]
  const infoRows: [string, string][] = [
    ['Zimmet Sahibi', data.zimmetSahibiAdi || '—'],
    ['Departman', data.departman || '—'],
    ['Tür', turGosterim],
    ...(data.marka ? [['Marka', data.marka] as [string, string]] : []),
    ...(data.model ? [['Model', data.model] as [string, string]] : []),
    ['Seri Numarası', data.seriNumarasi || '—'],
    ['Açıklama', data.aciklama || '—'],
    ['Özellik', data.ozellik || '—'],
    ...(data.ram ? [['RAM', data.ram] as [string, string]] : []),
    ...(data.ipAdresi ? [['IP Adresi', data.ipAdresi] as [string, string]] : []),
    ...(data.parcaNo ? [['P/N', data.parcaNo] as [string, string]] : []),
    ['MAC Adresi', data.macAdresi || '—'],
    ['PC Adı', data.pcAdi || '—'],
    ['Veriliş Tarihi', fmtDate(data.verilisTarihi)],
    ...(data.lisansBaslangic
      ? [['Lisans Başlangıç', fmtDate(new Date(data.lisansBaslangic))] as [string, string]]
      : []),
    ...(data.lisansBitis
      ? [['Lisans Bitiş', fmtDate(new Date(data.lisansBitis))] as [string, string]]
      : []),
  ]
  const colW = CONTENT_W / 2
  for (let i = 0; i < infoRows.length; i += 2) {
    ensure(18)
    for (let c = 0; c < 2; c++) {
      const cell = infoRows[i + c]
      if (!cell) continue
      const cx = MARGIN + c * colW
      page.drawRectangle({ x: cx, y: y - 18, width: colW, height: 18, borderColor: BORDER, borderWidth: 0.6 })
      text(cell[0], cx + 6, y - 12, 8, bold, NAVY)
      text(cell[1], cx + 120, y - 12, 8, reg, SLATE)
    }
    y -= 18
  }
  y -= 10

  // ── Teslim koşulları / notlar kutusu (GREY) ──
  text('Teslim Koşulları / Notlar', MARGIN + 2, y - 10, 8.5, bold, NAVY)
  y -= 16
  // Kaynak metin \n\n ile paragraflara, tekli \n ile de "-" madde satırlarına
  // ayrılmış — /\n+/ ile bölmek her paragrafı VE her madde satırını kendi
  // birimi olarak ayırır (aradaki boş satırlar filter(Boolean) ile düşer).
  const NOTE_LINE_H = 10
  const NOTE_PARA_GAP = 6
  const noteParagraphs = (data.teslimNotu || '—')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const noteParagraphLines = (noteParagraphs.length ? noteParagraphs : ['—']).map((p) =>
    wrap(p, reg, 8, CONTENT_W - 24)
  )
  const noteTotalLines = noteParagraphLines.reduce((sum, lines) => sum + lines.length, 0)
  const noteH = Math.max(
    24,
    noteTotalLines * NOTE_LINE_H + (noteParagraphLines.length - 1) * NOTE_PARA_GAP + 14
  )
  ensure(noteH)
  page.drawRectangle({ x: MARGIN, y: y - noteH, width: CONTENT_W, height: noteH, color: GREY, borderColor: BORDER, borderWidth: 0.6 })
  let noteY = y - 14
  noteParagraphLines.forEach((lines, pi) => {
    lines.forEach((ln) => {
      text(ln, MARGIN + 12, noteY, 8, reg, SLATE)
      noteY -= NOTE_LINE_H
    })
    if (pi < noteParagraphLines.length - 1) noteY -= NOTE_PARA_GAP
  })
  y -= noteH + 16

  // ── İmza kutuları ──
  const sigW = CONTENT_W / 2
  const sigH = 56
  ensure(sigH)
  const sigBoxes: { role: string; name: string }[] = [
    { role: 'Zimmeti Veren', name: data.teslimEdenAdi || '—' },
    { role: 'Zimmet Sahibi', name: data.zimmetSahibiAdi || '—' },
  ]
  sigBoxes.forEach((sb, i) => {
    const sx = MARGIN + i * sigW
    text(sb.role, sx + 4, y - 10, 8.5, bold, NAVY)
    page.drawLine({ start: { x: sx + 4, y: y - sigH + 22 }, end: { x: sx + sigW - 16, y: y - sigH + 22 }, color: BORDER, thickness: 0.8 })
    text(sb.name, sx + 4, y - sigH + 12, 8.5, bold, SLATE)
    if (i === 0 && data.teslimEdenImzalandi && data.teslimEdenImzaTarihi) {
      const imzaStr = new Date(data.teslimEdenImzaTarihi).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
      text(`E-İmzalandı: ${data.teslimEdenAdi} — ${imzaStr}`, sx + 4, y - sigH + 2, 8, reg, SLATE)
    } else if (i === 1 && data.zimmetSahibiImzalandi && data.zimmetSahibiImzaTarihi) {
      const imzaStr = new Date(data.zimmetSahibiImzaTarihi).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
      text(`E-İmzalandı: ${data.zimmetSahibiAdi} — ${imzaStr}`, sx + 4, y - sigH + 2, 8, reg, SLATE)
    } else {
      text('Ad Soyad / İmza', sx + 4, y - sigH + 2, 6.5, reg, BORDER)
    }
  })
  y -= sigH

  // ── Footer (sayfa no + kayıt no, tüm sayfalar) ──
  const pages = pdf.getPages()
  const total = pages.length
  pages.forEach((p, i) => {
    const label = `Sayfa ${i + 1} / ${total}`
    p.drawText(label, { x: PAGE_W - MARGIN - reg.widthOfTextAtSize(label, 8), y: FOOTER_Y, size: 8, font: reg, color: SLATE })
    p.drawText(`Zimmet Tutanağı · ${data.id}`, { x: MARGIN, y: FOOTER_Y, size: 8, font: reg, color: SLATE })
  })

  return pdf.save()
}
