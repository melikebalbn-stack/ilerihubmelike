/**
 * Depo "Malzeme Tanıtım Kartı" PDF (EL-4) — 100×60 mm yatay, tek sayfa.
 *
 * Font/DataMatrix altyapısı üretim malzeme etiketinden (src/lib/uretim/
 * malzeme-etiketi-pdf.ts) yeniden kullanıldı: pdf-lib + @pdf-lib/fontkit +
 * public/fonts Poppins TTF (Türkçe karakter gömülü) + bwip-js/node DataMatrix.
 *
 * TODO (DataMatrix iç formatı): 'P:{stok}|T:{lot}|Q:{mik}|S:{etiketNo}' geçici;
 * gerçek saha etiket formatı görülünce ISO 15434 / mevcut formatla ve
 * etiket-parse.ts sözleşmesiyle hizalanacak.
 *
 * SERVER-ONLY: node fs + bwip-js/node kullanır (malzeme-etiketi-pdf.ts peer'iyle
 * aynı desen); yalnızca API route'undan çağrılır, client bundle'a girmez.
 */
import fs from 'fs/promises'
import path from 'path'
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import * as bwipjs from 'bwip-js/node'

export interface MalzemeEtiketiVeri {
  stokKodu: string
  stokAdi: string
  miktar: number
  birim: string
  lot?: string
  girisTarihi?: string // yyyy-MM-dd (default bugün)
  kaynakBilgi: string
  lokasyon: string
  etiketNo: string
  basanKullanici: string
  kaynakModul: string
}

const MM = 2.83465
const PAGE_W = 100 * MM // 283.46 pt
const PAGE_H = 60 * MM // 170.08 pt
const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)
const GRAY = rgb(0.45, 0.45, 0.45)
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts')

let cachedReg: Buffer | null = null
let cachedBold: Buffer | null = null
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

/** Etiket numarası: ETK-{YY}-{6 hane}. TODO: kalıcı sayaç gerekirse DB sequence. */
export function genEtiketNo(): string {
  const yy = String(new Date().getFullYear()).slice(2)
  const n = Math.floor(100000 + Math.random() * 900000)
  return `ETK-${yy}-${n}`
}

function fmtDate(iso?: string): string {
  const d = iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10)
  const [y, m, day] = d.split('-')
  return y && m && day ? `${day}.${m}.${y}` : d
}
function nowStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Metni maxW'ye sığdırır: base'ten min'e 0.5 adımlarla punto düşer; min'de de
 * sığmıyorsa allowTruncate ise sondan '…' ile kısaltır, değilse min puntoda tam basar
 * (kritik alanlar — ETIKET NO / LOT — asla kısaltılmaz).
 */
function fitText(
  text: string,
  font: PDFFont,
  maxW: number,
  base: number,
  min: number,
  allowTruncate: boolean,
): { text: string; size: number } {
  let size = base
  while (size > min && font.widthOfTextAtSize(text, size) > maxW) size = Math.max(min, size - 0.5)
  if (font.widthOfTextAtSize(text, size) <= maxW) return { text, size }
  if (!allowTruncate) return { text, size } // kritik alan: tam bas
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1)
  return { text: t + '…', size }
}

