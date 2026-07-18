/**
 * Üretim "Malzeme Etiketi" PDF üretimi — termal, 100x80mm, SİYAH-BEYAZ.
 *
 * Font/fontkit yükleme deseni offboarding-pdf.ts'i taklit eder (pdf-lib +
 * @pdf-lib/fontkit + public/fonts statik Poppins TTF — tüm Türkçe karakterler).
 * DataMatrix bwip-js ile üretilip PNG olarak gömülür.
 *
 * TODO: Logo şu an renkli (RGBA) ilerigrouplogo.png — termalde gri-tonlamalı
 * basar. Daha keskin baskı için saf-siyah bir PNG logo eklenebilir.
 */

import fs from 'fs/promises'
import path from 'path'
import { PDFDocument, rgb, type PDFFont, type PDFImage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import * as bwipjs from 'bwip-js/node'

export interface MalzemeEtiketiData {
  orderNo: string
  operationNo: string | number
  operationDescription?: string | null
  partNo?: string | null
  partRev?: string | null
  partDescription?: string | null
  lot: string
  quantity: number
  location?: string | null
  date?: string // YYYY-MM-DD (default: bugün)
  operator: string
  site?: string | null
}

const MM = 2.83465
const PAGE_W = 100 * MM // 283.46pt
const PAGE_H = 80 * MM // 226.77pt
const BLACK = rgb(0, 0, 0)
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts')
const LOGO_PATH = path.join(process.cwd(), 'public', 'ilerigrouplogo.png')

// Modül-içi cache (offboarding-fonts deseni).
let cachedReg: Buffer | null = null
let cachedBold: Buffer | null = null
let cachedLogo: Buffer | null = null

async function loadFonts() {
  if (!cachedReg || !cachedBold) {
    const [reg, bold] = await Promise.all([
      fs.readFile(path.join(FONT_DIR, 'Poppins-Regular.ttf')),
      fs.readFile(path.join(FONT_DIR, 'Poppins-Bold.ttf')),
    ])
    cachedReg = reg
    cachedBold = bold
  }
  return { regular: cachedReg, bold: cachedBold }
}

async function loadLogo(): Promise<Buffer | null> {
  if (cachedLogo) return cachedLogo
  try {
    cachedLogo = await fs.readFile(LOGO_PATH)
    return cachedLogo
  } catch {
    return null // logo yoksa metin fallback'e düşeriz
  }
}

function todayIso(): string {
  // App kodu — new Date() serbest (workflow scripti değil).
  return new Date().toISOString().slice(0, 10)
}

export async function generateMalzemeEtiketiPdf(
  data: MalzemeEtiketiData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const fonts = await loadFonts()
  const reg: PDFFont = await pdf.embedFont(fonts.regular, { subset: true })
  const bold: PDFFont = await pdf.embedFont(fonts.bold, { subset: true })

  const page = pdf.addPage([PAGE_W, PAGE_H])

  const margin = 5 * MM
  const right = PAGE_W - margin
  const top = PAGE_H - margin

  // ── Üst: logo (sol) + "Malzeme Etiketi" (sağ, bold) ──
  const logoH = 8 * MM
  const logoBuf = await loadLogo()
  if (logoBuf) {
    const img: PDFImage = await pdf.embedPng(logoBuf)
    const logoW = logoH * (img.width / img.height)
    page.drawImage(img, { x: margin, y: top - logoH, width: logoW, height: logoH })
  } else {
    page.drawText('İleri', { x: margin, y: top - logoH + 4, size: 16, font: bold, color: BLACK })
  }

  const title = 'Malzeme Etiketi'
  const titleSize = 12
  page.drawText(title, {
    x: right - bold.widthOfTextAtSize(title, titleSize),
    y: top - logoH + (logoH - titleSize) / 2 + 1,
    size: titleSize,
    font: bold,
    color: BLACK,
  })

  // Header altı ince çizgi
  const headerLineY = top - logoH - 4 * MM
  page.drawLine({
    start: { x: margin, y: headerLineY },
    end: { x: right, y: headerLineY },
    thickness: 0.8,
    color: BLACK,
  })

  // ── Sağ: DataMatrix (lot izlenebilirlik) ──
  const dmSize = 22 * MM
  const dmX = right - dmSize
  const dmTop = headerLineY - 3 * MM
  const traceUrl = `https://hub.ilerigroup.com/uretim/${encodeURIComponent(data.lot)}`
  try {
    const dmPng = await bwipjs.toBuffer({
      bcid: 'datamatrix',
      text: traceUrl,
      scale: 4,
      backgroundcolor: 'FFFFFF',
    })
    const dmImg = await pdf.embedPng(dmPng)
    page.drawImage(dmImg, { x: dmX, y: dmTop - dmSize, width: dmSize, height: dmSize })
    const cap = 'izlenebilirlik'
    page.drawText(cap, {
      x: dmX + (dmSize - reg.widthOfTextAtSize(cap, 6)) / 2,
      y: dmTop - dmSize - 9,
      size: 6,
      font: reg,
      color: BLACK,
    })
  } catch {
    // DataMatrix üretilemezse etiket yine de basılır (kare boş kalır).
  }

  // ── Sol sütun: label : value satırları ──
  const leftX = margin
  const labelSize = 7
  const valueSize = 9
  const rowH = 16.5
  const valueX = leftX + 64 // etiket kolon genişliği
  const valueMaxW = dmX - 6 - valueX // DataMatrix'e taşmasın
  let y = headerLineY - 5 * MM

  const fit = (text: string, size: number, maxW: number): string => {
    if (reg.widthOfTextAtSize(text, size) <= maxW) return text
    let t = text
    while (t.length > 1 && bold.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1)
    return t + '…'
  }

  const row = (label: string, value: string) => {
    page.drawText(label, { x: leftX, y, size: labelSize, font: reg, color: BLACK })
    page.drawText(fit(value, valueSize, valueMaxW), {
      x: valueX,
      y: y - 1,
      size: valueSize,
      font: bold,
      color: BLACK,
    })
    y -= rowH
  }

  const partLine =
    (data.partNo ?? '—') + (data.partRev ? `  Rev ${data.partRev}` : '')
  row('Parça', partLine)
  if (data.partDescription) row('Tanım', data.partDescription)
  row('İş Emri', data.orderNo)
  row(
    'Operasyon',
    `${data.operationNo}${data.operationDescription ? ` · ${data.operationDescription}` : ''}`,
  )
  row('Lot', data.lot)
  row('Miktar', String(data.quantity))
  if (data.location) row('Önerilen Yer', data.location)
  row('Tarih', data.date || todayIso())

  // ── Alt: ince çizgi + Operatör (sol) / Site (sağ) ──
  const footLineY = margin + 5 * MM
  page.drawLine({
    start: { x: margin, y: footLineY },
    end: { x: right, y: footLineY },
    thickness: 0.8,
    color: BLACK,
  })
  page.drawText(`Operatör: ${data.operator}`, {
    x: leftX,
    y: footLineY - 4 * MM,
    size: 8,
    font: reg,
    color: BLACK,
  })
  if (data.site) {
    const siteTxt = `Site: ${data.site}`
    page.drawText(siteTxt, {
      x: right - reg.widthOfTextAtSize(siteTxt, 8),
      y: footLineY - 4 * MM,
      size: 8,
      font: reg,
      color: BLACK,
    })
  }

  return pdf.save()
}