export async function generateMalzemeEtiketi(veri: MalzemeEtiketiVeri): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const f = await loadFonts()
  const reg: PDFFont = await pdf.embedFont(f.regular, { subset: true })
  const bold: PDFFont = await pdf.embedFont(f.bold, { subset: true })
  const page = pdf.addPage([PAGE_W, PAGE_H])

  const margin = 4 * MM

  // ── Üst siyah şerit ──
  const stripH = 8.5 * MM
  page.drawRectangle({ x: 0, y: PAGE_H - stripH, width: PAGE_W, height: stripH, color: BLACK })
  const stripY = PAGE_H - stripH / 2 - 4
  page.drawText('ILERI GROUP', { x: margin, y: stripY, size: 11, font: bold, color: WHITE })
  const t2 = 'MALZEME TANITIM KARTI'
  page.drawText(t2, { x: PAGE_W - margin - reg.widthOfTextAtSize(t2, 8), y: stripY + 1, size: 8, font: reg, color: WHITE })

  const contentTop = PAGE_H - stripH - 6

  // ── DataMatrix (sağ üst) ──
  const dmSize = 26 * MM
  const dmX = PAGE_W - margin - dmSize
  const dmContent = `P:${veri.stokKodu}|T:${veri.lot ?? '*'}|Q:${veri.miktar}|S:${veri.etiketNo}`
  try {
    const png = await bwipjs.toBuffer({ bcid: 'datamatrix', text: dmContent, scale: 4, backgroundcolor: 'FFFFFF' })
    const img = await pdf.embedPng(png)
    page.drawImage(img, { x: dmX, y: contentTop - dmSize, width: dmSize, height: dmSize })
  } catch {
    /* DataMatrix üretilemezse kart yine basılır */
  }
  const cap = `(S) ${veri.etiketNo}`
  page.drawText(cap, {
    x: dmX + (dmSize - reg.widthOfTextAtSize(cap, 6)) / 2,
    y: contentTop - dmSize - 8,
    size: 6,
    font: reg,
    color: GRAY,
  })

  // ── DURUM kutusu (sağ, DM altı) — şimdilik sabit SERBEST ──
  // TODO: kalite modülü bağlanınca dinamik (KARANTİNA/BLOKE vb.)
  const durH = 15
  const durY = contentTop - dmSize - 12 - durH
  page.drawRectangle({ x: dmX, y: durY, width: dmSize, height: durH, borderColor: BLACK, borderWidth: 1 })
  const durTxt = 'DURUM: SERBEST'
  page.drawText(durTxt, {
    x: dmX + (dmSize - bold.widthOfTextAtSize(durTxt, 8)) / 2,
    y: durY + (durH - 8) / 2 + 1,
    size: 8,
    font: bold,
    color: BLACK,
  })

  // ── Sol sütun ──
  const leftX = margin
  const leftW = dmX - 8 - leftX

  page.drawText('(P) MALZEME NO', { x: leftX, y: contentTop - 8, size: 6.5, font: reg, color: GRAY })
  // Stok kodu — punto düşer, gerekirse kısaltılır (min 11).
  const kod = fitText(veri.stokKodu, bold, leftW, 18, 11, true)
  page.drawText(kod.text, { x: leftX, y: contentTop - 28, size: kod.size, font: bold, color: BLACK })
  // Stok adı — punto düşer (min 8), hâlâ sığmazsa '…' (bilgilendirici, kritik değil).
  const ad = fitText(veri.stokAdi || '-', reg, leftW, 9, 8, true)
  page.drawText(ad.text, { x: leftX, y: contentTop - 40, size: ad.size, font: reg, color: BLACK })

  const cellW = leftW / 3
  // allowTruncate=false → kritik alan (LOT / ETIKET NO): asla kısaltma, sadece punto düş.
  const cell = (
    x: number,
    topY: number,
    label: string,
    value: string,
    allowTruncate = true,
    min = 7,
  ) => {
    page.drawText(label, { x, y: topY, size: 6, font: reg, color: GRAY })
    const s = fitText(value, bold, cellW - 3, 9, min, allowTruncate)
    page.drawText(s.text, { x, y: topY - 11, size: s.size, font: bold, color: BLACK })
  }

  // Orta ızgara
  const midSep = contentTop - 48
  page.drawLine({ start: { x: leftX, y: midSep }, end: { x: dmX - 8, y: midSep }, thickness: 0.6, color: GRAY })
  const midY = midSep - 9
  cell(leftX, midY, '(Q) MIKTAR', `${veri.miktar} ${veri.birim}`)
  cell(leftX + cellW, midY, '(1T) LOT', veri.lot ?? '-', false) // LOT: kısaltma yasak
  cell(leftX + 2 * cellW, midY, 'GIRIS TARIHI', fmtDate(veri.girisTarihi))

  // Alt ızgara
  const botSep = midY - 20
  page.drawLine({ start: { x: leftX, y: botSep }, end: { x: dmX - 8, y: botSep }, thickness: 0.6, color: GRAY })
  const botY = botSep - 9
  cell(leftX, botY, '(V) KAYNAK', veri.kaynakBilgi) // KAYNAK: kısaltılabilir
  cell(leftX + cellW, botY, 'LOKASYON', veri.lokasyon)
  cell(leftX + 2 * cellW, botY, '(S) ETIKET NO', veri.etiketNo, false) // ETIKET NO: tam bas (min 7)

  // ── Alt bilgi şeridi ──
  const footLineY = margin + 4 * MM
  page.drawLine({ start: { x: margin, y: footLineY }, end: { x: PAGE_W - margin, y: footLineY }, thickness: 0.6, color: GRAY })
  const modulKisa = veri.kaynakModul.replace('Depo El Terminali / Stok Tasima', 'Depo Terminali/Tasima')
  const info = `Basan: ${veri.basanKullanici} · ${nowStamp()} · ${modulKisa}`
  const rightTxt = 'ILERIHub · IFS ILER2'
  const rightW = reg.widthOfTextAtSize(rightTxt, 6)
  const infoFit = fitText(info, reg, PAGE_W - 2 * margin - rightW - 8, 6, 5, true)
  page.drawText(infoFit.text, { x: margin, y: footLineY - 9, size: infoFit.size, font: reg, color: GRAY })
  page.drawText(rightTxt, { x: PAGE_W - margin - rightW, y: footLineY - 9, size: 6, font: reg, color: GRAY })

  return pdf.save()
}
